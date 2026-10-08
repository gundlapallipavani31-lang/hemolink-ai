import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";

const groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const statuses = ["scheduled", "completed", "rejected", "cancelled"];

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
    if (bloodBankActor) {
      await requireVerifiedOrganizationActor(token, "bloodBank");
    }
    if (!trustedAdmin && !bloodBankActor) throw new Error("Donation recording authorization is required.");
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "A valid JSON body is required." }, { status: 400 }); }
    const donorId = typeof body.donorId === "string" ? body.donorId.trim() : "";
    const bloodGroup = typeof body.bloodGroup === "string" ? body.bloodGroup : "";
    const componentType = typeof body.componentType === "string" ? body.componentType : "";
    const status = typeof body.status === "string" ? body.status : "";
    const dateValue = typeof body.donationDate === "string" ? body.donationDate : "";
    const donationDate = new Date(dateValue);
    if (!donorId || !groups.includes(bloodGroup) || !components.includes(componentType) || !statuses.includes(status) || Number.isNaN(donationDate.getTime())) {
      return Response.json({ error: "Valid donor, blood group, component, status, and donation date are required." }, { status: 400 });
    }
    const donor = await db.collection("users").doc(donorId).get();
    const donorProfile = await db.collection("donorProfiles").doc(donorId).get();
    if (!donor.exists || donor.data()?.role !== "donor" || donor.data()?.status === "disabled" || !donorProfile.exists) {
      throw new Error("Donor record not found.");
    }
    const profileBloodGroup = donorProfile.data()?.bloodGroup;
    if (profileBloodGroup && profileBloodGroup !== bloodGroup) {
      return Response.json({ error: "Donation blood group does not match the donor profile." }, { status: 400 });
    }
    const requestedOrganizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (bloodBankActor && requestedOrganizationId && requestedOrganizationId !== actorData?.organizationId) {
      throw new Error("Blood-bank organization authorization is required.");
    }
    const organizationId = bloodBankActor ? actorData.organizationId : requestedOrganizationId;
    const donationRef = db.collection("donations").doc();
    const donation = {
      donorId,
      bloodGroup,
      componentType,
      donationDate: Timestamp.fromDate(donationDate),
      status,
      ...(organizationId ? { organizationId, bloodBankId: organizationId } : {}),
      recordedBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await donationRef.set(donation);
    await db.collection("auditLogs").add({
      actorUserId: decoded.uid,
      action: "donation.created",
      entityType: "donation",
      entityId: donationRef.id,
      metadata: { donorId, bloodGroup, componentType, status },
      createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ donationId: donationRef.id }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
