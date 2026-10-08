"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import type { FulfillmentAllocation, RequestStatus, RequestUrgency } from "@/types/domain";

type FulfillmentRequest = {
  id: string;
  hospitalId: string;
  hospitalDisplayName: string;
  patientName?: string;
  caseId?: string;
  bloodGroup: string;
  rhFactor?: string;
  componentType: string;
  unitsRequested: number;
  unitsFulfilled: number;
  urgency: RequestUrgency;
  priority: number;
  status: RequestStatus;
  neededBy: string | null;
  notes?: string;
  unitsDispatched: number;
  allocations: FulfillmentAllocation[];
};

function label(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function allocationUnits(request: FulfillmentRequest, select: (allocation: FulfillmentAllocation) => number) {
  return request.allocations.reduce((total, allocation) => total + select(allocation), 0);
}

function assignedUnits(request: FulfillmentRequest) {
  return allocationUnits(request, (allocation) => allocation.unitsReserved);
}

function unitsAwaitingDispatch(request: FulfillmentRequest) {
  return allocationUnits(
    request,
    (allocation) => allocation.unitsReserved - allocation.unitsDispatched,
  );
}

function FulfillmentCard({
  request,
  children,
}: {
  request: FulfillmentRequest;
  children?: ReactNode;
}) {
  return (
    <article className={`rounded-[1rem] border bg-surface p-5 shadow-xs ${request.urgency === "emergency" ? "border-red-300 ring-1 ring-red-100" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            {request.urgency === "emergency" ? "Emergency request" : "Blood request"}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            {request.bloodGroup} {label(request.componentType)} · {assignedUnits(request)} assigned units
          </h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.urgency === "emergency" ? "bg-red-50 text-danger" : request.urgency === "urgent" ? "bg-amber-50 text-warning" : "bg-green-50 text-success"}`}>
          {label(request.urgency)}
        </span>
      </div>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-foreground-subtle">Hospital</dt><dd className="mt-1 font-medium text-foreground">{request.hospitalDisplayName}</dd></div>
        <div><dt className="text-foreground-subtle">Patient / case</dt><dd className="mt-1 font-medium text-foreground">{request.patientName || request.caseId || "Not recorded"}</dd></div>
        <div><dt className="text-foreground-subtle">Requested</dt><dd className="mt-1 font-medium text-foreground">{request.unitsRequested} units</dd></div>
        <div><dt className="text-foreground-subtle">Needed by</dt><dd className="mt-1 font-medium text-foreground">{request.neededBy ? new Date(request.neededBy).toLocaleString() : "Not recorded"}</dd></div>
        <div><dt className="text-foreground-subtle">Workflow status</dt><dd className="mt-1 font-medium text-foreground">{label(request.status)}</dd></div>
        <div><dt className="text-foreground-subtle">Dispatched / received</dt><dd className="mt-1 font-medium text-foreground">{request.unitsDispatched} / {request.unitsFulfilled} units</dd></div>
      </dl>
      {request.notes && <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted">{request.notes}</p>}
      {children && <div className="mt-5 border-t border-border pt-4">{children}</div>}
    </article>
  );
}

function useFulfillmentRequests() {
  const { firebaseUser } = useAuth();
  const [requests, setRequests] = useState<FulfillmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRequestId, setBusyRequestId] = useState("");

  const reload = useCallback(async () => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    const response = await fetch("/api/blood-bank/requests", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await response.json() as { requests?: FulfillmentRequest[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Blood-bank requests could not be loaded.");
    setRequests(body.requests || []);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;
    (async () => {
      try {
        await reload();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Blood-bank requests could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [firebaseUser, reload]);

  async function act(requestId: string, action: "prepare" | "dispatch", units?: number) {
    if (!firebaseUser) return;
    setBusyRequestId(requestId);
    setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/blood-bank/requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, units }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The fulfillment update could not be saved.");
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The fulfillment update could not be saved.");
    } finally {
      setBusyRequestId("");
    }
  }

  return { requests, loading, error, busyRequestId, act };
}

export function BloodBankRequestsPage() {
  const { requests, loading, error, busyRequestId, act } = useFulfillmentRequests();
  if (loading) return <LoadingState title="Loading assigned requests" />;
  if (error && requests.length === 0) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState title="Requests unavailable" description={error} /></main>;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood-bank operations</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Assigned blood requests</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Review admin-reserved requests assigned to your organization and accept preparation responsibility.</p>
      {error && <p role="alert" className="mt-5 text-sm text-danger">{error}</p>}
      {requests.length === 0 ? (
        <div className="mt-8"><EmptyState title="No assigned requests" description="Requests reserved and assigned to your blood bank will appear here." /></div>
      ) : (
        <div className="mt-8 grid gap-4">
          {requests.map((request) => {
            const canPrepare = request.allocations.some((allocation) => allocation.status === "reserved");
            const ownDispatch = request.allocations.some((allocation) => allocation.unitsDispatched > 0);
            return (
              <FulfillmentCard key={request.id} request={request}>
                {canPrepare ? (
                  <button
                    type="button"
                    disabled={busyRequestId === request.id}
                    onClick={() => act(request.id, "prepare")}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busyRequestId === request.id ? "Saving…" : "Accept & prepare"}
                  </button>
                ) : (
                  <p className="text-sm font-medium text-success">
                    {ownDispatch
                      ? "Your dispatch is recorded. Check Distribution for any remaining reserved units."
                      : "Preparation accepted. Manage dispatch in Distribution."}
                  </p>
                )}
              </FulfillmentCard>
            );
          })}
        </div>
      )}
    </main>
  );
}

export function BloodBankDistributionPage() {
  const { requests, loading, error, busyRequestId, act } = useFulfillmentRequests();
  const dispatchable = requests.filter((request) =>
    request.allocations.some((allocation) => allocation.status !== "reserved"),
  );
  if (loading) return <LoadingState title="Loading dispatch queue" />;
  if (error && requests.length === 0) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState title="Distribution unavailable" description={error} /></main>;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood-bank operations</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Prepare & dispatch</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Record only units physically dispatched from reservations assigned to your organization. Dispatch does not count as hospital receipt.</p>
      {error && <p role="alert" className="mt-5 text-sm text-danger">{error}</p>}
      {dispatchable.length === 0 ? (
        <div className="mt-8"><EmptyState title="No units awaiting dispatch" description="Accept an assigned request for preparation before recording its dispatch." /></div>
      ) : (
        <div className="mt-8 grid gap-4">
          {dispatchable.map((request) => {
            const remaining = unitsAwaitingDispatch(request);
            return (
              <FulfillmentCard key={request.id} request={request}>
                {remaining > 0 ? (
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      const units = Number(new FormData(event.currentTarget).get("units"));
                      void act(request.id, "dispatch", units);
                    }}
                  >
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Units to dispatch
                      <input required type="number" min={1} max={remaining} step={1} name="units" className="h-11 w-40 rounded-lg border border-border-strong px-3" />
                    </label>
                    <p className="pb-3 text-sm text-foreground-muted">{remaining} reserved units remain to dispatch.</p>
                    <button type="submit" disabled={busyRequestId === request.id} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
                      {busyRequestId === request.id ? "Recording…" : "Record dispatch"}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm font-medium text-success">All units assigned to this blood bank have been dispatched. Awaiting hospital receipt confirmation.</p>
                )}
              </FulfillmentCard>
            );
          })}
        </div>
      )}
    </main>
  );
}
