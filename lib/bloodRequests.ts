import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type {
  BloodComponent,
  BloodGroup,
  BloodRequest,
  RequestUrgency,
  RhFactor,
} from "@/types/domain";

export type BloodRequestInput = {
  patientId?: string;
  patientName?: string;
  caseId?: string;
  hospitalName?: string;
  bloodGroup: BloodGroup;
  rhFactor?: RhFactor;
  componentType: BloodComponent;
  unitsRequested: number;
  urgency: RequestUrgency;
  neededBy: Date;
  notes?: string;
};

export function priorityForUrgency(urgency: RequestUrgency) {
  return urgency === "emergency" ? 3 : urgency === "urgent" ? 2 : 1;
}

function toRequest(id: string, data: Record<string, unknown>): BloodRequest {
  return { ...data, id } as BloodRequest;
}

export async function listHospitalRequests(hospitalId: string) {
  const snapshot = await getDocs(
    query(collection(db, "bloodRequests"), where("hospitalId", "==", hospitalId)),
  );
  return snapshot.docs.map((item) => toRequest(item.id, item.data()));
}

export async function listAdminRequests() {
  const snapshot = await getDocs(query(collection(db, "bloodRequests")));
  return snapshot.docs.map((item) => toRequest(item.id, item.data()));
}

export async function getBloodRequest(requestId: string) {
  const snapshot = await getDoc(doc(db, "bloodRequests", requestId));
  return snapshot.exists() ? toRequest(snapshot.id, snapshot.data()) : null;
}

export async function listRequestEvents(requestId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "bloodRequestEvents"),
      where("requestId", "==", requestId),
    ),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function createBloodRequest(
  hospitalId: string,
  createdBy: string,
  input: BloodRequestInput,
) {
  if (input.patientId) {
    const patient = await getDoc(doc(db, "patients", input.patientId));
    if (!patient.exists() || patient.data().hospitalId !== hospitalId) {
      throw new Error("Patient is not part of this hospital.");
    }
  }

  const request = await addDoc(collection(db, "bloodRequests"), {
    hospitalId,
    createdBy,
    ...input,
    patientId: input.patientId || null,
    patientName: input.patientName?.trim() || null,
    caseId: input.caseId?.trim() || null,
    hospitalName: input.hospitalName?.trim() || null,
    neededBy: Timestamp.fromDate(input.neededBy),
    unitsFulfilled: 0,
    priority: priorityForUrgency(input.urgency),
    status: "submitted",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "bloodRequestEvents"), {
    requestId: request.id,
    actorUserId: createdBy,
    eventType: "created",
    metadata: {
      urgency: input.urgency,
      patientName: input.patientName?.trim() || null,
      caseId: input.caseId?.trim() || null,
    },
    createdAt: serverTimestamp(),
  });

  return request;
}

export async function cancelBloodRequest(
  requestId: string,
  hospitalId: string,
  actorUserId: string,
) {
  void hospitalId;
  void actorUserId;
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Authentication required.");
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/hospital/requests/cancel", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error || "This request cannot be cancelled.");
  }
}
