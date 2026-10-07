import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Patient } from "@/types/domain";

export type PatientInput = Pick<
  Patient,
  "externalReference" | "displayName" | "bloodGroup" | "rhFactor" | "dateOfBirth" | "status"
>;

export async function listPatients(hospitalId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "patients"),
      where("hospitalId", "==", hospitalId),
      orderBy("updatedAt", "desc"),
    ),
  );
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Patient);
}

export async function createPatient(hospitalId: string, createdBy: string, patient: PatientInput) {
  return addDoc(collection(db, "patients"), {
    hospitalId,
    createdBy,
    ...patient,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePatient(patientId: string, patient: Partial<PatientInput>) {
  await updateDoc(doc(db, "patients", patientId), {
    ...patient,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePatient(patientId: string) {
  await deleteDoc(doc(db, "patients", patientId));
}
