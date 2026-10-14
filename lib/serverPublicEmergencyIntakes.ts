import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebaseAdmin";
import type { BloodComponent, BloodGroup, RequestUrgency } from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];
const intakeStatuses = [
  "received",
  "under_review",
  "contacted",
  "closed",
  "unable_to_fulfill",
] as const;

export type PublicEmergencyIntakeStatus = typeof intakeStatuses[number];

export type PublicEmergencyIntakeInput = {
  requesterName: string;
  requesterPhone: string;
  bloodGroup: BloodGroup;
  componentType: BloodComponent;
  unitsNeeded: number;
  facilityName: string;
  locality: string;
  urgency: RequestUrgency;
  neededBy: Date;
  note: string;
};

export class PublicIntakeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizedText(value: unknown, field: string, maxLength: number, required = true) {
  if (typeof value !== "string") {
    throw new PublicIntakeError(`${field} must be text.`, 400);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    (required && normalized.length < 2)
    || normalized.length > maxLength
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)
  ) {
    throw new PublicIntakeError(`${field} is invalid or too long.`, 400);
  }
  return normalized;
}

export function validatePublicEmergencyIntake(
  value: unknown,
): PublicEmergencyIntakeInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PublicIntakeError("A valid request form is required.", 400);
  }
  const input = value as Record<string, unknown>;
  const allowedFields = new Set([
    "requesterName",
    "requesterPhone",
    "bloodGroup",
    "componentType",
    "unitsNeeded",
    "facilityName",
    "locality",
    "urgency",
    "neededBy",
    "note",
    "website",
  ]);
  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    throw new PublicIntakeError("The request contains unsupported fields.", 400);
  }
  if (typeof input.website !== "string") {
    throw new PublicIntakeError("The request form is invalid.", 400);
  }
  if (input.website.trim()) {
    throw new PublicIntakeError("The request could not be accepted.", 400);
  }

  const requesterName = normalizedText(input.requesterName, "Requester name", 120);
  const rawPhone = normalizedText(input.requesterPhone, "Contact phone", 40)
    .replace(/[\s().-]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(rawPhone)) {
    throw new PublicIntakeError("Enter a valid contact phone number.", 400);
  }
  if (typeof input.bloodGroup !== "string" || !bloodGroups.includes(input.bloodGroup as BloodGroup)) {
    throw new PublicIntakeError("Select a supported blood group.", 400);
  }
  if (
    typeof input.componentType !== "string"
    || !components.includes(input.componentType as BloodComponent)
  ) {
    throw new PublicIntakeError("Select a supported blood component.", 400);
  }
  if (
    typeof input.unitsNeeded !== "number"
    || !Number.isSafeInteger(input.unitsNeeded)
    || input.unitsNeeded < 1
    || input.unitsNeeded > 50
  ) {
    throw new PublicIntakeError("Units needed must be a whole number from 1 to 50.", 400);
  }
  if (!["routine", "urgent", "emergency"].includes(input.urgency as string)) {
    throw new PublicIntakeError("Select a supported urgency level.", 400);
  }
  if (
    typeof input.neededBy !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.neededBy)
  ) {
    throw new PublicIntakeError("Enter a valid required-by date and time.", 400);
  }
  const neededBy = new Date(input.neededBy);
  const now = Date.now();
  if (
    !Number.isFinite(neededBy.getTime())
    || neededBy.toISOString() !== input.neededBy
    || neededBy.getTime() <= now
    || neededBy.getTime() > now + 30 * 24 * 60 * 60 * 1000
  ) {
    throw new PublicIntakeError("The required-by time must be within the next 30 days.", 400);
  }

  return {
    requesterName,
    requesterPhone: rawPhone,
    bloodGroup: input.bloodGroup as BloodGroup,
    componentType: input.componentType as BloodComponent,
    unitsNeeded: input.unitsNeeded,
    facilityName: normalizedText(input.facilityName, "Hospital or facility", 160),
    locality: normalizedText(input.locality, "City or locality", 120),
    urgency: input.urgency as RequestUrgency,
    neededBy,
    note: normalizedText(input.note, "Note", 500, false),
  };
}

function idempotencyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function payloadFingerprint(input: PublicEmergencyIntakeInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      ...input,
      neededBy: input.neededBy.toISOString(),
    }))
    .digest("hex");
}

function serializeTimestamp(value: unknown) {
  return value && typeof value === "object" && "toDate" in value
    && typeof value.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

export async function submitPublicEmergencyIntake(
  input: PublicEmergencyIntakeInput,
  idempotencyKey: string,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new PublicIntakeError("Please refresh the form and try submitting again.", 400);
  }

  const { db } = getAdminServices();
  const keyRef = db.collection("publicEmergencyIntakeKeys").doc(idempotencyHash(idempotencyKey));
  const requestRef = db.collection("publicEmergencyIntakes").doc();
  const auditRef = db.collection("auditLogs").doc();
  const fingerprint = payloadFingerprint(input);

  return db.runTransaction(async (transaction) => {
    const keySnapshot = await transaction.get(keyRef);
    if (keySnapshot.exists) {
      const key = keySnapshot.data()!;
      if (key.payloadFingerprint !== fingerprint) {
        throw new PublicIntakeError(
          "This submission key was already used for a different request. Refresh the form and try again.",
          409,
        );
      }
      return { reference: key.requestId as string, duplicate: true };
    }

    const timestamp = FieldValue.serverTimestamp();
    transaction.create(requestRef, {
      ...input,
      neededBy: Timestamp.fromDate(input.neededBy),
      status: "received" satisfies PublicEmergencyIntakeStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.create(keyRef, {
      requestId: requestRef.id,
      payloadFingerprint: fingerprint,
      createdAt: timestamp,
    });
    transaction.create(auditRef, {
      actorUserId: "public",
      action: "public_emergency_intake.received",
      entityType: "publicEmergencyIntake",
      entityId: requestRef.id,
      organizationId: "",
      metadata: { status: "received" },
      createdAt: timestamp,
    });
    return { reference: requestRef.id, duplicate: false };
  });
}

export async function listPublicEmergencyIntakes(cursor?: string) {
  const { db } = getAdminServices();
  let query = db.collection("publicEmergencyIntakes").orderBy("createdAt", "desc");
  if (cursor) {
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(cursor)) {
      throw new PublicIntakeError("The intake page cursor is invalid.", 400);
    }
    const cursorSnapshot = await db.collection("publicEmergencyIntakes").doc(cursor).get();
    if (!cursorSnapshot.exists) {
      throw new PublicIntakeError("The intake page cursor was not found.", 400);
    }
    query = query.startAfter(cursorSnapshot);
  }
  const snapshot = await query.limit(51).get();

  const pageDocs = snapshot.docs.slice(0, 50);
  const intakes = pageDocs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      reference: item.id,
      requesterName: data.requesterName,
      requesterPhone: data.requesterPhone,
      bloodGroup: data.bloodGroup,
      componentType: data.componentType,
      unitsNeeded: data.unitsNeeded,
      facilityName: data.facilityName,
      locality: data.locality,
      urgency: data.urgency,
      neededBy: serializeTimestamp(data.neededBy),
      note: data.note,
      status: data.status,
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
    };
  });
  return {
    intakes,
    nextCursor: snapshot.size > 50 ? pageDocs[pageDocs.length - 1].id : null,
  };
}

const allowedTransitions: Record<PublicEmergencyIntakeStatus, readonly PublicEmergencyIntakeStatus[]> = {
  received: ["under_review", "contacted", "closed", "unable_to_fulfill"],
  under_review: ["contacted", "closed", "unable_to_fulfill"],
  contacted: ["closed", "unable_to_fulfill"],
  closed: [],
  unable_to_fulfill: [],
};

export async function updatePublicEmergencyIntakeStatus(
  requestId: string,
  status: PublicEmergencyIntakeStatus,
  actorUserId: string,
) {
  if (!intakeStatuses.includes(status)) {
    throw new PublicIntakeError("Select a valid intake status.", 400);
  }
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(requestId)) {
    throw new PublicIntakeError("The intake was not found.", 404);
  }

  const { db } = getAdminServices();
  const requestRef = db.collection("publicEmergencyIntakes").doc(requestId);
  const auditRef = db.collection("auditLogs").doc();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new PublicIntakeError("The intake was not found.", 404);
    const previousStatus = snapshot.data()?.status as PublicEmergencyIntakeStatus;
    if (!intakeStatuses.includes(previousStatus)) {
      throw new PublicIntakeError("The intake has an invalid status and cannot be updated.", 409);
    }
    if (!allowedTransitions[previousStatus].includes(status)) {
      throw new PublicIntakeError("This intake status transition is not allowed.", 409);
    }

    const timestamp = FieldValue.serverTimestamp();
    transaction.update(requestRef, {
      status,
      updatedAt: timestamp,
      updatedBy: actorUserId,
    });
    transaction.create(auditRef, {
      actorUserId,
      action: `public_emergency_intake.${status}`,
      entityType: "publicEmergencyIntake",
      entityId: requestId,
      organizationId: "",
      metadata: { fromStatus: previousStatus, toStatus: status },
      createdAt: timestamp,
    });
    return { status, updatedAt: new Date().toISOString() };
  });
}
