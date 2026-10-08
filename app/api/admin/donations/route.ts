import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";

const groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const statuses = ["scheduled", "completed", "rejected", "cancelled"];
const allowedFields = new Set([
  "donorId",
  "bloodGroup",
  "componentType",
  "status",
  "donationDate",
  "unitsCollected",
  "organizationId",
]);

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token, true);
    const actor = await db.collection("users").doc(decoded.uid).get();
    const actorData = actor.data();
    const trustedAdmin = actor.exists && actorData?.role === "administrator"
      && actorData?.status !== "disabled" && decoded.admin === true;
    const bloodBankActor = actor.exists && actorData?.role === "bloodBank"
      && actorData?.status !== "disabled" && typeof actorData?.organizationId === "string";
    if (bloodBankActor) await requireVerifiedOrganizationActor(token, "bloodBank");
    if (!trustedAdmin && !bloodBankActor) throw new Error("Donation recording authorization is required.");

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return Response.json({ error: "A JSON object is required." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }
    if (Object.keys(body).some((key) => !allowedFields.has(key))) {
      return Response.json({ error: "Unsupported donation fields were provided." }, { status: 400 });
    }

    const donorId = typeof body.donorId === "string" ? body.donorId.trim() : "";
    const bloodGroup = typeof body.bloodGroup === "string" ? body.bloodGroup : "";
    const componentType = typeof body.componentType === "string" ? body.componentType : "";
    const status = typeof body.status === "string" ? body.status : "";
    const dateValue = typeof body.donationDate === "string" ? body.donationDate : "";
    const donationDate = new Date(dateValue);
    const unitsCollected = body.unitsCollected;
    if (
      !donorId
      || !groups.includes(bloodGroup)
      || !components.includes(componentType)
      || !statuses.includes(status)
      || Number.isNaN(donationDate.getTime())
      || typeof unitsCollected !== "number"
      || !Number.isSafeInteger(unitsCollected)
      || unitsCollected <= 0
    ) {
      return Response.json({
        error: "Valid donor, blood group, component, status, date, and positive whole-unit quantity are required.",
      }, { status: 400 });
    }

    const requestedOrganizationId = typeof body.organizationId === "string"
      ? body.organizationId.trim()
      : "";
    if (bloodBankActor && requestedOrganizationId && requestedOrganizationId !== actorData?.organizationId) {
      throw new Error("Blood-bank organization authorization is required.");
    }
    const organizationId = bloodBankActor
      ? String(actorData?.organizationId)
      : requestedOrganizationId;
    if (!organizationId) throw new Error("A verified blood-bank organization ID is required.");
    if (trustedAdmin) await requireTrustedAdmin(token);

    const donorRef = db.collection("users").doc(donorId);
    const donorProfileRef = db.collection("donorProfiles").doc(donorId);
    const organizationRef = db.collection("organizations").doc(organizationId);
    const donationRef = db.collection("donations").doc();
    const auditRef = db.collection("auditLogs").doc();
    await db.runTransaction(async (transaction) => {
      const [donorSnapshot, donorProfileSnapshot, organizationSnapshot] = await Promise.all([
        transaction.get(donorRef),
        transaction.get(donorProfileRef),
        transaction.get(organizationRef),
      ]);
      const donorProfile = donorProfileSnapshot.data();
      const rhFactor = bloodGroup.endsWith("+") ? "positive" : "negative";
      if (
        !donorSnapshot.exists
        || donorSnapshot.data()?.role !== "donor"
        || donorSnapshot.data()?.status === "disabled"
        || !donorProfileSnapshot.exists
      ) throw new Error("Donor record not found.");
      if (donorProfile?.bloodGroup && donorProfile.bloodGroup !== bloodGroup) {
        throw new Error("Donation blood group does not match the donor profile.");
      }
      if (donorProfile?.rhFactor && donorProfile.rhFactor !== rhFactor) {
        throw new Error("Donation Rh factor does not match the donor profile.");
      }
      if (
        !organizationSnapshot.exists
        || organizationSnapshot.data()?.type !== "bloodBank"
        || organizationSnapshot.data()?.verificationStatus !== "verified"
      ) {
        throw new Error("A verified blood-bank organization is required.");
      }
      const timestamp = FieldValue.serverTimestamp();
      transaction.create(donationRef, {
        donorId,
        bloodBankId: organizationId,
        componentType,
        bloodGroup,
        rhFactor,
        unitsCollected,
        donationDate: Timestamp.fromDate(donationDate),
        status,
        verifiedBy: decoded.uid,
        recordedBy: decoded.uid,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (status === "completed") {
        const lastDonationAt = donorProfile?.lastDonationAt as { toMillis?: () => number } | undefined;
        if (!lastDonationAt?.toMillis || donationDate.getTime() > lastDonationAt.toMillis()) {
          transaction.update(donorProfileRef, {
            lastDonationAt: Timestamp.fromDate(donationDate),
            updatedAt: timestamp,
          });
        }
      }
      transaction.create(auditRef, {
        actorUserId: decoded.uid,
        action: "donation.created",
        entityType: "donation",
        entityId: donationRef.id,
        organizationId,
        metadata: { donorId, bloodGroup, componentType, status, unitsCollected },
        createdAt: timestamp,
      });
    });
    return Response.json({ donationId: donationRef.id }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
