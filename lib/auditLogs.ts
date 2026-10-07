import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function createAuditLog(input: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}) {
  return addDoc(collection(db, "auditLogs"), {
    ...input,
    createdAt: serverTimestamp(),
  });
}
