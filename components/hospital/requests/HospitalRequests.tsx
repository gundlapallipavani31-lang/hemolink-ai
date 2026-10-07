"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { createBloodRequest, cancelBloodRequest, getBloodRequest, listHospitalRequests, listRequestEvents, type BloodRequestInput } from "@/lib/bloodRequests";
import { listPatients } from "@/lib/patients";
import type { BloodComponent, BloodGroup, Patient, RequestUrgency, BloodRequest, RhFactor } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const urgencies: RequestUrgency[] = ["routine", "urgent", "emergency"];
const readable = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

function RequestStatus({ status }: { status: string }) {
  const tone = status === "approved" || status === "fulfilled" ? "bg-green-50 text-success" : status === "rejected" || status === "cancelled" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{readable(status)}</span>;
}

export function HospitalRequestList() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  useEffect(() => {
    if (!userProfile?.organizationId) return;
    listHospitalRequests(userProfile.organizationId).then(setRequests).catch(() => setError("We could not load blood requests.")).finally(() => setLoading(false));
  }, [userProfile?.organizationId]);
  const filtered = requests.filter((request) => (!status || request.status === status) && (!urgency || request.urgency === urgency));
  if (loading) return <LoadingState title="Loading blood requests" />;
  if (error) return <ErrorState description={error} />;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Hospital requests</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Blood requests</h1></div><Link href="/hospital/requests/new" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Create request</Link></div><div className="mt-8 flex flex-wrap gap-3 rounded-[1rem] border border-border bg-surface p-5"><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All statuses</option>{["submitted", "under_review", "approved", "rejected", "cancelled", "fulfilled"].map((item) => <option key={item}>{item}</option>)}</select><select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All urgency</option>{urgencies.map((item) => <option key={item}>{item}</option>)}</select></div>{filtered.length === 0 ? <div className="mt-5"><EmptyState title="No blood requests yet" description="Requests created for your hospital organization will appear here." /></div> : <div className="mt-5 overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Request</th><th className="px-5 py-4">Requirement</th><th className="px-5 py-4">Urgency</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Needed by</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((request) => <tr key={request.id}><td className="px-5 py-4"><Link href={`/hospital/requests/${request.id}`} className="font-semibold text-primary hover:underline">{request.id.slice(0, 8)}</Link></td><td className="px-5 py-4 text-foreground">{request.unitsRequested} × {request.bloodGroup} {readable(request.componentType)}</td><td className="px-5 py-4 capitalize text-foreground-muted">{request.urgency}</td><td className="px-5 py-4"><RequestStatus status={request.status} /></td><td className="px-5 py-4 text-foreground-muted">{request.neededBy?.toDate().toLocaleDateString() || "—"}</td></tr>)}</tbody></table></div>}</main>;
}

export function HospitalRequestForm() {
  const { userProfile, firebaseUser } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (userProfile?.organizationId) listPatients(userProfile.organizationId).then(setPatients).catch(() => setError("Patients could not be loaded.")); }, [userProfile?.organizationId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser || !userProfile?.organizationId) return;
    const data = new FormData(event.currentTarget); const units = Number(data.get("unitsRequested")); const neededBy = new Date(String(data.get("neededBy")));
    if (!Number.isInteger(units) || units <= 0) { setError("Units requested must be a positive whole number."); return; }
    if (Number.isNaN(neededBy.getTime())) { setError("Enter a valid needed-by date."); return; }
    const input: BloodRequestInput = { patientId: String(data.get("patientId")), bloodGroup: String(data.get("bloodGroup")) as BloodGroup, rhFactor: String(data.get("rhFactor") || "") as RhFactor || undefined, componentType: String(data.get("componentType")) as BloodComponent, unitsRequested: units, urgency: String(data.get("urgency")) as RequestUrgency, neededBy, notes: String(data.get("notes") || "").trim() || undefined };
    setSaving(true); setError("");
    try { const request = await createBloodRequest(userProfile.organizationId, firebaseUser.uid, input); router.push(`/hospital/requests/${request.id}`); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "The request could not be created."); } finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Hospital requests</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Create blood request</h1><p className="mt-4 text-sm leading-6 text-foreground-muted">Requests are submitted for authorized review. Stock is never changed by hospital users.</p><form onSubmit={submit} className="mt-8 grid gap-5 rounded-[1rem] border border-border bg-surface p-6 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Patient<select required name="patientId" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.displayName || patient.externalReference || patient.id}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Blood group<select required name="bloodGroup" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select blood group</option>{groups.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">RH factor<select name="rhFactor" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Not specified</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label><label className="grid gap-2 text-sm font-medium">Component<select required name="componentType" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select component</option>{components.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Units required<input required min="1" step="1" type="number" name="unitsRequested" className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Urgency<select required name="urgency" className="h-12 rounded-lg border border-border-strong bg-surface px-3">{urgencies.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Needed by<input required type="date" name="neededBy" className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium sm:col-span-2">Notes<textarea name="notes" rows={4} className="rounded-lg border border-border-strong px-3 py-3" placeholder="Optional operational context" /></label>{error && <p role="alert" className="sm:col-span-2 text-sm text-danger">{error}</p>}<button disabled={saving || patients.length === 0} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Submitting…" : "Submit request"}</button></form></main>;
}

export function HospitalRequestDetail() {
  const params = useParams<{ requestId: string }>(); const { userProfile, firebaseUser } = useAuth(); const [request, setRequest] = useState<BloodRequest | null>(null); const [events, setEvents] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [cancelling, setCancelling] = useState(false);
  useEffect(() => { Promise.all([getBloodRequest(params.requestId), listRequestEvents(params.requestId)]).then(([nextRequest, nextEvents]) => { setRequest(nextRequest); setEvents(nextEvents); }).catch(() => setError("This request could not be loaded.")).finally(() => setLoading(false)); }, [params.requestId]);
  if (loading) return <LoadingState title="Loading request" />; if (error) return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>; if (!request || (userProfile?.organizationId && request.hospitalId !== userProfile.organizationId)) return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><EmptyState title="Request not found" /></main>;
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Request detail</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-semibold text-foreground">Blood request</h1><RequestStatus status={request.status} /></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{[["Requirement", `${request.unitsRequested} × ${request.bloodGroup} ${readable(request.componentType)}`], ["Urgency", request.urgency], ["Priority", String(request.priority)], ["Needed by", request.neededBy?.toDate().toLocaleDateString() || "—"], ["Fulfilled", `${request.unitsFulfilled} units`], ["Notes", request.notes || "No notes"]].map(([heading, value]) => <div key={heading} className="rounded-[1rem] border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">{heading}</p><p className="mt-2 font-semibold capitalize text-foreground">{value}</p></div>)}</div><section className="mt-8 rounded-[1rem] border border-border bg-surface p-6"><h2 className="font-semibold text-foreground">Request timeline</h2><div className="mt-4 space-y-3">{events.map((event) => <p key={String(event.id)} className="text-sm text-foreground-muted">{readable(String(event.eventType))}</p>)}</div></section>{["submitted", "under_review"].includes(request.status) && <button disabled={cancelling} onClick={async () => { if (!firebaseUser || !userProfile?.organizationId) return; setCancelling(true); try { await cancelBloodRequest(request.id, userProfile.organizationId, firebaseUser.uid); setRequest({ ...request, status: "cancelled" }); } catch { setError("This request could not be cancelled."); } finally { setCancelling(false); } }} className="mt-6 rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-danger disabled:opacity-60">{cancelling ? "Cancelling…" : "Cancel request"}</button>}</main>;
}
