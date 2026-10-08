import { FieldValue } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const actor = await requireVerifiedOrganizationActor(token, "hospital");
    const { db } = actor;
    const body = (await request.json()) as { requestId?: string };
    if (!body.requestId) throw new Error("Request ID is required.");
    const requestId = body.requestId;
    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("bloodRequests").doc(requestId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) throw new Error("Blood request not found.");
      const bloodRequest = requestSnapshot.data()!;
      if (bloodRequest.hospitalId !== actor.organizationId || !["submitted", "under_review"].includes(bloodRequest.status)) {
        throw new Error("This request cannot be cancelled.");
      }
      transaction.update(requestRef, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
      const eventRef = db.collection("bloodRequestEvents").doc();
      transaction.set(eventRef, {
        requestId,
        actorUserId: actor.uid,
        eventType: "cancelled",
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        actorUserId: actor.uid,
        action: "request.cancelled",
        entityType: "bloodRequest",
        entityId: requestId,
        organizationId: actor.organizationId,
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await createNotification({
      recipientUserId: actor.uid,
      type: "request",
      title: "Blood request cancelled",
      body: "Your blood request was cancelled.",
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
