"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { getBloodRequest, listAdminRequests } from "@/lib/bloodRequests";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { BloodRequest } from "@/types/domain";

const readable = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
function Status({ value }: { value: string }) {
  const tone = value === "emergency" ? "bg-red-50 text-danger" : value === "approved" || value === "fulfilled" ? "bg-green-50 text-success" : value === "rejected" || value === "cancelled" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{readable(value)}</span>;
}
function formatDateTime(value: unknown) {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  return "—";
}

export function AdminRequestQueue() {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urgency, setUrgency] = useState("");
  const [status, setStatus] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priority");

  useEffect(() => {
    listAdminRequests().then(setRequests).catch(() => setError("We could not load the request queue.")).finally(() => setLoading(false));
  }, []);

  const filtered = requests
    .filter((item) => (!urgency || item.urgency === urgency) && (!status || item.status === status) && (!bloodGroup || item.bloodGroup === bloodGroup) && (!search || `${item.id} ${item.hospitalId} ${item.patientName || item.caseId || item.patientId || ""}`.toLowerCase().includes(search.toLowerCase())))
    .sort((left, right) => sort === "neededBy" ? (left.neededBy?.toDate?.().getTime?.() || 0) - (right.neededBy?.toDate?.().getTime?.() || 0) : right.priority - left.priority);

  const emergencyCount = requests.filter((item) => item.urgency === "emergency").length;
  const counts: Array<[string, number]> = [["submitted", requests.filter((item) => item.status === "submitted").length], ["under_review", requests.filter((item) => item.status === "under_review").length], ["approved", requests.filter((item) => item.status === "approved").length], ["rejected", requests.filter((item) => item.status === "rejected").length], ["fulfilled", requests.filter((item) => item.status === "fulfilled").length]];

  if (loading) return <LoadingState title="Loading request queue" />;
  if (error) return <ErrorState description={error} />;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Request operations</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[1rem] border border-red-200 bg-red-50 p-5"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Emergency requests</p><p className="mt-2 text-2xl font-semibold text-danger">{emergencyCount}</p></div>
        {counts.map(([statusValue, count]) => <div key={statusValue} className="rounded-[1rem] border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">{readable(statusValue)}</p><p className="mt-2 text-2xl font-semibold text-primary">{count}</p></div>)}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, hospital, patient" className="h-11 min-w-64 rounded-lg border border-border-strong px-3 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All statuses</option>{["submitted", "under_review", "approved", "rejected", "fulfilled", "cancelled"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select>
        <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All urgency</option><option value="emergency">Emergency</option><option value="urgent">Urgent</option><option value="routine">Routine</option></select>
        <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All blood groups</option>{["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="priority">Sort by priority</option><option value="neededBy">Sort by needed-by</option></select>
      </div>
      {filtered.length === 0 ? <div className="mt-5"><EmptyState title="No requests in the queue" description="Operational requests will appear here when hospitals submit them." /></div> : <div className="mt-5 overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Request</th><th className="px-5 py-4">Hospital</th><th className="px-5 py-4">Patient / case</th><th className="px-5 py-4">Requirement</th><th className="px-5 py-4">Needed by</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Urgency</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((item) => <tr key={item.id} className={item.urgency === "emergency" ? "bg-red-50/40" : ""}><td className="px-5 py-4"><Link href={`/admin/requests/${item.id}`} className="font-semibold text-primary hover:underline">{item.id.slice(0, 8)}</Link></td><td className="px-5 py-4 text-foreground-muted">{item.hospitalId}</td><td className="px-5 py-4 text-foreground-muted">{item.patientName || item.caseId || item.patientId || "Not recorded"}</td><td className="px-5 py-4">{item.unitsRequested} × {item.bloodGroup} {readable(item.componentType)}</td><td className="px-5 py-4 text-foreground-muted">{formatDateTime(item.neededBy)}</td><td className="px-5 py-4 text-foreground-muted">{item.priority}</td><td className="px-5 py-4"><Status value={item.urgency} /></td><td className="px-5 py-4"><Status value={item.status} /></td></tr>)}</tbody></table></div>}
    </main>
  );
}

export function AdminDashboard() { return <AdminRequestQueue />; }

export function AdminRequestDetail() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getBloodRequest(params.requestId)])
      .then(async ([nextRequest]) => {
        setRequest(nextRequest);
        if (nextRequest) {
          const snapshot = await getDocs(query(collection(db, "bloodInventory"), where("bloodGroup", "==", nextRequest.bloodGroup)));
          setAvailable(snapshot.docs.reduce((sum, item) => sum + (item.data().status === "available" && item.data().componentType === nextRequest.componentType && (!nextRequest.rhFactor || item.data().rhFactor === nextRequest.rhFactor) ? Number(item.data().unitsAvailable || 0) : 0), 0));
        }
      })
      .catch(() => setError("This request could not be loaded."))
      .finally(() => setLoading(false));
  }, [params.requestId]);

  async function decide(action: "approve" | "reject") {
    if (!firebaseUser || !request) return;
    if (action === "approve" && available !== null && available < request.unitsRequested) { setError("Approval is blocked because available stock is insufficient."); return; }
    if (action === "reject" && !reason.trim()) { setError("A rejection reason is required."); return; }
    setSubmitting(true); setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/requests/decision", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requestId: request.id, action, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Decision failed.");
      setMessage(action === "approve" ? "Request approved and stock reserved." : "Request rejected.");
      router.refresh();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "The decision could not be submitted.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <LoadingState title="Loading request" />;
  if (error) return <ErrorState description={error} />;
  if (!request) return <EmptyState title="Request not found" description="This request is not available." />;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Admin review</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">{request.urgency === "emergency" ? "Emergency blood request" : "Blood request"}</h1>
        </div>
        <Status value={request.urgency} />
      </div>
      <div className="mt-8 rounded-[1rem] border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Request</p><p className="mt-2 text-lg font-semibold text-foreground">{request.id}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Hospital</p><p className="mt-2 text-lg font-semibold text-foreground">{request.hospitalId}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Patient</p><p className="mt-2 text-lg font-semibold text-foreground">{request.patientName || request.caseId || request.patientId || "Not recorded"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Operational priority</p><p className="mt-2 text-lg font-semibold text-foreground">{request.priority}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Requirement</p><p className="mt-2 text-lg font-semibold text-foreground">{request.unitsRequested} × {request.bloodGroup} {readable(request.componentType)}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Needed by</p><p className="mt-2 text-lg font-semibold text-foreground">{formatDateTime(request.neededBy)}</p></div>
        </div>
        <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Matching inventory</p><p className="mt-2 text-lg font-semibold text-foreground">{available ?? 0} units available</p></div>
        {request.notes && <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Notes</p><p className="mt-2 text-sm leading-6 text-foreground-muted">{request.notes}</p></div>}
        {message && <p className="mt-6 text-sm text-success">{message}</p>}
        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => decide("approve")} disabled={submitting} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Approve</button><button type="button" onClick={() => decide("reject")} disabled={submitting} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-60">Reject</button><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required for rejection)" className="h-11 min-w-[220px] rounded-lg border border-border-strong bg-surface px-3 text-sm" /></div>
      </div>
    </main>
  );
}
