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

function definedPatientFields(patient: Partial<PatientInput>) {
  return {
    ...(patient.externalReference === undefined ? {} : { externalReference: patient.externalReference }),
    ...(patient.displayName === undefined ? {} : { displayName: patient.displayName }),
    ...(patient.bloodGroup === undefined ? {} : { bloodGroup: patient.bloodGroup }),
    ...(patient.rhFactor === undefined ? {} : { rhFactor: patient.rhFactor }),
    ...(patient.dateOfBirth === undefined ? {} : { dateOfBirth: patient.dateOfBirth }),
    ...(patient.status === undefined ? {} : { status: patient.status }),
  };
}

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
    ...definedPatientFields(patient),
    hospitalId,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePatient(patientId: string, patient: Partial<PatientInput>) {
  await updateDoc(doc(db, "patients", patientId), {
    ...definedPatientFields(patient),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePatient(patientId: string) {
  await deleteDoc(doc(db, "patients", patientId));
}
