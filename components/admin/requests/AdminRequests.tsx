"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { getBloodRequest, listAdminRequests, listRequestEvents } from "@/lib/bloodRequests";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { operationalAvailableUnits } from "@/lib/inventoryAvailability";
import type { BloodRequest } from "@/types/domain";

const readable = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
function Status({ value }: { value: string }) {
  const tone = value === "emergency" ? "bg-red-50 text-danger" : value === "approved" || value === "fulfilled" ? "bg-green-50 text-success" : value === "rejected" || value === "cancelled" ? "bg-red-50 text-danger" : value === "needs_information" ? "bg-orange-50 text-orange-800" : "bg-amber-50 text-warning";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{readable(value)}</span>;
}
function formatDateTime(value: unknown) {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return "—";
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object" && value !== null) {
    if ("toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
    if ("toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
  }
  return null;
}

const activeRequestStatuses = ["submitted", "under_review", "needs_information"];

export function AdminRequestQueue() {
  const { firebaseUser } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urgency, setUrgency] = useState("");
  const [status, setStatus] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [search, setSearch] = useState("");
  const [triageFilter, setTriageFilter] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    listAdminRequests().then(setRequests).catch(() => setError("We could not load the request queue.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const isActionable = (item: BloodRequest) => activeRequestStatuses.includes(item.status);
  const isOverdue = (item: BloodRequest) => {
    const neededBy = timestampMillis(item.neededBy);
    return isActionable(item) && neededBy !== null && neededBy < now;
  };
  const filtered = requests
    .filter((item) => {
      const matchesTriage = !triageFilter
        || (triageFilter === "unacknowledged" && isActionable(item) && !item.acknowledgedAt)
        || (triageFilter === "assigned" && Boolean(firebaseUser?.uid) && item.ownerUserId === firebaseUser?.uid)
        || (triageFilter === "needs_information" && item.status === "needs_information")
        || (triageFilter === "overdue" && isOverdue(item));
      return matchesTriage
        && (!urgency || item.urgency === urgency)
        && (!status || item.status === status)
        && (!bloodGroup || item.bloodGroup === bloodGroup)
        && (!search || `${item.id} ${item.hospitalId} ${item.patientName || item.caseId || item.patientId || ""}`.toLowerCase().includes(search.toLowerCase()));
    })
    .sort((left, right) => {
      const dueAt = (item: BloodRequest) => timestampMillis(item.neededBy) ?? Number.MAX_SAFE_INTEGER;
      const category = (item: BloodRequest) => {
        if (isActionable(item) && item.urgency === "emergency") return 0;
        if (isActionable(item) && dueAt(item) <= now + 24 * 60 * 60 * 1000) return 1;
        if (isActionable(item) && !item.acknowledgedAt) return 2;
        return isActionable(item) ? 3 : 4;
      };
      const leftCategory = category(left);
      const rightCategory = category(right);
      if (leftCategory !== rightCategory) return leftCategory - rightCategory;
      if (leftCategory === 1) return dueAt(left) - dueAt(right);
      if (leftCategory === 2) return (timestampMillis(left.createdAt) ?? 0) - (timestampMillis(right.createdAt) ?? 0);
      return right.priority - left.priority || (timestampMillis(left.createdAt) ?? 0) - (timestampMillis(right.createdAt) ?? 0);
    });

  const emergencyCount = requests.filter((item) => isActionable(item) && item.urgency === "emergency").length;
  const counts: Array<[string, number]> = [
    ["submitted", requests.filter((item) => item.status === "submitted").length],
    ["under_review", requests.filter((item) => item.status === "under_review").length],
    ["needs_information", requests.filter((item) => item.status === "needs_information").length],
    ["approved", requests.filter((item) => item.status === "approved").length],
    ["preparing", requests.filter((item) => item.status === "preparing").length],
    ["dispatched", requests.filter((item) => item.status === "dispatched").length],
    ["partially_fulfilled", requests.filter((item) => item.status === "partially_fulfilled").length],
    ["rejected", requests.filter((item) => item.status === "rejected").length],
    ["fulfilled", requests.filter((item) => item.status === "fulfilled").length],
  ];

  if (loading) return <LoadingState title="Loading request queue" />;
  if (error) return <ErrorState description={error} />;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Request operations</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Actionable emergencies</p><p className="mt-2 text-2xl font-semibold text-danger">{emergencyCount}</p></div>
        {counts.map(([statusValue, count]) => <div key={statusValue} className="rounded-2xl border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">{readable(statusValue)}</p><p className="mt-2 text-2xl font-semibold text-primary">{count}</p></div>)}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, hospital, patient" className="h-11 min-w-64 rounded-lg border border-border-strong px-3 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All statuses</option>{["submitted", "under_review", "needs_information", "approved", "preparing", "dispatched", "partially_fulfilled", "rejected", "fulfilled", "cancelled"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select>
        <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All urgency</option><option value="emergency">Emergency</option><option value="urgent">Urgent</option><option value="routine">Routine</option></select>
        <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All blood groups</option>{["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={triageFilter} onChange={(event) => setTriageFilter(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All triage</option><option value="unacknowledged">Unacknowledged</option><option value="assigned">Assigned to me</option><option value="needs_information">Needs information</option><option value="overdue">Overdue</option></select>
      </div>
      {filtered.length === 0 ? <div className="mt-5"><EmptyState title="No requests in the queue" description="Operational requests will appear here when hospitals submit them." /></div> : <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full min-w-275 text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Request</th><th className="px-5 py-4">Hospital</th><th className="px-5 py-4">Patient / case</th><th className="px-5 py-4">Requirement</th><th className="px-5 py-4">Needed by</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Urgency</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Triage</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((item) => <tr key={item.id} className={item.urgency === "emergency" && isActionable(item) ? "bg-red-50/40" : ""}><td className="px-5 py-4"><Link href={`/admin/requests/${item.id}`} className="font-semibold text-primary hover:underline">{item.id.slice(0, 8)}</Link></td><td className="px-5 py-4 text-foreground-muted">{item.hospitalId}</td><td className="px-5 py-4 text-foreground-muted">{item.patientName || item.caseId || item.patientId || "Not recorded"}</td><td className="px-5 py-4">{item.unitsRequested} × {item.bloodGroup} {readable(item.componentType)}</td><td className="px-5 py-4 text-foreground-muted">{formatDateTime(item.neededBy)}</td><td className="px-5 py-4 text-foreground-muted">{item.priority}</td><td className="px-5 py-4"><Status value={item.urgency} /></td><td className="px-5 py-4"><Status value={item.status} /></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{isActionable(item) && !item.acknowledgedAt && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-warning">Unacknowledged</span>}{item.ownerUserId === firebaseUser?.uid && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-primary">Assigned to me</span>}{item.status === "needs_information" && <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800">Needs information</span>}{isOverdue(item) && <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-danger">Overdue</span>}</div></td></tr>)}</tbody></table></div>}
    </main>
  );
}

export function AdminDashboard() { return <AdminRequestQueue />; }

export function AdminRequestDetail() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [available, setAvailable] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getBloodRequest(params.requestId), listRequestEvents(params.requestId)])
      .then(async ([nextRequest, nextEvents]) => {
        setRequest(nextRequest);
        setEvents(nextEvents);
        if (nextRequest) {
          const snapshot = await getDocs(query(collection(db, "bloodInventory"), where("bloodGroup", "==", nextRequest.bloodGroup)));
          setAvailable(snapshot.docs.reduce((sum, item) => {
            const stock = item.data();
            return stock.componentType === nextRequest.componentType
              && (!nextRequest.rhFactor || stock.rhFactor === nextRequest.rhFactor)
              ? sum + operationalAvailableUnits(stock)
              : sum;
          }, 0));
        }
      })
      .catch(() => setError("This request could not be loaded."))
      .finally(() => setLoading(false));
  }, [params.requestId]);

  async function decide(action: "approve" | "reject") {
    if (!firebaseUser || !request) return;
    if (action === "approve" && available === null) { setError("Matching inventory could not be verified. Reload the request before approving."); return; }
    if (action === "approve" && available !== null && available < request.unitsRequested) { setError("Approval is blocked because available stock is insufficient."); return; }
    if (action === "reject" && !reason.trim()) { setError("A rejection reason is required."); return; }
    setSubmitting(true); setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/requests/decision", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requestId: request.id, action, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Decision failed.");
      setMessage(action === "approve" ? "Request approved and stock reserved." : "Request rejected.");
      const [updatedRequest, updatedEvents] = await Promise.all([
        getBloodRequest(request.id),
        listRequestEvents(request.id),
      ]);
      setRequest(updatedRequest);
      setEvents(updatedEvents);
      router.refresh();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "The decision could not be submitted.");
    } finally { setSubmitting(false); }
  }

  async function triage(action: "acknowledge" | "assign_to_me" | "review_message" | "request_information") {
    if (!firebaseUser || !request) return;
    if ((action === "review_message" || action === "request_information") && reviewMessage.trim().length < 5) {
      setError("Enter a hospital-visible message of at least 5 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/requests/decision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, action, message: reviewMessage }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The triage action could not be completed.");
      const labels = {
        acknowledge: "Request acknowledged for review.",
        assign_to_me: "Request assigned to you.",
        review_message: "Review message sent to the hospital.",
        request_information: "Information requested from the hospital.",
      };
      setMessage(labels[action]);
      if (action === "review_message" || action === "request_information") setReviewMessage("");
      const [updatedRequest, updatedEvents] = await Promise.all([
        getBloodRequest(request.id),
        listRequestEvents(request.id),
      ]);
      setRequest(updatedRequest);
      setEvents(updatedEvents);
      router.refresh();
    } catch (triageError) {
      setError(triageError instanceof Error ? triageError.message : "The triage action could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState title="Loading request" />;
  if (error && !request) return <ErrorState description={error} />;
  if (!request) return <EmptyState title="Request not found" description="This request is not available." />;
  const actionable = activeRequestStatuses.includes(request.status);
  const assignedToMe = request.ownerUserId === firebaseUser?.uid;
  const eventLabels: Record<string, string> = {
    acknowledged: "Request acknowledged",
    assigned: "Request assigned",
    review_message: "Review message",
    information_requested: "Information requested",
    hospital_response: "Hospital response received",
    reviewed: "Request reviewed",
    approved: "Request approved",
    rejected: "Request rejected",
    reserved: "Stock reserved",
    fulfilled: "Request fulfilled",
    dispatched: "Request dispatched",
    received: "Receipt confirmed",
    created: "Request created",
    submitted: "Request submitted",
    cancelled: "Request cancelled",
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Admin review</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">{request.urgency === "emergency" ? "Emergency blood request" : "Blood request"}</h1>
        </div>
        <Status value={request.urgency} />
      </div>
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Request</p><p className="mt-2 text-lg font-semibold text-foreground">{request.id}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Hospital</p><p className="mt-2 text-lg font-semibold text-foreground">{request.hospitalId}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Patient</p><p className="mt-2 text-lg font-semibold text-foreground">{request.patientName || request.caseId || request.patientId || "Not recorded"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Operational priority</p><p className="mt-2 text-lg font-semibold text-foreground">{request.priority}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Requirement</p><p className="mt-2 text-lg font-semibold text-foreground">{request.unitsRequested} × {request.bloodGroup} {readable(request.componentType)}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Needed by</p><p className="mt-2 text-lg font-semibold text-foreground">{formatDateTime(request.neededBy)}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Request status</p><p className="mt-2"><Status value={request.status} /></p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Review owner</p><p className="mt-2 text-sm font-semibold text-foreground">{assignedToMe ? "You" : request.ownerUserId || "Unassigned"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Acknowledged</p><p className="mt-2 text-sm font-semibold text-foreground">{request.acknowledgedAt ? formatDateTime(request.acknowledgedAt) : "Awaiting acknowledgement"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">First response</p><p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(request.firstResponseAt)}</p></div>
        </div>
        <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Matching inventory</p><p className="mt-2 text-lg font-semibold text-foreground">{available ?? 0} units available</p></div>
        {actionable && (
          <section className="mt-6 rounded-xl border border-border bg-surface-muted p-5">
            <h2 className="text-lg font-semibold text-foreground">Operational triage</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {request.status === "submitted" && <button type="button" onClick={() => triage("acknowledge")} disabled={submitting} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Acknowledge</button>}
              <button type="button" onClick={() => triage("assign_to_me")} disabled={submitting || assignedToMe || Boolean(request.ownerUserId)} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">{assignedToMe ? "Assigned to you" : request.ownerUserId ? "Owned by another administrator" : "Assign to me"}</button>
            </div>
            {request.status !== "needs_information" && (
              <div className="mt-5 grid gap-3">
                <label htmlFor="hospital-review-message" className="text-sm font-medium text-foreground">Hospital-visible review message</label>
                <textarea id="hospital-review-message" value={reviewMessage} onChange={(event) => setReviewMessage(event.target.value)} maxLength={1000} rows={3} className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm" placeholder="Share an operational update or explain what the hospital should provide." />
                <div className="flex flex-wrap gap-3">
                  {request.status === "under_review" && <button type="button" onClick={() => triage("review_message")} disabled={submitting || reviewMessage.trim().length < 5} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">Send review message</button>}
                  <button type="button" onClick={() => triage("request_information")} disabled={submitting || reviewMessage.trim().length < 5} className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-900 disabled:opacity-50">Request information</button>
                </div>
              </div>
            )}
            {["submitted", "under_review", "needs_information"].includes(request.status) && (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
                {["submitted", "under_review"].includes(request.status) && <button type="button" onClick={() => decide("approve")} disabled={submitting || available === null || available < request.unitsRequested} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button>}
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required for rejection)" className="h-11 min-w-55 rounded-lg border border-border-strong bg-surface px-3 text-sm" />
                <button type="button" onClick={() => decide("reject")} disabled={submitting || !reason.trim()} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">Reject</button>
              </div>
            )}
          </section>
        )}
        {request.notes && <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Notes</p><p className="mt-2 text-sm leading-6 text-foreground-muted">{request.notes}</p></div>}
        {message && <p className="mt-6 text-sm text-success">{message}</p>}
        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
        {events.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">Request activity</h2>
            <ol className="mt-4 space-y-3">
              {events.map((event) => {
                const eventType = typeof event.eventType === "string" ? event.eventType : "updated";
                const metadata = typeof event.metadata === "object" && event.metadata !== null ? event.metadata as Record<string, unknown> : {};
                const publicMessage = ["review_message", "information_requested", "hospital_response"].includes(eventType) && typeof metadata.message === "string" ? metadata.message : "";
                return (
                  <li key={String(event.id)} className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-semibold text-foreground">{eventLabels[eventType] || readable(eventType)}</p>
                      <time className="text-foreground-muted">{formatDateTime(event.createdAt)}</time>
                    </div>
                    {publicMessage && <p className="mt-2 whitespace-pre-wrap leading-6 text-foreground-muted">{publicMessage}</p>}
                    {typeof event.actorUserId === "string" && <p className="mt-2 text-xs text-foreground-subtle">Actor: {event.actorUserId}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
