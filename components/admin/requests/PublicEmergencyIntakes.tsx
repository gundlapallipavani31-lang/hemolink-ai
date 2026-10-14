"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { adminClientFetch } from "@/lib/adminClientFetch";

type IntakeStatus = "received" | "under_review" | "contacted" | "closed" | "unable_to_fulfill";
type Intake = {
  id: string;
  reference: string;
  requesterName: string;
  requesterPhone: string;
  bloodGroup: string;
  componentType: string;
  unitsNeeded: number;
  facilityName: string;
  locality: string;
  urgency: "routine" | "urgent" | "emergency";
  neededBy: string | null;
  note: string;
  status: IntakeStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

const nextStatuses: Record<IntakeStatus, IntakeStatus[]> = {
  received: ["under_review", "contacted", "closed", "unable_to_fulfill"],
  under_review: ["contacted", "closed", "unable_to_fulfill"],
  contacted: ["closed", "unable_to_fulfill"],
  closed: [],
  unable_to_fulfill: [],
};
const terminalStatuses: IntakeStatus[] = ["closed", "unable_to_fulfill"];
const readable = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

function statusLabel(status: IntakeStatus) {
  if (status === "received") return "Intake received";
  if (status === "contacted") return "Contacted / being coordinated";
  if (status === "unable_to_fulfill") return "Unable to fulfill";
  return readable(status);
}

function PublicEmergencyIntakesContent({
  firebaseUser,
}: {
  firebaseUser: ReturnType<typeof useAuth>["firebaseUser"];
}) {
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchIntakes = useCallback(async (cursor?: string) => {
    if (!firebaseUser) throw new Error("Administrator authentication is required.");
    const url = new URL("/api/admin/public-emergency-intakes", window.location.origin);
    if (cursor) url.searchParams.set("after", cursor);
    const result = await adminClientFetch<{ intakes?: Intake[]; nextCursor?: string | null }>(
      url,
      firebaseUser,
      { cache: "no-store" },
    );
    return { intakes: result.intakes || [], nextCursor: result.nextCursor || null };
  }, [firebaseUser]);

  useEffect(() => {
    let active = true;
    void fetchIntakes(pageHistory[pageHistory.length - 1])
      .then((result) => {
        if (active) {
          setIntakes(result.intakes);
          setNextCursor(result.nextCursor);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error
            ? reason.message
            : "Emergency intakes could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchIntakes, pageHistory]);

  async function updateStatus(intake: Intake, status: IntakeStatus) {
    if (!firebaseUser) return;
    setSavingId(intake.id);
    setError("");
    try {
      const result = await adminClientFetch<{ status: IntakeStatus }>(
        `/api/admin/public-emergency-intakes/${encodeURIComponent(intake.id)}`,
        firebaseUser,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      setIntakes((current) => current.map((item) =>
        item.id === intake.id
          ? { ...item, status: result.status, updatedAt: new Date().toISOString() }
          : item,
      ));
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : "The intake status could not be updated.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) return <section className="mt-12"><LoadingState title="Loading patient emergency intakes" /></section>;
  if (error && intakes.length === 0) {
    return (
      <section className="mt-12" aria-labelledby="public-intakes-title">
        <h2 id="public-intakes-title" className="mb-4 text-2xl font-semibold text-foreground">Patient emergency intakes</h2>
        <ErrorState title="Emergency intake queue unavailable" description={error} />
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-border pt-10" aria-labelledby="public-intakes-title">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Separate from operational requests</p>
      <h2 id="public-intakes-title" className="mt-2 text-2xl font-semibold text-foreground">Patient emergency intakes</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
        Private submissions from patients or attendants. Updating an intake does not approve a hospital request or reserve inventory.
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      {intakes.length === 0 ? (
        <div className="mt-5"><EmptyState title="No patient intakes received" description="Public submissions will appear here for authorized review." /></div>
      ) : (
        <div className="mt-6 grid gap-4">
          {intakes.map((intake) => {
            const terminal = terminalStatuses.includes(intake.status);
            return (
              <article key={intake.id} className={`rounded-2xl border bg-surface p-5 shadow-xs ${intake.urgency === "emergency" ? "border-red-200" : "border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-subtle">
                      {intake.urgency} · {intake.bloodGroup} {readable(intake.componentType)} · {intake.unitsNeeded} units
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">{intake.facilityName}</h3>
                    <p className="mt-1 text-sm text-foreground-muted">{intake.locality} · Needed by {formatDate(intake.neededBy)}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-warning">{statusLabel(intake.status)}</span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-foreground-subtle">Requester</dt><dd className="mt-1 font-medium text-foreground">{intake.requesterName}</dd></div>
                  <div><dt className="text-foreground-subtle">Contact phone</dt><dd className="mt-1"><a href={`tel:${intake.requesterPhone}`} className="font-medium text-primary underline">{intake.requesterPhone}</a></dd></div>
                  <div><dt className="text-foreground-subtle">Received</dt><dd className="mt-1 text-foreground">{formatDate(intake.createdAt)}</dd></div>
                  {intake.note && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-foreground-subtle">Coordination note</dt><dd className="mt-1 whitespace-pre-wrap text-foreground">{intake.note}</dd></div>}
                </dl>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <label htmlFor={`intake-status-${intake.id}`} className="text-sm font-medium text-foreground">Review status</label>
                  <select
                    id={`intake-status-${intake.id}`}
                    value={intake.status}
                    disabled={savingId === intake.id || terminal}
                    onChange={(event) => void updateStatus(intake, event.target.value as IntakeStatus)}
                    className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm disabled:opacity-60"
                  >
                    <option value={intake.status}>{statusLabel(intake.status)}</option>
                    {nextStatuses[intake.status].map((status) => (
                      <option key={status} value={status}>{statusLabel(status)}</option>
                    ))}
                  </select>
                  {savingId === intake.id && <span role="status" className="text-sm text-foreground-muted">Saving status…</span>}
                  <span className="text-xs text-foreground-subtle">Reference: {intake.reference}</span>
                </div>
                <p className="mt-2 text-xs text-foreground-subtle">Last updated {formatDate(intake.updatedAt)}</p>
              </article>
            );
          })}
        </div>
      )}
      <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Emergency intake pages">
        <button
          type="button"
          disabled={loading || pageHistory.length === 0}
          onClick={() => {
            setError("");
            setIntakes([]);
            setLoading(true);
            setPageHistory((history) => history.slice(0, -1));
          }}
          className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-sm text-foreground-muted">Page {pageHistory.length + 1} · up to 50 requests</p>
        <button
          type="button"
          disabled={loading || !nextCursor}
          onClick={() => {
            if (!nextCursor) return;
            setError("");
            setIntakes([]);
            setLoading(true);
            setPageHistory((history) => [...history, nextCursor]);
          }}
          className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
        >
          Next
        </button>
      </nav>
    </section>
  );
}

export function PublicEmergencyIntakes() {
  const { firebaseUser } = useAuth();
  return <PublicEmergencyIntakesContent key={firebaseUser?.uid || "signed-out"} firebaseUser={firebaseUser} />;
}
