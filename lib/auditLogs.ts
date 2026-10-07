import { addDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
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

export async function listAuditLogs(entityId: string) {
  const snapshot = await getDocs(
    query(collection(db, "auditLogs"), where("entityId", "==", entityId)),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
