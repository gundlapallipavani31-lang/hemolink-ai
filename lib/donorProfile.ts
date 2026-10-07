import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DonorAvailabilityStatus, DonorProfile } from "@/types/domain";

export async function getDonorProfile(uid: string) {
  const snapshot = await getDoc(doc(db, "donorProfiles", uid));
  return snapshot.exists() ? ({ ...snapshot.data(), userId: uid } as DonorProfile) : null;
}

export async function saveDonorProfile(
  uid: string,
  profile: Pick<
    DonorProfile,
    | "bloodGroup"
    | "rhFactor"
    | "city"
    | "availabilityStatus"
    | "consentToEmergencyContact"
  > & { phone?: string },
) {
  await setDoc(
    doc(db, "donorProfiles", uid),
    {
      userId: uid,
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateDonorAvailability(
  uid: string,
  availabilityStatus: DonorAvailabilityStatus,
) {
  await setDoc(
    doc(db, "donorProfiles", uid),
    { availabilityStatus, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
