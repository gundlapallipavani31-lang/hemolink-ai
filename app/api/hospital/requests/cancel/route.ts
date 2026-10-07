import { FieldValue } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token, true);
    const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.data();
    if (
      !profileSnapshot.exists
      || profile?.role !== "hospital"
      || profile.status === "disabled"
      || !profile.organizationId
    ) {
      throw new Error("Hospital authorization is required.");
    }
    const body = (await request.json()) as { requestId?: string };
    if (!body.requestId) throw new Error("Request ID is required.");
    const requestId = body.requestId;
    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("bloodRequests").doc(requestId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) throw new Error("Blood request not found.");
      const bloodRequest = requestSnapshot.data()!;
      if (!profile.organizationId || bloodRequest.hospitalId !== profile.organizationId || !["submitted", "under_review"].includes(bloodRequest.status)) {
        throw new Error("This request cannot be cancelled.");
      }
      transaction.update(requestRef, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
      const eventRef = db.collection("bloodRequestEvents").doc();
      transaction.set(eventRef, {
        requestId,
        actorUserId: decoded.uid,
        eventType: "cancelled",
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        actorUserId: decoded.uid,
        action: "request.cancelled",
        entityType: "bloodRequest",
        entityId: requestId,
        organizationId: profile.organizationId,
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await createNotification({
      recipientUserId: decoded.uid,
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
