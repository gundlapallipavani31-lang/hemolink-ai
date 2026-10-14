import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";

function isFailedPrecondition(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  const status = "status" in error ? error.status : undefined;
  return code === 9
    || code === "failed-precondition"
    || code === "FAILED_PRECONDITION"
    || status === "FAILED_PRECONDITION";
}

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
        bloodBankId: data.bloodBankId ?? data.organizationId ?? null,
        organizationId: data.organizationId ?? data.bloodBankId ?? null,
        bloodGroup: data.bloodGroup,
        rhFactor: data.rhFactor ?? null,
        unitsCollected: typeof data.unitsCollected === "number" ? data.unitsCollected : null,
        donationDate: data.donationDate?.toDate?.()?.toISOString() ?? null,
        componentType: data.componentType,
        opportunityId: data.opportunityId,
        status: data.status,
        verifiedBy: data.verifiedBy,
        recordedBy: data.recordedBy,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });
    return Response.json({ donations });
  } catch (error) {
    if (isFailedPrecondition(error)) {
      return Response.json(
        { error: "Donation history is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }
    return adminErrorResponse(error);
  }
}
