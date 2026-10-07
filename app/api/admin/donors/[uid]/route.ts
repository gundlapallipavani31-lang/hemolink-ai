import { FieldValue } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

const groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const availability = ["available", "unavailable", "unknown"];

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db, decoded } = await requireTrustedAdmin(token);
    const { uid } = await params;
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, string> = {};
    if (typeof body.bloodGroup === "string" && groups.includes(body.bloodGroup)) updates.bloodGroup = body.bloodGroup;
    if (typeof body.availabilityStatus === "string" && availability.includes(body.availabilityStatus)) updates.availabilityStatus = body.availabilityStatus;
    if (typeof body.city === "string") updates.city = body.city.trim();
    if (Object.keys(updates).length === 0) return Response.json({ error: "No permitted donor fields were provided." }, { status: 400 });
    const donor = await db.collection("users").doc(uid).get();
    if (!donor.exists || donor.data()?.role !== "donor") throw new Error("Donor record not found.");
    await db.collection("donorProfiles").doc(uid).set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("auditLogs").add({
      actorUserId: decoded.uid,
      action: "donor.profile.updated_by_admin",
      entityType: "donorProfile",
      entityId: uid,
      metadata: { fields: Object.keys(updates) },
      createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
