"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import type { BloodGroup, BloodComponent, DonorOpportunityStatus } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];

type Candidate = { donorId: string; name: string; city: string; bloodGroup: BloodGroup };
type OpportunityRow = {
  id: string;
  donorId: string;
  donorName: string;
  organizationId: string;
  organizationName?: string;
  bloodGroup: BloodGroup;
  city: string;
  sourceRequestId?: string;
  status: DonorOpportunityStatus;
  appointmentAt: string | null;
  appointmentDetails?: string;
  createdAt: string | null;
  donationId?: string;
};

async function authorizedFetch<T>(
  path: string,
  user: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>,
  init?: RequestInit,
) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Donor opportunity operation failed.");
  return body;
}

function displayDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not scheduled";
}

export function StaffDonorOpportunities() {
  const { firebaseUser, userProfile } = useAuth();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!firebaseUser) throw new Error("Sign in to manage donor opportunities.");
    const query = new URLSearchParams({ bloodGroup });
    return authorizedFetch<{ opportunities: OpportunityRow[]; candidates: Candidate[] }>(
      `/api/staff/donor-opportunities?${query.toString()}`,
      firebaseUser,
    );
  }, [bloodGroup, firebaseUser]);

  useEffect(() => {
    let active = true;
    void refresh()
      .then((result) => {
        if (active) {
          setCandidates(result.candidates);
          setOpportunities(result.opportunities);
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
  }, [refresh, refreshKey]);

  async function reloadAfterAction(success: string) {
    const result = await refresh();
    setCandidates(result.candidates);
    setOpportunities(result.opportunities);
    setMessage(success);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      donorId: String(data.get("donorId") || ""),
      ...(userProfile?.role === "administrator"
        ? { organizationId: String(data.get("organizationId") || "") }
        : {}),
      bloodGroup,
      city: String(data.get("city") || "").trim(),
      sourceRequestId: String(data.get("sourceRequestId") || "").trim(),
    };
    setSavingId("create");
    setError("");
    setMessage("");
    try {
      await authorizedFetch("/api/staff/donor-opportunities", firebaseUser, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      event.currentTarget.reset();
      await reloadAfterAction("Opportunity sent to the selected donor.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Opportunity could not be created.");
    } finally {
      setSavingId("");
    }
  }

  async function update(
    opportunity: OpportunityRow,
    payload: Record<string, unknown>,
    success: string,
  ) {
    if (!firebaseUser) return;
    setSavingId(opportunity.id);
    setError("");
    setMessage("");
    try {
      await authorizedFetch(`/api/staff/donor-opportunities/${opportunity.id}`, firebaseUser, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await reloadAfterAction(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Opportunity could not be updated.");
    } finally {
      setSavingId("");
    }
  }

  if (!firebaseUser) return <LoadingState />;

  return (
    <section className="mt-8 rounded-[1rem] border border-border bg-surface p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-medical">Donor participation</p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">Donation opportunities</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
        Invite donors who match the exact blood group, have marked themselves available, and consented to outreach. Matching is not medical clearance.
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-success">{message}</p>}

      <form onSubmit={create} className="mt-6 grid gap-4 rounded-xl border border-border bg-surface-muted p-5 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="font-semibold text-foreground sm:col-span-2 lg:col-span-3">Create a donor invitation</h3>
        {userProfile?.role === "administrator" && (
          <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2 lg:col-span-3">
            Verified blood-bank organization ID
            <input name="organizationId" required className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
          </label>
        )}
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Exact blood group
          <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup)} className="h-11 rounded-lg border border-border-strong bg-surface px-3">
            {groups.map((group) => <option key={group}>{group}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Eligible donor
          <select name="donorId" required defaultValue="" className="h-11 rounded-lg border border-border-strong bg-surface px-3">
            <option value="" disabled>Select a matching donor</option>
            {candidates.map((candidate) => <option key={candidate.donorId} value={candidate.donorId}>{candidate.name} · {candidate.city || "City not recorded"} · {candidate.bloodGroup}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          City / outreach location
          <input name="city" maxLength={120} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
          Related blood request ID (optional)
          <input name="sourceRequestId" maxLength={128} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
        </label>
        <div className="flex items-end">
          <button disabled={savingId === "create" || candidates.length === 0} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50">
            {savingId === "create" ? "Sending…" : "Send invitation"}
          </button>
          {candidates.length === 0 && <p className="ml-3 text-xs text-foreground-muted">No eligible matching candidates.</p>}
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Sent opportunities</h3>
        <button onClick={() => setRefreshKey((value) => value + 1)} className="text-sm font-semibold text-primary">Refresh</button>
      </div>
      {loading ? <div className="mt-4"><LoadingState title="Loading opportunities" /></div>
        : opportunities.length === 0 ? <div className="mt-4"><EmptyState title="No opportunities created" description="Invitations and donor responses will be listed here." /></div>
          : <div className="mt-4 grid gap-4">{opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-foreground">{opportunity.donorName} · {opportunity.bloodGroup}</h4>
                  {userProfile?.role === "administrator" && <p className="mt-1 text-sm text-foreground-muted">{opportunity.organizationName || opportunity.organizationId}</p>}
                  <p className="mt-1 text-sm text-foreground-muted">{opportunity.city || "Location not recorded"}{opportunity.sourceRequestId ? ` · Request ${opportunity.sourceRequestId.slice(0, 8)}` : ""}</p>
                  <p className="mt-1 text-xs text-foreground-muted">Created {displayDate(opportunity.createdAt)}</p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold capitalize">{opportunity.status.replace("_", " ")}</span>
              </div>
              {opportunity.status === "accepted" && (
                <form
                  className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const appointmentAt = String(data.get("appointmentAt") || "");
                    if (!appointmentAt) {
                      setError("Choose an appointment date and time.");
                      return;
                    }
                    void update(opportunity, {
                      action: "schedule",
                      appointmentAt: new Date(appointmentAt).toISOString(),
                      appointmentDetails: String(data.get("appointmentDetails") || ""),
                      city: String(data.get("city") || ""),
                    }, "Appointment scheduled and donor notified.");
                  }}
                >
                  <label className="grid gap-1 text-xs font-medium text-foreground-muted">Appointment date and time<input name="appointmentAt" type="datetime-local" required className="h-11 rounded-lg border border-border-strong px-3 text-sm text-foreground" /></label>
                  <label className="grid gap-1 text-xs font-medium text-foreground-muted">Appointment city<input name="city" defaultValue={opportunity.city} maxLength={120} className="h-11 rounded-lg border border-border-strong px-3 text-sm text-foreground" /></label>
                  <label className="grid gap-1 text-xs font-medium text-foreground-muted sm:col-span-2">Location and appointment details<textarea name="appointmentDetails" required maxLength={1000} rows={2} className="rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground" /></label>
                  <button disabled={savingId === opportunity.id} className="h-10 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">Schedule donor</button>
                </form>
              )}
              {opportunity.status === "scheduled" && (
                <div className="mt-4 rounded-lg bg-surface-muted p-4">
                  <p className="text-sm font-semibold text-foreground">Appointment: {displayDate(opportunity.appointmentAt)}</p>
                  <p className="mt-1 text-sm text-foreground-muted">{opportunity.appointmentDetails}</p>
                  <form
                    className="mt-4 flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void update(opportunity, {
                        action: "complete",
                        componentType: String(data.get("componentType") || ""),
                        unitsCollected: Number(data.get("unitsCollected")),
                      }, "Donation completed and added to donor history.");
                    }}
                  >
                    <label className="grid gap-1 text-xs font-medium text-foreground-muted">Component<select name="componentType" className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground">{components.map((component) => <option key={component} value={component}>{component}</option>)}</select></label>
                    <label className="grid gap-1 text-xs font-medium text-foreground-muted">Units collected<input name="unitsCollected" type="number" min={1} step={1} required className="h-10 w-32 rounded-lg border border-border-strong px-3 text-sm text-foreground" /></label>
                    <button disabled={savingId === opportunity.id} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">Confirm completed donation</button>
                  </form>
                </div>
              )}
              {["offered", "accepted", "scheduled"].includes(opportunity.status) && (
                <button
                  disabled={savingId === opportunity.id}
                  onClick={() => void update(opportunity, { action: "cancel", reason: "Cancelled by blood-bank staff." }, "Opportunity cancelled and donor notified.")}
                  className="mt-4 text-sm font-semibold text-danger disabled:opacity-50"
                >Cancel opportunity</button>
              )}
            </article>
          ))}</div>}
    </section>
  );
}
