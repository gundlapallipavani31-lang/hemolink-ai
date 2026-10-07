import { FieldValue } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token, true);
    const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists || profile?.role !== "hospital" || profile.status === "disabled") {
      throw new Error("Hospital authorization is required.");
    }
    if (profile.organizationId) return Response.json({ error: "Your hospital organization is already configured." }, { status: 400 });
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "A valid JSON body is required." }, { status: 400 }); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    if (!name || !city) return Response.json({ error: "Hospital name and city are required." }, { status: 400 });
    const existing = await db.collection("organizationRequests")
      .where("requestedBy", "==", decoded.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!existing.empty) return Response.json({ error: "An organization setup request is already pending." }, { status: 400 });
    const requestRef = db.collection("organizationRequests").doc();
    await requestRef.set({
      type: "hospital",
      name,
      legalName,
      city,
      requestedBy: decoded.uid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection("auditLogs").add({
      actorUserId: decoded.uid,
      action: "hospital.organization_setup.requested",
      entityType: "organizationRequest",
      entityId: requestRef.id,
      metadata: { type: "hospital", city },
      createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ requestId: requestRef.id }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
