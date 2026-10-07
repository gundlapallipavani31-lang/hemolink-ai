import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Organization } from "@/types/domain";

export async function getOrganization(organizationId: string) {
  const snapshot = await getDoc(doc(db, "organizations", organizationId));
  return snapshot.exists()
    ? ({ ...snapshot.data(), id: organizationId } as Organization)
    : null;
}

export async function updateOrganizationProfile(
  organizationId: string,
  profile: Pick<
    Organization,
    "name" | "legalName" | "phone" | "email" | "address" | "city" | "state" | "country"
  >,
) {
  await setDoc(
    doc(db, "organizations", organizationId),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
