import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type CreateUserProfileInput = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  requestedRole: string;
};

export async function createUserProfile({
  uid,
  name,
  email,
  phone,
  requestedRole,
}: CreateUserProfileInput) {
  const role = requestedRole === "Administrator" ? "pending" : requestedRole;

  await setDoc(
    doc(db, "users", uid),
    {
      name,
      email,
      phone,
      role,
      requestedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}
