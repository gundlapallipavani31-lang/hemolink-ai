import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { isValidBloodGroupRh } from "@/lib/inventoryAvailability";
import { readVerifiedActiveBloodBankIds } from "@/lib/serverInventoryOwnership";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";
import type { BloodComponent, BloodGroup, DonationStatus } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const statuses: DonationStatus[] = ["scheduled", "completed", "rejected", "cancelled"];
const allowedFields = [
  "donorId",
  "organizationId",
  "bloodGroup",
  "rhFactor",
  "componentType",
  "unitsCollected",
  "donationDate",
  "status",
  "opportunityId",
];

function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex")}`;
}

function parseDonationDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" && value !== null
    && "toDate" in value && typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    if (Object.keys(payload).some((key) => !allowedFields.includes(key))) {
      return Response.json({ error: "The donation contains unsupported fields." }, { status: 400 });
    }
    const donorId = typeof payload.donorId === "string" ? payload.donorId.trim() : "";
    const organizationInput = typeof payload.organizationId === "string"
      ? payload.organizationId.trim()
      : "";
    const opportunityId = typeof payload.opportunityId === "string"
      ? payload.opportunityId.trim()
      : "";
    const bloodGroup = payload.bloodGroup;
    const rhFactor = payload.rhFactor;
    const componentType = payload.componentType;
    const status = payload.status;
    const donationDate = parseDonationDate(payload.donationDate);
    if (!donorId) return Response.json({ error: "A valid donor ID is required." }, { status: 400 });
    if (!groups.includes(bloodGroup as BloodGroup)) {
      return Response.json({ error: "A supported blood group is required." }, { status: 400 });
    }
    if (rhFactor !== "positive" && rhFactor !== "negative") {
      return Response.json({ error: "A valid Rh factor is required." }, { status: 400 });
    }
    if (!isValidBloodGroupRh(bloodGroup, rhFactor)) {
      return Response.json({ error: "Blood group and Rh factor do not match." }, { status: 400 });
    }
    if (!components.includes(componentType as BloodComponent)) {
      return Response.json({ error: "A supported blood component is required." }, { status: 400 });
    }
    if (
      typeof payload.unitsCollected !== "number"
      || !Number.isSafeInteger(payload.unitsCollected)
      || payload.unitsCollected <= 0
    ) {
      return Response.json({ error: "Units collected must be a positive safe integer." }, { status: 400 });
    }
    if (!statuses.includes(status as DonationStatus) || !donationDate) {
      return Response.json({ error: "A valid donation status and date are required." }, { status: 400 });
    }
    if (payload.opportunityId !== undefined && !opportunityId) {
      return Response.json({ error: "A valid opportunity ID is required." }, { status: 400 });
    }

    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token, true);
    const actorSnapshot = await db.collection("users").doc(decoded.uid).get();
    const actorProfile = actorSnapshot.data();
    const isAdmin = actorSnapshot.exists
      && actorProfile?.role === "administrator"
      && actorProfile.status !== "disabled"
      && decoded.admin === true;
    let actorOrganizationId: string | null = null;
    if (!isAdmin) {
      if (
        !actorSnapshot.exists
        || actorProfile?.role !== "bloodBank"
        || actorProfile.status === "disabled"
      ) {
        throw new Error("Donation recording authorization is required.");
      }
      const organizationActor = await requireVerifiedOrganizationActor(token, "bloodBank");
      actorOrganizationId = organizationActor.organizationId;
      if (organizationInput && organizationInput !== actorOrganizationId) {
        throw new Error("Blood-bank organization authorization is required.");
      }
    } else {
      await requireTrustedAdmin(token);
      if (!organizationInput) {
        return Response.json({ error: "A verified Blood Bank is required." }, { status: 400 });
      }
      actorOrganizationId = organizationInput;
    }
    const organizationId = actorOrganizationId;
    if (!organizationId) throw new Error("A verified Blood Bank is required.");

    const identity = [
      "manual-donation-v1",
      organizationId,
      donorId,
      donationDate.toISOString(),
      bloodGroup,
      rhFactor,
      componentType,
      payload.unitsCollected,
    ].join("|");
    const donationId = opportunityId
      ? `donor-opportunity-${createHash("sha256").update(opportunityId).digest("hex")}`
      : stableId("manualdonation", identity);
    const donationRef = db.collection("donations").doc(donationId);
    const donorRef = db.collection("users").doc(donorId);
    const donorProfileRef = db.collection("donorProfiles").doc(donorId);
    const opportunityRef = opportunityId
      ? db.collection("donorOpportunities").doc(opportunityId)
      : null;

    const result = await db.runTransaction(async (transaction) => {
      const [donorSnapshot, donorProfileSnapshot, verifiedBloodBanks, existingDonation] =
        await Promise.all([
          transaction.get(donorRef),
          transaction.get(donorProfileRef),
          readVerifiedActiveBloodBankIds(transaction, db, [organizationId]),
          transaction.get(donationRef),
        ]);
      const opportunitySnapshot = opportunityRef ? await transaction.get(opportunityRef) : null;
      const donorProfile = donorProfileSnapshot.data();
      if (
        !donorSnapshot.exists
        || donorSnapshot.data()?.role !== "donor"
        || donorSnapshot.data()?.status === "disabled"
        || !donorProfileSnapshot.exists
      ) {
        throw new Error("Donor record not found.");
      }
      if (!verifiedBloodBanks.has(organizationId)) {
        throw new Error("A verified active Blood Bank is required.");
      }
      if (
        donorProfile?.bloodGroup && donorProfile.bloodGroup !== bloodGroup
        || donorProfile?.rhFactor && donorProfile.rhFactor !== rhFactor
      ) {
        throw new Error("Donation blood group does not match the donor profile.");
      }

      if (opportunityRef && opportunitySnapshot) {
        const opportunity = opportunitySnapshot.data();
        if (
          !opportunitySnapshot.exists
          || opportunity?.donorId !== donorId
          || opportunity?.organizationId !== organizationId
          || opportunity?.organizationType !== "bloodBank"
        ) {
          throw new Error("The opportunity does not match this donor and Blood Bank.");
        }
        if (opportunity.status === "completed" && typeof opportunity.donationId === "string") {
          const linkedDonation = await transaction.get(
            db.collection("donations").doc(opportunity.donationId),
          );
          const linkedData = linkedDonation.data();
          if (
            !linkedDonation.exists
            || linkedData?.donorId !== donorId
            || (linkedData?.bloodBankId ?? linkedData?.organizationId) !== organizationId
            || linkedData?.status !== "completed"
          ) {
            throw new Error("The completed opportunity donation record is missing.");
          }
          const linkedDonationDate = timestampMillis(linkedData.donationDate);
          const previousDonationDate = timestampMillis(donorProfile?.lastDonationAt);
          if (
            linkedDonationDate !== null
            && (previousDonationDate === null || linkedDonationDate > previousDonationDate)
          ) {
            transaction.update(donorProfileRef, {
              lastDonationAt: Timestamp.fromMillis(linkedDonationDate),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          return { donationId: linkedDonation.id, alreadyRecorded: true };
        }
        if (opportunity.status !== "scheduled") {
          throw new Error("Only a scheduled opportunity can be completed by manual recording.");
        }
        if (status !== "scheduled" && status !== "completed") {
          throw new Error("A linked opportunity must remain scheduled or be completed.");
        }
      }

      const donationData = {
        donorId,
        bloodBankId: organizationId,
        organizationId,
        bloodGroup,
        rhFactor,
        componentType,
        unitsCollected: payload.unitsCollected,
        donationDate: Timestamp.fromDate(donationDate),
        status,
        ...(opportunityId ? { opportunityId } : {}),
        recordedBy: decoded.uid,
        verifiedBy: decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const auditId = stableId(
        "donationaudit",
        `${donationId}|${existingDonation.exists ? status : "created"}`,
      );
      const auditRef = db.collection("auditLogs").doc(auditId);
      const auditSnapshot = await transaction.get(auditRef);

      if (existingDonation.exists) {
        const existing = existingDonation.data()!;
        if (
          existing.donorId !== donorId
          || existing.bloodBankId !== organizationId
          || existing.bloodGroup !== bloodGroup
          || existing.rhFactor !== rhFactor
          || existing.componentType !== componentType
          || existing.unitsCollected !== payload.unitsCollected
          || timestampMillis(existing.donationDate) !== donationDate.getTime()
        ) {
          throw new Error("A donation with this operation identity already exists with different details.");
        }
        if (existing.status === status) {
          if (status === "completed") {
            const lastDonationMillis = timestampMillis(donorProfile?.lastDonationAt);
            if (lastDonationMillis === null || donationDate.getTime() > lastDonationMillis) {
              transaction.update(donorProfileRef, {
                lastDonationAt: Timestamp.fromDate(donationDate),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
            if (opportunityRef && opportunitySnapshot?.data()?.status === "scheduled") {
              transaction.update(opportunityRef, {
                status: "completed",
                donationId,
                completedBy: decoded.uid,
                completedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          }
          return { donationId, alreadyRecorded: true };
        }
        if (
          existing.status !== "scheduled"
          || !["completed", "rejected", "cancelled"].includes(status as DonationStatus)
        ) {
          throw new Error("This donation cannot transition to the requested status.");
        }
        transaction.update(donationRef, {
          status,
          updatedAt: FieldValue.serverTimestamp(),
          ...(status === "completed" ? { verifiedBy: decoded.uid } : {}),
        });
      } else {
        transaction.create(donationRef, donationData);
      }

      if (status === "completed") {
        const lastDonationMillis = timestampMillis(donorProfile?.lastDonationAt);
        if (lastDonationMillis === null || donationDate.getTime() > lastDonationMillis) {
          transaction.update(donorProfileRef, {
            lastDonationAt: Timestamp.fromDate(donationDate),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      if (!auditSnapshot.exists) {
        transaction.create(auditRef, {
          actorUserId: decoded.uid,
          action: status === "completed"
            ? "donation.completed"
            : status === "scheduled"
              ? "donation.scheduled"
              : `donation.${status}`,
          entityType: "donation",
          entityId: donationId,
          organizationId,
          metadata: { donorId, bloodGroup, componentType, unitsCollected: payload.unitsCollected, status },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (opportunityRef && opportunitySnapshot && status === "completed") {
        transaction.update(opportunityRef, {
          status: "completed",
          donationId,
          completedBy: decoded.uid,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { donationId, alreadyRecorded: existingDonation.exists };
    });
    return Response.json(result, { status: result.alreadyRecorded ? 200 : 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
