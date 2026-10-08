import { createHash } from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { requireTrustedAdmin } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";
import type {
  BloodComponent,
  BloodGroup,
} from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];
type StaffActor = {
  uid: string;
  role: "administrator" | "bloodBank";
  organizationId: string | null;
  db: Firestore;
};

function parseObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("A JSON object is required.");
  }
  return value as Record<string, unknown>;
}

function parseText(value: unknown, label: string, maxLength: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${label} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  if (required && !text) throw new Error(`${label} is required.`);
  return text;
}

function opportunityView(id: string, data: DocumentData): DocumentData {
  const date = (value: unknown) =>
    value && typeof value === "object" && "toDate" in value
      && typeof value.toDate === "function"
      ? value.toDate().toISOString()
      : null;
  return {
    ...data,
    id,
    appointmentAt: date(data.appointmentAt),
    donorResponseAt: date(data.donorResponseAt),
    scheduledAt: date(data.scheduledAt),
    completedAt: date(data.completedAt),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
  };
}

function writeNotification(
  transaction: Transaction,
  db: Firestore,
  recipientUserId: string,
  opportunityId: string,
  title: string,
  body: string,
) {
  transaction.create(db.collection("notifications").doc(), {
    recipientUserId,
    type: "donation",
    title,
    body,
    relatedEntityType: "donorOpportunity",
    relatedEntityId: opportunityId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function getStaffActor(idToken: string, organizationId?: string): Promise<StaffActor> {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
  const profile = profileSnapshot.data();
  if (
    !profileSnapshot.exists
    || !profile
    || profile?.status === "disabled"
    || !["administrator", "bloodBank"].includes(String(profile?.role))
  ) {
    throw new Error("Active administrator or blood-bank authorization is required.");
  }
  if (profile.role === "administrator") {
    await requireTrustedAdmin(idToken);
    if (organizationId) {
      const organization = await db.collection("organizations").doc(organizationId).get();
      if (
        !organization.exists
        || organization.data()?.type !== "bloodBank"
        || organization.data()?.verificationStatus !== "verified"
      ) {
        throw new Error("A verified blood-bank organization is required.");
      }
    }
    return { uid: decoded.uid, role: "administrator", organizationId: organizationId || null, db };
  }

  const actor = await requireVerifiedOrganizationActor(idToken, "bloodBank");
  if (organizationId && organizationId !== actor.organizationId) {
    throw new Error("Blood-bank organization authorization is required.");
  }
  return {
    uid: actor.uid,
    role: "bloodBank",
    organizationId: actor.organizationId,
    db: actor.db,
  };
}

async function verifyStaffInTransaction(
  transaction: Transaction,
  actor: StaffActor,
) {
  const userRef = actor.db.collection("users").doc(actor.uid);
  const userSnapshot = await transaction.get(userRef);
  const user = userSnapshot.data();
  if (
    !userSnapshot.exists
    || user?.status === "disabled"
    || user?.role !== actor.role
  ) {
    throw new Error("Staff account is no longer active.");
  }
  if (actor.role === "bloodBank") {
    const organizationId = actor.organizationId;
    if (!organizationId || user.organizationId !== organizationId) {
      throw new Error("Blood-bank organization authorization is required.");
    }
    const organizationRef = actor.db.collection("organizations").doc(organizationId);
    const memberRef = actor.db.collection("organizationMembers")
      .doc(`${organizationId}_${actor.uid}`);
    const [organizationSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(memberRef),
    ]);
    if (
      !organizationSnapshot.exists
      || organizationSnapshot.data()?.type !== "bloodBank"
      || organizationSnapshot.data()?.verificationStatus !== "verified"
      || !memberSnapshot.exists
      || memberSnapshot.data()?.status !== "active"
      || memberSnapshot.data()?.userId !== actor.uid
      || memberSnapshot.data()?.organizationId !== organizationId
    ) {
      throw new Error("Verified active blood-bank membership is required.");
    }
  }
}

export async function listMyDonorOpportunities(idToken: string) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const profile = await db.collection("users").doc(decoded.uid).get();
  if (!profile.exists || profile.data()?.role !== "donor" || profile.data()?.status === "disabled") {
    throw new Error("Active donor authorization is required.");
  }
  const snapshot = await db.collection("donorOpportunities")
    .where("donorId", "==", decoded.uid)
    .get();
  const items = snapshot.docs.map((item) => opportunityView(item.id, item.data()));
  const organizations = new Map<string, DocumentData>();
  const organizationIds = [...new Set(items.map((item) => item.organizationId).filter(
    (id): id is string => typeof id === "string",
  ))];
  await Promise.all(organizationIds.map(async (id) => {
    const organization = await db.collection("organizations").doc(id).get();
    if (organization.exists) organizations.set(id, organization.data()!);
  }));
  return items
    .sort((left, right) =>
      Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
    )
    .map((item) => ({
      ...item,
      organizationName: organizations.get(item.organizationId)?.name ?? "Blood bank",
      organizationCity: organizations.get(item.organizationId)?.city ?? item.city ?? "",
    }));
}

export async function listStaffDonorOpportunities(
  idToken: string,
  bloodGroupFilter = "",
) {
  const actor = await getStaffActor(idToken);
  const opportunityQuery = actor.organizationId
    ? actor.db.collection("donorOpportunities").where("organizationId", "==", actor.organizationId)
    : actor.db.collection("donorOpportunities");
  const opportunitySnapshot = await opportunityQuery.get();
  const opportunities = opportunitySnapshot.docs.map((item) => opportunityView(item.id, item.data()));
  const donorIds = [...new Set(opportunities.map((item) => item.donorId).filter(
    (id): id is string => typeof id === "string",
  ))];
  const organizationIds = [...new Set(opportunities.map((item) => item.organizationId).filter(
    (id): id is string => typeof id === "string",
  ))];
  const donorProfiles = new Map<string, DocumentData>();
  const organizations = new Map<string, DocumentData>();
  await Promise.all([
    ...donorIds.map(async (id) => {
      const snapshot = await actor.db.collection("users").doc(id).get();
      if (snapshot.exists) donorProfiles.set(id, snapshot.data()!);
    }),
    ...organizationIds.map(async (id) => {
      const snapshot = await actor.db.collection("organizations").doc(id).get();
      if (snapshot.exists) organizations.set(id, snapshot.data()!);
    }),
  ]);
  const opportunityRows = opportunities.map((item) => ({
    ...item,
    donorName: donorProfiles.get(item.donorId)?.name ?? "Donor",
    organizationName: organizations.get(item.organizationId)?.name ?? "Blood bank",
  }));

  let candidates: Array<Record<string, unknown>> = [];
  if (bloodGroupFilter) {
    if (!bloodGroups.includes(bloodGroupFilter as BloodGroup)) {
      throw new Error("A supported blood group is required.");
    }
    const donorProfileSnapshot = await actor.db.collection("donorProfiles")
      .where("bloodGroup", "==", bloodGroupFilter)
      .get();
    const donorRows = await Promise.all(donorProfileSnapshot.docs.map(async (item) => ({
      snapshot: item,
      user: await actor.db.collection("users").doc(item.id).get(),
    })));
    candidates = donorRows.flatMap(({ snapshot, user: userSnapshot }) => {
      const item = snapshot;
      const donor = item.data();
      const user = userSnapshot.data();
      if (
        !userSnapshot.exists
        || user?.role !== "donor"
        || user.status === "disabled"
        || donor.availabilityStatus !== "available"
        || donor.consentToEmergencyContact !== true
        || donor.bloodGroup !== bloodGroupFilter
      ) return [];
      return [{
        donorId: item.id,
        name: typeof user.name === "string" ? user.name : "Donor",
        city: typeof donor.city === "string" ? donor.city : "",
        bloodGroup: donor.bloodGroup,
      }];
    });
  }
  return { opportunities: opportunityRows, candidates };
}

export async function createDonorOpportunity(idToken: string, body: unknown) {
  const input = parseObject(body);
  const allowed = ["donorId", "organizationId", "sourceRequestId", "bloodGroup", "city"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error("Unsupported opportunity fields were provided.");
  }
  const donorId = parseText(input.donorId, "Donor", 128, true);
  const requestedOrganizationId = parseText(input.organizationId, "Organization", 128);
  const sourceRequestId = parseText(input.sourceRequestId, "Source request", 128);
  const bloodGroup = parseText(input.bloodGroup, "Blood group", 3, true);
  const city = parseText(input.city, "City", 120);
  if (!bloodGroups.includes(bloodGroup as BloodGroup)) {
    throw new Error("A supported blood group is required.");
  }
  const actor = await getStaffActor(idToken, requestedOrganizationId || undefined);
  const organizationId = actor.organizationId;
  if (!organizationId) throw new Error("Choose a verified blood-bank organization.");

  const opportunityRef = actor.db.collection("donorOpportunities").doc();
  const auditRef = actor.db.collection("auditLogs").doc();
  const notificationRef = actor.db.collection("notifications").doc();
  const donorRef = actor.db.collection("users").doc(donorId);
  const donorProfileRef = actor.db.collection("donorProfiles").doc(donorId);
  const organizationRef = actor.db.collection("organizations").doc(organizationId);
  const sourceRef = sourceRequestId
    ? actor.db.collection("bloodRequests").doc(sourceRequestId)
    : null;

  await actor.db.runTransaction(async (transaction) => {
    await verifyStaffInTransaction(transaction, actor);
    const reads = [
      transaction.get(donorRef),
      transaction.get(donorProfileRef),
      transaction.get(organizationRef),
      ...(sourceRef ? [transaction.get(sourceRef)] : []),
    ];
    const [donorSnapshot, donorProfileSnapshot, organizationSnapshot, sourceSnapshot] =
      await Promise.all(reads);
    const donor = donorProfileSnapshot.data();
    if (
      !donorSnapshot.exists
      || donorSnapshot.data()?.role !== "donor"
      || donorSnapshot.data()?.status === "disabled"
      || !donorProfileSnapshot.exists
      || donor?.bloodGroup !== bloodGroup
      || donor.availabilityStatus !== "available"
      || donor.consentToEmergencyContact !== true
    ) {
      throw new Error("The selected donor is not an eligible outreach candidate.");
    }
    if (
      !organizationSnapshot.exists
      || organizationSnapshot.data()?.type !== "bloodBank"
      || organizationSnapshot.data()?.verificationStatus !== "verified"
    ) {
      throw new Error("Verified blood-bank organization is required.");
    }
    if (sourceRef && (
      !sourceSnapshot?.exists
      || sourceSnapshot.data()?.bloodGroup !== bloodGroup
      || ["rejected", "cancelled", "expired", "fulfilled"].includes(String(sourceSnapshot.data()?.status))
      || (actor.role === "bloodBank"
        && !sourceSnapshot.data()?.assignedBloodBankIds?.includes(organizationId))
    )) {
      throw new Error("The source request is not available for this opportunity.");
    }
    const timestamp = FieldValue.serverTimestamp();
    transaction.create(opportunityRef, {
      donorId,
      organizationId,
      organizationType: "bloodBank",
      ...(sourceRequestId ? { sourceRequestId } : {}),
      bloodGroup,
      city: city || donor.city || organizationSnapshot.data()?.city || "",
      status: "offered",
      createdBy: actor.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.create(auditRef, {
      actorUserId: actor.uid,
      action: "donor_opportunity.created",
      entityType: "donorOpportunity",
      entityId: opportunityRef.id,
      organizationId,
      metadata: { donorId, bloodGroup, sourceRequestId: sourceRequestId || null },
      createdAt: timestamp,
    });
    transaction.create(notificationRef, {
      recipientUserId: donorId,
      type: "donation",
      title: "A donation opportunity is available",
      body: `A verified blood bank has invited you to consider donating ${bloodGroup} blood${city ? ` in ${city}` : ""}.`,
      relatedEntityType: "donorOpportunity",
      relatedEntityId: opportunityRef.id,
      createdAt: timestamp,
    });
  });
  return { opportunityId: opportunityRef.id };
}

export async function respondToDonorOpportunity(
  idToken: string,
  opportunityId: string,
  action: "accept" | "decline",
) {
  if (action !== "accept" && action !== "decline") {
    throw new Error("Unsupported donor opportunity action.");
  }
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const donorRef = db.collection("users").doc(decoded.uid);
  const opportunityRef = db.collection("donorOpportunities").doc(opportunityId);
  const auditRef = db.collection("auditLogs").doc();
  const result = await db.runTransaction(async (transaction) => {
    const [donorSnapshot, opportunitySnapshot] = await Promise.all([
      transaction.get(donorRef),
      transaction.get(opportunityRef),
    ]);
    if (
      !donorSnapshot.exists
      || donorSnapshot.data()?.role !== "donor"
      || donorSnapshot.data()?.status === "disabled"
    ) throw new Error("Active donor authorization is required.");
    if (!opportunitySnapshot.exists) throw new Error("Donor opportunity not found.");
    const opportunity = opportunitySnapshot.data()!;
    if (opportunity.donorId !== decoded.uid) throw new Error("This opportunity is not assigned to this donor.");
    if (opportunity.status !== "offered") throw new Error("This opportunity is no longer awaiting a response.");
    const nextStatus = action === "accept" ? "accepted" : "declined";
    const now = FieldValue.serverTimestamp();
    transaction.update(opportunityRef, {
      status: nextStatus,
      donorResponseAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      actorUserId: decoded.uid,
      action: `donor_opportunity.${nextStatus}`,
      entityType: "donorOpportunity",
      entityId: opportunityId,
      organizationId: opportunity.organizationId,
      metadata: {},
      createdAt: now,
    });
    writeNotification(
      transaction,
      db,
      opportunity.createdBy,
      opportunityId,
      action === "accept" ? "Donor accepted opportunity" : "Donor declined opportunity",
      action === "accept"
        ? "The donor accepted the donation opportunity. Schedule an appointment."
        : "The donor declined the donation opportunity.",
    );
    return { status: nextStatus };
  });
  return result;
}

export async function updateStaffDonorOpportunity(
  idToken: string,
  opportunityId: string,
  body: unknown,
) {
  const input = parseObject(body);
  if (typeof input.action !== "string") throw new Error("Opportunity action is required.");
  const action = input.action;
  const allowedByAction: Record<string, string[]> = {
    schedule: ["action", "appointmentAt", "appointmentDetails", "city"],
    complete: ["action", "componentType", "unitsCollected"],
    cancel: ["action", "reason"],
  };
  const allowed = allowedByAction[action];
  if (!allowed || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error("Unsupported opportunity action or fields.");
  }
  const opportunityRefId = parseText(opportunityId, "Opportunity ID", 128, true);
  const actor = await getStaffActor(idToken);
  const opportunityRef = actor.db.collection("donorOpportunities").doc(opportunityRefId);
  const auditRef = actor.db.collection("auditLogs").doc();
  const notificationRef = actor.db.collection("notifications").doc();

  if (action === "schedule") {
    const appointmentInput = parseText(input.appointmentAt, "Appointment date and time", 64, true);
    const appointmentDate = new Date(appointmentInput);
    if (!Number.isFinite(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now()) {
      throw new Error("Appointment date and time must be in the future.");
    }
    const appointmentDetails = parseText(input.appointmentDetails, "Appointment details", 1000, true);
    const city = parseText(input.city, "Appointment city", 120);
    return actor.db.runTransaction(async (transaction) => {
      await verifyStaffInTransaction(transaction, actor);
      const opportunitySnapshot = await transaction.get(opportunityRef);
      if (!opportunitySnapshot.exists) throw new Error("Donor opportunity not found.");
      const opportunity = opportunitySnapshot.data()!;
      if (
        opportunity.status !== "accepted"
        || (actor.organizationId && opportunity.organizationId !== actor.organizationId)
      ) throw new Error("Only an accepted opportunity owned by this organization can be scheduled.");
      const now = FieldValue.serverTimestamp();
      transaction.update(opportunityRef, {
        status: "scheduled",
        appointmentAt: Timestamp.fromDate(appointmentDate),
        appointmentDetails,
        ...(city ? { city } : {}),
        scheduledAt: now,
        updatedAt: now,
      });
      transaction.create(auditRef, {
        actorUserId: actor.uid,
        action: "donor_opportunity.scheduled",
        entityType: "donorOpportunity",
        entityId: opportunityRefId,
        organizationId: opportunity.organizationId,
        metadata: { appointmentAt: appointmentDate.toISOString() },
        createdAt: now,
      });
      transaction.create(notificationRef, {
        recipientUserId: opportunity.donorId,
        type: "donation",
        title: "Donation appointment scheduled",
        body: `Your appointment is scheduled for ${appointmentDate.toLocaleString()}. ${appointmentDetails}`,
        relatedEntityType: "donorOpportunity",
        relatedEntityId: opportunityRefId,
        createdAt: now,
      });
      return { status: "scheduled" };
    });
  }

  if (action === "cancel") {
    const reason = parseText(input.reason, "Cancellation reason", 500);
    return actor.db.runTransaction(async (transaction) => {
      await verifyStaffInTransaction(transaction, actor);
      const opportunitySnapshot = await transaction.get(opportunityRef);
      if (!opportunitySnapshot.exists) throw new Error("Donor opportunity not found.");
      const opportunity = opportunitySnapshot.data()!;
      if (
        !["offered", "accepted", "scheduled"].includes(String(opportunity.status))
        || (actor.organizationId && opportunity.organizationId !== actor.organizationId)
      ) throw new Error("This opportunity cannot be cancelled.");
      const now = FieldValue.serverTimestamp();
      transaction.update(opportunityRef, {
        status: "cancelled",
        cancellationReason: reason,
        updatedAt: now,
      });
      transaction.create(auditRef, {
        actorUserId: actor.uid,
        action: "donor_opportunity.cancelled",
        entityType: "donorOpportunity",
        entityId: opportunityRefId,
        organizationId: opportunity.organizationId,
        metadata: { reason },
        createdAt: now,
      });
      transaction.create(notificationRef, {
        recipientUserId: opportunity.donorId,
        type: "donation",
        title: "Donation opportunity cancelled",
        body: reason || "The blood bank cancelled this donation opportunity.",
        relatedEntityType: "donorOpportunity",
        relatedEntityId: opportunityRefId,
        createdAt: now,
      });
      return { status: "cancelled" };
    });
  }

  const componentType = parseText(input.componentType, "Donation component", 32, true);
  const unitsCollected = input.unitsCollected;
  if (!components.includes(componentType as BloodComponent)) {
    throw new Error("A supported donation component is required.");
  }
  if (typeof unitsCollected !== "number" || !Number.isSafeInteger(unitsCollected) || unitsCollected <= 0) {
    throw new Error("Collected units must be a positive whole number.");
  }
  const donationId = `donor-opportunity-${createHash("sha256").update(opportunityRefId).digest("hex")}`;
  const donationRef = actor.db.collection("donations").doc(donationId);
  return actor.db.runTransaction(async (transaction) => {
    await verifyStaffInTransaction(transaction, actor);
    const opportunitySnapshot = await transaction.get(opportunityRef);
    if (!opportunitySnapshot.exists) throw new Error("Donor opportunity not found.");
    const opportunity = opportunitySnapshot.data()!;
    if (opportunity.status === "completed" && opportunity.donationId === donationId) {
      const existingDonation = await transaction.get(donationRef);
      if (!existingDonation.exists || existingDonation.data()?.opportunityId !== opportunityRefId) {
        throw new Error("Completed opportunity donation record is inconsistent.");
      }
      return { status: "completed", donationId, idempotent: true };
    }
    if (
      opportunity.status !== "scheduled"
      || (actor.organizationId && opportunity.organizationId !== actor.organizationId)
      || opportunity.organizationType !== "bloodBank"
    ) throw new Error("Only a scheduled opportunity owned by this blood bank can be completed.");
    const donorRef = actor.db.collection("users").doc(opportunity.donorId);
    const donorProfileRef = actor.db.collection("donorProfiles").doc(opportunity.donorId);
    const organizationRef = actor.db.collection("organizations").doc(opportunity.organizationId);
    const [donorSnapshot, donorProfileSnapshot, organizationSnapshot, existingDonation] = await Promise.all([
      transaction.get(donorRef),
      transaction.get(donorProfileRef),
      transaction.get(organizationRef),
      transaction.get(donationRef),
    ]);
    const donorProfile = donorProfileSnapshot.data();
    const appointmentDate = opportunity.appointmentAt as { toDate?: () => Date } | undefined;
    const donationDate = appointmentDate?.toDate?.();
    if (
      !donorSnapshot.exists
      || donorSnapshot.data()?.role !== "donor"
      || donorSnapshot.data()?.status === "disabled"
      || !donorProfileSnapshot.exists
      || !donorProfile
      || !bloodGroups.includes(donorProfile?.bloodGroup)
      || !["positive", "negative"].includes(donorProfile?.rhFactor)
      || !donorDateIsValid(donationDate)
      || !organizationSnapshot.exists
      || organizationSnapshot.data()?.verificationStatus !== "verified"
      || organizationSnapshot.data()?.type !== "bloodBank"
    ) {
      throw new Error("Donor, appointment, or verified organization data is incomplete.");
    }
    if (donorProfile.bloodGroup !== opportunity.bloodGroup) {
      throw new Error("Opportunity blood group no longer matches the donor profile.");
    }
    if (existingDonation.exists) {
      throw new Error("A donation record already exists for this opportunity.");
    }
    const now = FieldValue.serverTimestamp();
    transaction.create(donationRef, {
      donorId: opportunity.donorId,
      bloodBankId: opportunity.organizationId,
      componentType,
      bloodGroup: donorProfile.bloodGroup,
      rhFactor: donorProfile.rhFactor,
      unitsCollected,
      donationDate: Timestamp.fromDate(donationDate),
      status: "completed",
      opportunityId: opportunityRefId,
      verifiedBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    });
    transaction.update(donorProfileRef, {
      lastDonationAt: Timestamp.fromDate(donationDate),
      updatedAt: now,
    });
    transaction.update(opportunityRef, {
      status: "completed",
      completedBy: actor.uid,
      completedAt: now,
      donationId,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      actorUserId: actor.uid,
      action: "donor_opportunity.completed",
      entityType: "donorOpportunity",
      entityId: opportunityRefId,
      organizationId: opportunity.organizationId,
      metadata: { donorId: opportunity.donorId, donationId, unitsCollected, componentType },
      createdAt: now,
    });
    transaction.create(notificationRef, {
      recipientUserId: opportunity.donorId,
      type: "donation",
      title: "Donation recorded",
      body: "Your completed donation has been added to your history.",
      relatedEntityType: "donorOpportunity",
      relatedEntityId: opportunityRefId,
      createdAt: now,
    });
    return { status: "completed", donationId, idempotent: false };
  });
}

function donorDateIsValid(value: Date | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
