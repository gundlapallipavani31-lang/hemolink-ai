import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebaseAdmin";

export async function createNotification(input: {
  recipientUserId: string;
  type: "request" | "inventory" | "approval" | "emergency" | "system";
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const { db } = getAdminServices();
  return db.collection("notifications").add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
}
