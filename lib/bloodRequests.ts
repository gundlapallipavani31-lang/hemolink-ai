import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  BloodComponent,
  BloodGroup,
  BloodRequest,
  RequestStatus,
  RequestUrgency,
  RhFactor,
} from "@/types/domain";

export type BloodRequestInput = {
  patientId: string;
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
  const patient = await getDoc(doc(db, "patients", input.patientId));
  if (!patient.exists() || patient.data().hospitalId !== hospitalId) {
    throw new Error("Patient is not part of this hospital.");
  }
  const request = await addDoc(collection(db, "bloodRequests"), {
    hospitalId,
    createdBy,
    ...input,
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
    metadata: {},
    createdAt: serverTimestamp(),
  });
  return request;
}

export async function cancelBloodRequest(
  requestId: string,
  hospitalId: string,
  actorUserId: string,
) {
  const request = await getBloodRequest(requestId);
  if (
    !request ||
    request.hospitalId !== hospitalId ||
    !["submitted", "under_review"].includes(request.status)
  ) {
    throw new Error("This request cannot be cancelled.");
  }
  await updateDoc(doc(db, "bloodRequests", requestId), {
    status: "cancelled" satisfies RequestStatus,
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "bloodRequestEvents"), {
    requestId,
    actorUserId,
    eventType: "cancelled",
    metadata: {},
    createdAt: serverTimestamp(),
  });
}
