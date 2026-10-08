import { createHash } from "node:crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { requireTrustedAdmin } from "@/lib/adminAuth";
import { getAdminServices } from "@/lib/firebaseAdmin";
import type { OrganizationRequest, OrganizationType } from "@/types/domain";

type RequestedOrganizationDetails = {
  name: string;
  legalName?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city: string;
  state?: string;
  country?: string;
};

const organizationTypes: OrganizationType[] = ["hospital", "bloodBank"];
const optionalTextFields = [
  "legalName",
  "registrationNumber",
  "email",
  "phone",
  "address",
  "state",
  "country",
] as const;

function readText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${field} is too long.`);
  return result;
}

function parseOrganizationDetails(
  input: Record<string, unknown>,
  profile: DocumentData,
): RequestedOrganizationDetails {
  const name = readText(input.name, "Organization name", 160);
  const city = readText(input.city, "City", 100);
  const legalName = readText(input.legalName, "Legal name", 200);
  const registrationNumber = readText(input.registrationNumber, "Registration number", 120);
  const address = readText(input.address, "Address", 250);
  const state = readText(input.state, "State or region", 100);
  const country = readText(input.country, "Country", 100);
  const email = readText(input.email, "Contact email", 254) || readText(profile.email, "Account email", 254);
  const phone = readText(input.phone, "Contact phone", 40) || readText(profile.phone, "Account phone", 40);

  if (!name || !city) throw new Error("Organization name and city are required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid contact email address.");
  }
  if (phone && !/^\+?[\d\s().-]{7,24}$/.test(phone)) {
    throw new Error("Enter a valid contact phone number.");
  }
  if (!email && !phone) throw new Error("A contact email or phone number is required.");

  return {
    name,
    city,
    ...(legalName ? { legalName } : {}),
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(state ? { state } : {}),
    ...(country ? { country } : {}),
  };
}

function identityFor(type: OrganizationType, details: RequestedOrganizationDetails) {
  const normalized = `${type}|${details.name.normalize("NFKC").trim().toLocaleLowerCase("en-US")}|${details.city.normalize("NFKC").trim().toLocaleLowerCase("en-US")}`;
  const hash = createHash("sha256").update(normalized).digest("hex");
  return { id: `org_${hash.slice(0, 40)}`, key: hash };
}

export function organizationMembershipId(organizationId: string, userId: string) {
  return `${organizationId}_${userId}`;
}

export async function requireVerifiedOrganizationActor(
  idToken: string,
  expectedType: OrganizationType,
) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const userSnapshot = await db.collection("users").doc(decoded.uid).get();
  const user = userSnapshot.data();
  const expectedRole = expectedType === "hospital" ? "hospital" : "bloodBank";
  if (
    !userSnapshot.exists
    || user?.role !== expectedRole
    || user.status === "disabled"
    || typeof user.organizationId !== "string"
    || !user.organizationId
  ) {
    throw new Error(`${expectedType === "hospital" ? "Hospital" : "Blood-bank"} authorization is required.`);
  }

  const organizationId = user.organizationId;
  const [organizationSnapshot, memberSnapshot] = await Promise.all([
    db.collection("organizations").doc(organizationId).get(),
    db.collection("organizationMembers")
      .doc(organizationMembershipId(organizationId, decoded.uid))
      .get(),
  ]);
  const member = memberSnapshot.data();
  if (
    !organizationSnapshot.exists
    || organizationSnapshot.data()?.type !== expectedType
    || organizationSnapshot.data()?.verificationStatus !== "verified"
    || !memberSnapshot.exists
    || member?.organizationId !== organizationId
    || member?.userId !== decoded.uid
    || member?.status !== "active"
  ) {
    throw new Error("Verified active organization membership is required.");
  }
  return { auth, db, uid: decoded.uid, organizationId };
}

function serializeTimestamp(value: unknown) {
  return value && typeof value === "object" && "toDate" in value
    && typeof value.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

function serializeRequest(id: string, data: DocumentData): OrganizationRequest & {
  createdAt: string | null;
  updatedAt: string | null;
  decidedAt: string | null;
} {
  return {
    ...data,
    id,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    decidedAt: serializeTimestamp(data.decidedAt),
  } as OrganizationRequest & {
    createdAt: string | null;
    updatedAt: string | null;
    decidedAt: string | null;
  };
}

export async function getOnboardingStatus(idToken: string) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const userSnapshot = await db.collection("users").doc(decoded.uid).get();
  const user = userSnapshot.data();
  if (
    !userSnapshot.exists
    || typeof user?.role !== "string"
    || !organizationTypes.includes(user.role as OrganizationType)
    || user?.status === "disabled"
  ) {
    throw new Error("Active hospital or blood-bank account is required.");
  }

  const type = user.role as OrganizationType;
  const [requestsSnapshot, legacyRequestsSnapshot] = await Promise.all([
    db.collection("organizationRequests").where("requesterUserId", "==", decoded.uid).get(),
    db.collection("organizationRequests").where("requestedBy", "==", decoded.uid).get(),
  ]);
  const requests = [...requestsSnapshot.docs, ...legacyRequestsSnapshot.docs]
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .map((item) => serializeRequest(item.id, item.data()))
    .filter((item) => item.type === type)
    .sort((left, right) =>
      (right.createdAt ? Date.parse(right.createdAt) : 0)
      - (left.createdAt ? Date.parse(left.createdAt) : 0),
    );

  let organization: Record<string, unknown> | null = null;
  let operationalAccess = false;
  if (typeof user.organizationId === "string" && user.organizationId) {
    const [organizationSnapshot, memberSnapshot] = await Promise.all([
      db.collection("organizations").doc(user.organizationId).get(),
      db.collection("organizationMembers")
        .doc(organizationMembershipId(user.organizationId, decoded.uid))
        .get(),
    ]);
    const orgData = organizationSnapshot.data();
    const member = memberSnapshot.data();
    operationalAccess = organizationSnapshot.exists
      && orgData?.type === type
      && orgData?.verificationStatus === "verified"
      && memberSnapshot.exists
      && member?.organizationId === user.organizationId
      && member?.userId === decoded.uid
      && member?.status === "active";
    if (operationalAccess) {
      organization = {
        id: organizationSnapshot.id,
        name: orgData?.name,
        city: orgData?.city,
        state: orgData?.state,
        country: orgData?.country,
        verificationStatus: orgData?.verificationStatus,
      };
    }
  }
  return { type, request: requests[0] ?? null, requests, organization, operationalAccess };
}

export async function submitOrganizationRequest(
  idToken: string,
  body: unknown,
) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("A JSON object is required.");
  }
  const input = body as Record<string, unknown>;
  if (!organizationTypes.includes(input.type as OrganizationType)) {
    throw new Error("Organization type must be hospital or bloodBank.");
  }
  const type = input.type as OrganizationType;
  const allowedKeys = new Set(["type", "name", ...optionalTextFields, "city"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error("Unsupported organization request fields were provided.");
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const userSnapshot = await userRef.get();
  const user = userSnapshot.data();
  const expectedRole = type === "hospital" ? "hospital" : "bloodBank";
  if (
    !userSnapshot.exists
    || user?.role !== expectedRole
    || user.status === "disabled"
  ) {
    throw new Error(`${type === "hospital" ? "Hospital" : "Blood-bank"} authorization is required.`);
  }
  const details = parseOrganizationDetails(input, user);
  const requestRef = db.collection("organizationRequests").doc();
  const auditRef = db.collection("auditLogs").doc();
  const notificationRef = db.collection("notifications").doc();

  await db.runTransaction(async (transaction) => {
    const currentUser = await transaction.get(userRef);
    const currentProfile = currentUser.data();
    if (
      !currentUser.exists
      || currentProfile?.role !== expectedRole
      || currentProfile.status === "disabled"
    ) {
      throw new Error(`${type === "hospital" ? "Hospital" : "Blood-bank"} authorization is required.`);
    }
    if (typeof currentProfile.organizationId === "string" && currentProfile.organizationId) {
      const [organizationSnapshot, memberSnapshot] = await Promise.all([
        transaction.get(db.collection("organizations").doc(currentProfile.organizationId)),
        transaction.get(db.collection("organizationMembers")
          .doc(organizationMembershipId(currentProfile.organizationId, decoded.uid))),
      ]);
      if (
        organizationSnapshot.exists
        && organizationSnapshot.data()?.type === type
        && organizationSnapshot.data()?.verificationStatus === "verified"
        && memberSnapshot.exists
        && memberSnapshot.data()?.organizationId === currentProfile.organizationId
        && memberSnapshot.data()?.userId === decoded.uid
        && memberSnapshot.data()?.status === "active"
      ) {
        throw new Error("Your verified organization is already configured.");
      }
    }
    const [pendingSnapshot, legacyPendingSnapshot, administrators] = await Promise.all([
      transaction.get(db.collection("organizationRequests")
        .where("requesterUserId", "==", decoded.uid)),
      transaction.get(db.collection("organizationRequests")
        .where("requestedBy", "==", decoded.uid)),
      transaction.get(db.collection("users").where("role", "==", "administrator")),
    ]);
    if ([...pendingSnapshot.docs, ...legacyPendingSnapshot.docs]
      .some((item) => item.data().status === "pending")) {
      throw new Error("An organization request is already pending.");
    }
    const timestamp = FieldValue.serverTimestamp();
    transaction.create(requestRef, {
      type,
      requesterUserId: decoded.uid,
      ...details,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.create(auditRef, {
      actorUserId: decoded.uid,
      action: "organization.onboarding.submitted",
      entityType: "organizationRequest",
      entityId: requestRef.id,
      organizationId: "",
      metadata: { type, city: details.city },
      createdAt: timestamp,
    });
    transaction.create(notificationRef, {
      recipientUserId: decoded.uid,
      type: "system",
      title: "Organization request submitted",
      body: "Your organization details were submitted for administrator review.",
      relatedEntityType: "organizationRequest",
      relatedEntityId: requestRef.id,
      createdAt: timestamp,
    });
    administrators.docs
      .filter((item) => item.data().status !== "disabled")
      .forEach((item) => {
        transaction.create(db.collection("notifications").doc(), {
          recipientUserId: item.id,
          type: "system",
          title: "Organization verification request",
          body: `A ${type === "hospital" ? "hospital" : "blood bank"} requested verification: ${details.name}, ${details.city}.`,
          relatedEntityType: "organizationRequest",
          relatedEntityId: requestRef.id,
          createdAt: timestamp,
        });
      });
  });
  return { requestId: requestRef.id };
}

export async function listOrganizationRequests(idToken: string) {
  const { db } = await requireTrustedAdmin(idToken);
  const snapshot = await db.collection("organizationRequests").get();
  const requestItems = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    createdAt: serializeTimestamp(item.data().createdAt),
    updatedAt: serializeTimestamp(item.data().updatedAt),
    decidedAt: serializeTimestamp(item.data().decidedAt),
  })) as Array<DocumentData & {
    id: string;
    requesterUserId?: string;
    requestedBy?: string;
    decidedBy?: string;
  }>;
  const requesterIds = [...new Set(requestItems.map((item) => item.requesterUserId ?? item.requestedBy).filter(
    (uid): uid is string => typeof uid === "string",
  ))];
  const reviewerIds = [...new Set(requestItems.map((item) => item.decidedBy).filter(
    (uid): uid is string => typeof uid === "string",
  ))];
  const profileIds = [...new Set([...requesterIds, ...reviewerIds])];
  const profiles = new Map<string, DocumentData>();
  await Promise.all(profileIds.map(async (uid) => {
    const snapshot = await db.collection("users").doc(uid).get();
    if (snapshot.exists) profiles.set(uid, snapshot.data()!);
  }));
  return requestItems.map((item) => {
    const requesterUserId = item.requesterUserId ?? item.requestedBy;
    const requester = typeof requesterUserId === "string"
      ? profiles.get(requesterUserId)
      : undefined;
    const reviewer = typeof item.decidedBy === "string" ? profiles.get(item.decidedBy) : undefined;
    return {
      ...item,
      requesterUserId,
      requesterName: typeof requester?.name === "string" ? requester.name : "Unknown user",
      requesterEmail: typeof requester?.email === "string" ? requester.email : "",
      requesterPhone: typeof requester?.phone === "string" ? requester.phone : "",
      decidedByName: typeof reviewer?.name === "string"
        ? reviewer.name
        : typeof reviewer?.email === "string" ? reviewer.email : item.decidedBy ?? "",
    };
  });
}

export async function decideOrganizationRequest(
  idToken: string,
  requestId: string,
  action: "approve" | "reject",
  rejectionReason = "",
) {
  const { decoded, db } = await requireTrustedAdmin(idToken);
  const reason = rejectionReason.trim();
  if (action !== "approve" && action !== "reject") {
    throw new Error("Unsupported organization decision.");
  }
  if (action === "reject" && (reason.length < 5 || reason.length > 1000)) {
    throw new Error("Enter a rejection reason between 5 and 1000 characters.");
  }
  const requestRef = db.collection("organizationRequests").doc(requestId);
  const auditRef = db.collection("auditLogs").doc();
  const notificationRef = db.collection("notifications").doc();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Organization request not found.");
    const request = snapshot.data() as OrganizationRequest & { requestedBy?: string };
    const requesterUserId = request.requesterUserId || request.requestedBy;
    if (!requesterUserId) throw new Error("Organization request has no requester.");
    const targetStatus = action === "approve" ? "approved" : "rejected";
    if (request.status === targetStatus) {
      return { status: request.status, organizationId: request.organizationId ?? null };
    }
    if (request.status !== "pending") {
      throw new Error("This organization request has already been decided.");
    }
    if (!organizationTypes.includes(request.type)) {
      throw new Error("Organization request type is invalid.");
    }
    const userRef = db.collection("users").doc(requesterUserId);
    const profileRef = await transaction.get(userRef);
    if (!profileRef.exists || profileRef.data()?.status === "disabled") {
      throw new Error("The requesting account is unavailable.");
    }
    const now = FieldValue.serverTimestamp();
    if (action === "reject") {
      transaction.update(requestRef, {
        status: "rejected",
        rejectionReason: reason,
        decidedAt: now,
        decidedBy: decoded.uid,
        updatedAt: now,
        organizationId: FieldValue.delete(),
      });
      transaction.create(auditRef, {
        actorUserId: decoded.uid,
        action: "organization.onboarding.rejected",
        entityType: "organizationRequest",
        entityId: requestId,
        organizationId: "",
        metadata: { type: request.type, rejectionReason: reason },
        createdAt: now,
      });
      transaction.create(notificationRef, {
        recipientUserId: requesterUserId,
        type: "system",
        title: "Organization verification needs action",
        body: reason,
        relatedEntityType: "organizationRequest",
        relatedEntityId: requestId,
        createdAt: now,
      });
      return { status: "rejected", organizationId: null };
    }

    const expectedRole = request.type === "hospital" ? "hospital" : "bloodBank";
    const profile = profileRef.data()!;
    if (profile.role !== expectedRole) {
      throw new Error("The requester role does not match this organization request.");
    }
    const details: RequestedOrganizationDetails = {
      name: request.name,
      city: request.city,
      ...(request.legalName ? { legalName: request.legalName } : {}),
      ...(request.registrationNumber ? { registrationNumber: request.registrationNumber } : {}),
      ...(request.email ? { email: request.email } : {}),
      ...(request.phone ? { phone: request.phone } : {}),
      ...(request.address ? { address: request.address } : {}),
      ...(request.state ? { state: request.state } : {}),
      ...(request.country ? { country: request.country } : {}),
    };
    const identity = identityFor(request.type, details);
    if (profile.organizationId && profile.organizationId !== identity.id) {
      throw new Error("The requester already belongs to another organization.");
    }
    const organizationRef = db.collection("organizations").doc(identity.id);
    const memberRef = db.collection("organizationMembers")
      .doc(organizationMembershipId(identity.id, requesterUserId));
    const [organizationSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(memberRef),
    ]);
    const existingOrganization = organizationSnapshot.data();
    if (
      organizationSnapshot.exists
      && existingOrganization?.identityKey
      && existingOrganization.identityKey !== identity.key
    ) {
      throw new Error("Organization identity conflicts with an existing record.");
    }
    const existingMember = memberSnapshot.data();
    if (
      memberSnapshot.exists
      && (existingMember?.userId !== requesterUserId
        || existingMember?.organizationId !== identity.id)
    ) {
      throw new Error("Organization membership conflicts with an existing record.");
    }

    transaction.set(organizationRef, {
      ...details,
      type: request.type,
      identityKey: identity.key,
      verificationStatus: "verified",
      ...(organizationSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.set(memberRef, {
      organizationId: identity.id,
      userId: requesterUserId,
      role: "owner",
      status: "active",
      ...(memberSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.update(userRef, {
      role: expectedRole,
      organizationId: identity.id,
      updatedAt: now,
    });
    transaction.update(requestRef, {
      status: "approved",
      organizationId: identity.id,
      decidedAt: now,
      decidedBy: decoded.uid,
      updatedAt: now,
      rejectionReason: FieldValue.delete(),
    });
    transaction.create(auditRef, {
      actorUserId: decoded.uid,
      action: "organization.onboarding.approved",
      entityType: "organizationRequest",
      entityId: requestId,
      organizationId: identity.id,
      metadata: { type: request.type, requesterUserId },
      createdAt: now,
    });
    transaction.create(notificationRef, {
      recipientUserId: requesterUserId,
      type: "system",
      title: "Organization verified",
      body: "Your organization has been verified. Operational access is now available.",
      relatedEntityType: "organizationRequest",
      relatedEntityId: requestId,
      createdAt: now,
    });
    return { status: "approved", organizationId: identity.id };
  });
}
