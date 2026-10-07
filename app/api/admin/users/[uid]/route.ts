import { FieldValue } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db, decoded } = await requireTrustedAdmin(token);
    const { uid } = await params;
    const body = (await request.json()) as { disabled?: boolean };
    if (typeof body.disabled !== "boolean") {
      return Response.json({ error: "A disabled boolean is required." }, { status: 400 });
    }
    await auth.updateUser(uid, { disabled: body.disabled });
    if (body.disabled) {
      await auth.revokeRefreshTokens(uid);
    }
    await db.collection("users").doc(uid).set({
      status: body.disabled ? "disabled" : "active",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection("auditLogs").add({
      actorUserId: decoded.uid,
      action: body.disabled ? "user.disabled" : "user.enabled",
      entityType: "user",
      entityId: uid,
      metadata: {},
      createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
