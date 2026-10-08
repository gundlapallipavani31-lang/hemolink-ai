import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
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
  bloodGroup: BloodGroup;
  rhFactor?: RhFactor;
  componentType: BloodComponent;
  unitsRequested: number;
  urgency: RequestUrgency;
  neededBy: Date;
  notes?: string;
};

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
  const events: Record<string, unknown>[] = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
  return events.sort((left, right) => {
    const millis = (value: unknown) => {
      if (typeof value === "object" && value !== null && "toMillis" in value && typeof value.toMillis === "function") {
        return value.toMillis();
      }
      return 0;
    };
    return millis(left.createdAt) - millis(right.createdAt);
  });
}

export async function createBloodRequest(input: BloodRequestInput) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Authentication required.");
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/hospital/requests", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json() as { id?: string; error?: string };
  if (!response.ok || !result.id) {
    throw new Error(result.error || "The request could not be created.");
  }
  return { id: result.id };
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
