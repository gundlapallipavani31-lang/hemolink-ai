import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token, true);
    const profile = await db.collection("users").doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== "donor" || profile.data()?.status === "disabled") {
      throw new Error("Donor authorization is required.");
    }
    const snapshot = await db.collection("donations")
      .where("donorId", "==", decoded.uid)
      .orderBy("donationDate", "desc")
      .get();
    const donations = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        donorId: decoded.uid,
        bloodGroup: data.bloodGroup,
        donationDate: data.donationDate?.toDate?.()?.toISOString() ?? null,
        componentType: data.componentType,
        rhFactor: data.rhFactor,
        unitsCollected: data.unitsCollected,
        organizationId: data.organizationId,
        bloodBankId: data.bloodBankId,
        opportunityId: data.opportunityId,
        status: data.status,
        recordedBy: data.recordedBy,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });
    return Response.json({ donations });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
