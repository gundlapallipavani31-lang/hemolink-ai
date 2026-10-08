"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import type { DonorOpportunityStatus } from "@/types/domain";

type DonorOpportunityView = {
  id: string;
  organizationName: string;
  organizationCity: string;
  sourceRequestId?: string;
  bloodGroup: string;
  city?: string;
  appointmentDetails?: string;
  appointmentAt: string | null;
  status: DonorOpportunityStatus;
  donorResponseAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

export function DonorOpportunities() {
  const { firebaseUser } = useAuth();
  const [opportunities, setOpportunities] = useState<DonorOpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    if (!firebaseUser) throw new Error("Sign in to view donor opportunities.");
    const token = await firebaseUser.getIdToken();
    const response = await fetch("/api/donor/opportunities", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json() as { opportunities?: DonorOpportunityView[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Donor opportunities could not be loaded.");
    return result.opportunities || [];
  }, [firebaseUser]);

  useEffect(() => {
    let active = true;
    void load()
      .then((result) => {
        if (active) {
          setOpportunities(result);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Donor opportunities could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [load]);

  async function respond(opportunityId: string, action: "accept" | "decline") {
    if (!firebaseUser) return;
    setSavingId(opportunityId);
    setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/donor/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your response could not be saved.");
      setOpportunities(await load());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your response could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) return <LoadingState title="Loading donor opportunities" />;
  if (error && opportunities.length === 0) {
    return <ErrorState title="Donor opportunities unavailable" description={error} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor workspace</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Donation opportunities</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">
        Review invitations from verified blood banks. Accepting an invitation does not confirm medical eligibility; staff will coordinate the appointment.
      </p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</p>}
      {opportunities.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No opportunities yet" description="When a verified blood bank invites you to donate, the details and response options will appear here." />
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-[1rem] border border-border bg-surface p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{opportunity.bloodGroup} donation invitation</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{opportunity.organizationName}</h2>
                  <p className="mt-1 text-sm text-foreground-muted">{opportunity.city || opportunity.organizationCity || "Location to be confirmed"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  opportunity.status === "offered" ? "bg-amber-50 text-warning"
                    : opportunity.status === "completed" ? "bg-green-50 text-success"
                      : opportunity.status === "declined" || opportunity.status === "cancelled" ? "bg-surface-muted text-foreground-muted"
                        : "bg-soft-rose text-primary"
                }`}>{opportunity.status.replace("_", " ")}</span>
              </div>
              {opportunity.sourceRequestId && (
                <p className="mt-4 text-sm text-foreground-muted">
                  Related to a blood request · Reference {opportunity.sourceRequestId.slice(0, 8)}
                </p>
              )}
              {opportunity.appointmentAt && (
                <div className="mt-5 rounded-lg border border-primary/15 bg-surface-muted p-4">
                  <p className="text-sm font-semibold text-foreground">Appointment</p>
                  <p className="mt-1 text-sm text-primary">{formatDate(opportunity.appointmentAt)}</p>
                  {opportunity.appointmentDetails && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground-muted">{opportunity.appointmentDetails}</p>}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground-muted">
                <span>Received {formatDate(opportunity.createdAt)}</span>
                {opportunity.donorResponseAt && <span>Responded {formatDate(opportunity.donorResponseAt)}</span>}
                {opportunity.completedAt && <span>Completed {formatDate(opportunity.completedAt)}</span>}
              </div>
              {opportunity.status === "offered" && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button disabled={savingId === opportunity.id} onClick={() => void respond(opportunity.id, "accept")} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">
                    {savingId === opportunity.id ? "Saving…" : "Accept invitation"}
                  </button>
                  <button disabled={savingId === opportunity.id} onClick={() => void respond(opportunity.id, "decline")} className="h-11 rounded-lg border border-border-strong px-5 text-sm font-semibold text-foreground-muted disabled:opacity-60">
                    Decline
                  </button>
                </div>
              )}
              {opportunity.status === "accepted" && <p className="mt-5 text-sm font-medium text-primary">Accepted. The blood bank will contact you to arrange an appointment.</p>}
              {opportunity.status === "completed" && <p className="mt-5 text-sm font-medium text-success">Your donation is complete and has been added to your donation history.</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
