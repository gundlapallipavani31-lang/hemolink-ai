"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { createBloodRequest, getBloodRequest, listHospitalRequests, listRequestEvents, type BloodRequestInput } from "@/lib/bloodRequests";
import { listPatients } from "@/lib/patients";
import type { BloodComponent, BloodGroup, Patient, RequestUrgency, BloodRequest, RhFactor } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const urgencies: RequestUrgency[] = ["routine", "urgent", "emergency"];
const priorityOrder: Record<RequestUrgency, number> = { routine: 1, urgent: 2, emergency: 3 };
const readable = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

function formatDateTime(value: unknown) {
  if (!value) return "—";
  if (value instanceof Date) {
    return value.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return "—";
}

function RequestStatus({ status }: { status: string }) {
  const tone = status === "approved" || status === "fulfilled" ? "bg-green-50 text-success" : status === "rejected" || status === "cancelled" ? "bg-red-50 text-danger" : status === "needs_information" ? "bg-orange-50 text-orange-800" : "bg-amber-50 text-warning";
  const label = status === "submitted" ? "Awaiting review" : status === "needs_information" ? "Information required" : readable(status);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function priorityLabel(priority: number) {
  if (priority >= 3) return "Critical";
  if (priority >= 2) return "High";
  return "Routine";
}

export function HospitalRequestList() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");

  useEffect(() => {
    const organizationId = userProfile?.organizationId;
    if (!organizationId) {
      return;
    }

    let active = true;

    const loadRequests = async () => {
      setLoading(true);
      try {
        const nextRequests = await listHospitalRequests(organizationId);
        if (active) {
          setRequests(nextRequests);
        }
      } catch {
        if (active) {
          setError("We could not load blood requests.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRequests();

    return () => {
      active = false;
    };
  }, [userProfile?.organizationId]);

  const filtered = useMemo(
    () =>
      [...requests]
        .filter((request) => (!status || request.status === status) && (!urgency || request.urgency === urgency))
        .sort(
          (left, right) =>
            priorityOrder[right.urgency] - priorityOrder[left.urgency] ||
            (right.neededBy?.toDate?.().getTime?.() || 0) - (left.neededBy?.toDate?.().getTime?.() || 0),
        ),
    [requests, status, urgency],
  );

  if (loading) return <LoadingState title="Loading blood requests" />;
  if (error) return <ErrorState description={error} />;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Hospital requests</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">Blood requests</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/hospital/requests/emergency" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-danger">Emergency Blood Request</Link>
          <Link href="/hospital/requests/new" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Create request</Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-border bg-surface p-5">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm">
          <option value="">All statuses</option>
          {['submitted', 'under_review', 'needs_information', 'approved', 'preparing', 'dispatched', 'partially_fulfilled', 'rejected', 'cancelled', 'fulfilled'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
        </select>
        <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm">
          <option value="">All urgency</option>
          {urgencies.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5"><EmptyState title="No blood requests yet" description="Requests created for your hospital organization will appear here." /></div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-225 text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle">
              <tr>
                <th className="px-5 py-4">Request</th>
                <th className="px-5 py-4">Patient / case</th>
                <th className="px-5 py-4">Requirement</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Urgency</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Needed by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((request) => (
                <tr key={request.id} className={request.urgency === "emergency" ? "bg-red-50/40" : ""}>
                  <td className="px-5 py-4"><Link href={`/hospital/requests/${request.id}`} className="font-semibold text-primary hover:underline">{request.id.slice(0, 8)}</Link></td>
                  <td className="px-5 py-4 text-foreground-muted">{request.patientName || request.caseId || "Not recorded"}</td>
                  <td className="px-5 py-4 text-foreground">{request.unitsRequested} × {request.bloodGroup} {readable(request.componentType)}</td>
                  <td className="px-5 py-4 text-foreground-muted">{priorityLabel(request.priority)}</td>
                  <td className="px-5 py-4 capitalize text-foreground-muted"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.urgency === "emergency" ? "bg-red-50 text-danger" : request.urgency === "urgent" ? "bg-amber-50 text-warning" : "bg-green-50 text-success"}`}>{request.urgency}</span></td>
                  <td className="px-5 py-4"><RequestStatus status={request.status} /></td>
                  <td className="px-5 py-4 text-foreground-muted">{formatDateTime(request.neededBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function HospitalRequestForm() {
  const { userProfile, firebaseUser } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userProfile?.organizationId) return;
    listPatients(userProfile.organizationId).then(setPatients).catch(() => setError("Patients could not be loaded."));
  }, [userProfile?.organizationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !userProfile?.organizationId) return;
    const data = new FormData(event.currentTarget);
    const units = Number(data.get("unitsRequested"));
    const neededBy = new Date(String(data.get("neededBy")));
    if (!Number.isInteger(units) || units <= 0) { setError("Units requested must be a positive whole number."); return; }
    if (Number.isNaN(neededBy.getTime())) { setError("Enter a valid needed-by date."); return; }
    const input: BloodRequestInput = {
      patientId: String(data.get("patientId") || "") || undefined,
      bloodGroup: String(data.get("bloodGroup")) as BloodGroup,
      rhFactor: (String(data.get("rhFactor") || "") as RhFactor) || undefined,
      componentType: String(data.get("componentType")) as BloodComponent,
      unitsRequested: units,
      urgency: String(data.get("urgency")) as RequestUrgency,
      neededBy,
      notes: String(data.get("notes") || "").trim() || undefined,
    };
    setSaving(true); setError("");
    try {
      const request = await createBloodRequest(input);
      router.push(`/hospital/requests/${request.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The request could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Hospital requests</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Create blood request</h1>
      <p className="mt-4 text-sm leading-6 text-foreground-muted">Requests are submitted for authorized review. Stock is never changed by hospital users.</p>
      <div className="mt-6"><Link href="/hospital/requests/emergency" className="inline-flex rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-danger">Need an emergency request instead?</Link></div>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Patient<select required name="patientId" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.displayName || patient.externalReference || patient.id}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Blood group<select required name="bloodGroup" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select blood group</option>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">RH factor<select name="rhFactor" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Not specified</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Component<select required name="componentType" className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select component</option>{components.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Units required<input required type="number" min={1} name="unitsRequested" className="h-12 rounded-lg border border-border-strong px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Urgency<select required name="urgency" defaultValue="urgent" className="h-12 rounded-lg border border-border-strong bg-surface px-3">{urgencies.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Needed by<input required type="datetime-local" name="neededBy" className="h-12 rounded-lg border border-border-strong px-3" /></label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Additional notes<textarea name="notes" rows={4} className="rounded-lg border border-border-strong px-3 py-3" placeholder="Operational context only." /></label>
        {error && <p role="alert" className="sm:col-span-2 text-sm text-danger">{error}</p>}
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Submitting…" : "Submit request"}</button></div>
      </form>
    </main>
  );
}

export function HospitalEmergencyRequestForm() {
  const { userProfile, firebaseUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !userProfile?.organizationId) {
      router.push("/login");
      return;
    }
    const data = new FormData(event.currentTarget);
    const units = Number(data.get("unitsRequested"));
    const neededBy = new Date(String(data.get("neededBy")));
    const patientName = String(data.get("patientName") || "").trim();
    const caseId = String(data.get("caseId") || "").trim();
    if (!patientName) { setError("Patient name is required for emergency requests."); return; }
    if (!caseId) { setError("Please include the patient reference or case ID."); return; }
    if (!Number.isInteger(units) || units <= 0) { setError("Units requested must be a positive whole number."); return; }
    if (Number.isNaN(neededBy.getTime())) { setError("Enter a valid needed-by date and time."); return; }
    const input: BloodRequestInput = {
      patientName,
      caseId,
      bloodGroup: String(data.get("bloodGroup")) as BloodGroup,
      componentType: String(data.get("componentType")) as BloodComponent,
      unitsRequested: units,
      urgency: "emergency",
      neededBy,
      notes: String(data.get("notes") || "").trim() || undefined,
    };
    setSaving(true); setError("");
    try {
      const request = await createBloodRequest(input);
      router.push(`/hospital/requests/${request.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The emergency request could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Emergency response</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Emergency Blood Request</h1>
      <p className="mt-4 text-sm leading-6 text-foreground-muted">Time-sensitive requests are routed into the same review workflow and escalated by operational priority.</p>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border border-red-200 bg-red-50/40 p-6 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Patient name<input required name="patientName" placeholder="Patient name" className="h-12 rounded-lg border border-red-200 bg-white px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Patient reference / case ID<input required name="caseId" placeholder="Case ID" className="h-12 rounded-lg border border-red-200 bg-white px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Hospital<input readOnly value={userProfile?.name || "Hospital organization"} className="h-12 rounded-lg border border-red-200 bg-white px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Blood group<select required name="bloodGroup" className="h-12 rounded-lg border border-red-200 bg-white px-3"><option value="">Select blood group</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Component<select required name="componentType" className="h-12 rounded-lg border border-red-200 bg-white px-3"><option value="">Select component</option>{components.map((component) => <option key={component} value={component}>{readable(component)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Units required<input required type="number" min={1} name="unitsRequested" className="h-12 rounded-lg border border-red-200 bg-white px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Blood needed by<input required type="datetime-local" name="neededBy" className="h-12 rounded-lg border border-red-200 bg-white px-3" /></label>
        <div className="rounded-xl border border-red-200 bg-red-100/60 p-4 text-sm text-red-900 sm:col-span-2"><p className="font-semibold">Operational priority</p><p className="mt-1">Emergency requests are reviewed using the existing priority model and escalation route.</p></div>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Additional notes<textarea name="notes" rows={4} className="rounded-lg border border-red-200 bg-white px-3 py-3" placeholder="Operational details only." /></label>
        {error && <p role="alert" className="sm:col-span-2 text-sm text-danger">{error}</p>}
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className="h-12 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Submitting…" : "Submit Emergency Request"}</button></div>
      </form>
    </main>
  );
}

export function HospitalRequestDetail() {
  const params = useParams<{ requestId: string }>();
  const { firebaseUser } = useAuth();
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState("");
  const [responseSent, setResponseSent] = useState(false);
  const [responding, setResponding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [receiptMessage, setReceiptMessage] = useState("");
  const [receiptSaving, setReceiptSaving] = useState(false);

  useEffect(() => {
    getBloodRequest(params.requestId)
      .then(async (nextRequest) => {
        setRequest(nextRequest);
        if (nextRequest) {
          const nextEvents = await listRequestEvents(nextRequest.id);
          setEvents(nextEvents);
        }
      })
      .catch(() => setError("This request could not be loaded."))
      .finally(() => setLoading(false));
  }, [params.requestId]);

  async function confirmReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !request) return;
    const form = event.currentTarget;
    const units = Number(new FormData(form).get("units"));
    const outstanding = Math.max(0, Number(request.unitsDispatched || 0) - request.unitsFulfilled);
    if (!Number.isInteger(units) || units <= 0 || units > outstanding) {
      setReceiptError(`Enter a positive whole number up to ${outstanding} dispatched units.`);
      return;
    }
    setReceiptSaving(true);
    setReceiptError("");
    setReceiptMessage("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/hospital/requests/receipt", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, units }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Receipt confirmation could not be saved.");
      const [updatedRequest, updatedEvents] = await Promise.all([
        getBloodRequest(request.id),
        listRequestEvents(request.id),
      ]);
      setRequest(updatedRequest);
      setEvents(updatedEvents);
      setReceiptMessage("Receipt quantity recorded.");
      form.reset();
    } catch (reason) {
      setReceiptError(reason instanceof Error ? reason.message : "Receipt confirmation could not be saved.");
    } finally {
      setReceiptSaving(false);
    }
  }

  async function submitInformationResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !request) {
      setResponseError("Sign in with your hospital account to respond.");
      return;
    }
    if (responseText.trim().length < 2) {
      setResponseError("Enter a response before submitting.");
      return;
    }
    setResponding(true);
    setResponseError("");
    setResponseSent(false);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/hospital/requests/respond", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, message: responseText }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your response could not be submitted.");
      const [updatedRequest, updatedEvents] = await Promise.all([
        getBloodRequest(request.id),
        listRequestEvents(request.id),
      ]);
      setRequest(updatedRequest);
      setEvents(updatedEvents);
      setResponseText("");
      setResponseSent(true);
    } catch (submitError) {
      setResponseError(submitError instanceof Error ? submitError.message : "Your response could not be submitted.");
    } finally {
      setResponding(false);
    }
  }

  if (loading) return <LoadingState title="Loading request" />;
  if (error && !request) return <ErrorState description={error} />;
  if (!request) return <EmptyState title="Request not found" description="This request is not available." />;

  const statusText = request.status === "submitted" ? "Awaiting review" : request.status === "needs_information" ? "Information required" : readable(request.status);
  const reasonText = request.urgency === "emergency" ? "Limited matching inventory and short time-to-needed-by." : request.urgency === "urgent" ? "Inventory is constrained and the time window is narrow." : "Operationally routine with standard review.";
  const unitsDispatched = request.unitsDispatched || 0;
  const unitsAwaitingReceipt = Math.max(
    0,
    Math.min(unitsDispatched - request.unitsFulfilled, request.unitsRequested - request.unitsFulfilled),
  );
  const progressSteps = ["submitted", "approved", "preparing", "dispatched", "fulfilled"];
  const progressIndex = request.status === "fulfilled"
    ? 4
    : request.status === "partially_fulfilled" || request.status === "dispatched"
      ? 3
      : request.status === "preparing"
        ? 2
        : ["approved"].includes(request.status)
          ? 1
          : 0;
  const informationEvents = events.filter((event) => event.eventType === "information_requested");
  const latestInformationEvent = informationEvents[informationEvents.length - 1];
  const informationMetadata = latestInformationEvent && typeof latestInformationEvent.metadata === "object" && latestInformationEvent.metadata !== null
    ? latestInformationEvent.metadata as Record<string, unknown>
    : {};
  const publicEventLabels: Record<string, string> = {
    created: "Request submitted",
    submitted: "Request submitted",
    acknowledged: "Acknowledged for review",
    review_message: "Review update",
    information_requested: "Information requested",
    hospital_response: "Hospital response received",
    reviewed: "Request reviewed",
    approved: "Request approved",
    rejected: "Request rejected",
    reserved: "Stock reserved",
    dispatched: "Request dispatched",
    received: "Receipt confirmed",
    fulfilled: "Request fulfilled",
    cancelled: "Request cancelled",
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">{request.urgency === "emergency" ? "Emergency Blood Request" : "Blood request"}</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">{request.urgency === "emergency" ? "Emergency Blood Request" : "Blood request"}</h1>
          </div>
          <RequestStatus status={request.status} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Patient</p><p className="mt-2 text-lg font-semibold text-foreground">{request.patientName || request.patientId || "Patient not recorded"}</p></div>
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Case ID</p><p className="mt-2 text-lg font-semibold text-foreground">{request.caseId || request.id.slice(0, 8)}</p></div>
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Blood group</p><p className="mt-2 text-lg font-semibold text-foreground">{request.bloodGroup}</p></div>
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Component</p><p className="mt-2 text-lg font-semibold text-foreground">{readable(request.componentType)}</p></div>
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Units</p><p className="mt-2 text-lg font-semibold text-foreground">{request.unitsRequested}</p></div>
          <div className="rounded-lg border border-border bg-surface-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Needed by</p><p className="mt-2 text-lg font-semibold text-foreground">{formatDateTime(request.neededBy)}</p></div>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-surface-muted p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Status</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{statusText}</p>
          {request.acknowledgedAt && <p className="mt-2 text-sm text-foreground-muted">Acknowledged for review on {formatDateTime(request.acknowledgedAt)}.</p>}
          <p className="mt-5 text-xs uppercase tracking-[0.12em] text-foreground-subtle">Operational Priority</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{priorityLabel(request.priority)}</p>
          {request.urgency === "emergency" && <p className="mt-4 text-sm leading-6 text-foreground-muted">{reasonText}</p>}
        </div>

        <section className="mt-6 rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Fulfillment progress</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-5">
            {progressSteps.map((step, index) => (
              <li key={step} className={`rounded-lg border p-3 text-sm ${index <= progressIndex ? "border-primary/30 bg-soft-rose/40 text-primary" : "border-border bg-surface-muted text-foreground-subtle"}`}>
                <span className="block text-xs uppercase tracking-widest">{index < progressIndex ? "Complete" : index === progressIndex ? "Current" : "Next"}</span>
                <span className="mt-1 block font-semibold">{readable(step)}</span>
              </li>
            ))}
          </ol>
          {request.status === "partially_fulfilled" && <p className="mt-4 text-sm font-medium text-warning">Partial receipt confirmed: {request.unitsFulfilled} of {request.unitsRequested} requested units.</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-muted p-4"><p className="text-xs uppercase tracking-widest text-foreground-subtle">Dispatched</p><p className="mt-1 text-lg font-semibold text-foreground">{unitsDispatched} / {request.unitsRequested} units</p></div>
            <div className="rounded-lg bg-surface-muted p-4"><p className="text-xs uppercase tracking-widest text-foreground-subtle">Received and confirmed</p><p className="mt-1 text-lg font-semibold text-foreground">{request.unitsFulfilled} / {request.unitsRequested} units</p></div>
          </div>
          {unitsAwaitingReceipt > 0 && ["dispatched", "partially_fulfilled"].includes(request.status) && (
            <form onSubmit={confirmReceipt} className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
              <label className="grid gap-1.5 text-sm font-medium">Confirm units received
                <input required type="number" min={1} max={unitsAwaitingReceipt} step={1} name="units" className="h-11 w-44 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <p className="pb-3 text-sm text-foreground-muted">{unitsAwaitingReceipt} dispatched units await confirmation.</p>
              <button type="submit" disabled={receiptSaving} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{receiptSaving ? "Saving…" : "Confirm receipt"}</button>
            </form>
          )}
          {receiptError && <p role="alert" className="mt-3 text-sm text-danger">{receiptError}</p>}
          {receiptMessage && <p role="status" className="mt-3 text-sm text-success">{receiptMessage}</p>}
        </section>

        {request.status === "needs_information" && (
          <section className="mt-8 rounded-xl border border-orange-200 bg-orange-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900">Hospital response required</p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">Additional information requested</h2>
            {typeof informationMetadata.message === "string" && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground-muted">{informationMetadata.message}</p>}
            <form onSubmit={submitInformationResponse} className="mt-5 grid gap-3">
              <label htmlFor="hospital-information-response" className="text-sm font-medium text-foreground">Your response</label>
              <textarea id="hospital-information-response" value={responseText} onChange={(inputEvent) => setResponseText(inputEvent.target.value)} maxLength={1000} rows={4} className="rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm" placeholder="Provide the requested operational details." required />
              {responseError && <p role="alert" className="text-sm text-danger">{responseError}</p>}
              {responseSent && <p role="status" className="text-sm text-success">Response received. The request is back under review.</p>}
              <button type="submit" disabled={responding || responseText.trim().length < 2} className="w-fit rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{responding ? "Sending response…" : "Submit response"}</button>
            </form>
          </section>
        )}

        {events.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">Request activity</h2>
            <ul className="mt-4 space-y-3">
              {events.map((event) => {
                const eventType = typeof event.eventType === "string" ? event.eventType : "updated";
                const metadata = typeof event.metadata === "object" && event.metadata !== null ? event.metadata as Record<string, unknown> : {};
                const publicMessage = ["review_message", "information_requested", "hospital_response"].includes(eventType)
                  && metadata.visibility === "hospital"
                  && typeof metadata.message === "string"
                  ? metadata.message
                  : "";
                return (
                  <li key={String(event.id)} className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground-muted">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-foreground">{publicEventLabels[eventType] || readable(eventType)}</span>
                      <time>{formatDateTime(event.createdAt)}</time>
                    </div>
                    {publicMessage && <p className="mt-2 whitespace-pre-wrap leading-6">{publicMessage}</p>}
                    {typeof event.actorUserId === "string" && <p className="mt-2 text-xs">Actor {event.actorUserId}</p>}
                    {typeof metadata.units === "number" && <p className="mt-2 text-xs">{metadata.units} units</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-8"><Link href="/hospital/requests" className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-primary">Back to requests</Link></div>
      </div>
    </main>
  );
}
