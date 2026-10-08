import { FieldValue, type DocumentData, type Firestore, type Transaction } from "firebase-admin/firestore";
import { createNotification } from "@/lib/notifications";
import { requireTrustedAdmin } from "@/lib/adminAuth";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";
import type { BloodRequest } from "@/types/domain";

export type AdminTriageAction =
  | "acknowledge"
  | "assign_to_me"
  | "review_message"
  | "request_information";

const activeStatuses = ["submitted", "under_review", "needs_information"];

function assertAdminProfile(profile: DocumentData | undefined, exists: boolean) {
  if (!exists || profile?.role !== "administrator" || profile.status === "disabled") {
    throw new Error("Administrator authorization is required.");
  }
}

function writeEventAndAudit(
  transaction: Transaction,
  db: Firestore,
  input: {
    requestId: string;
    actorUserId: string;
    organizationId: string;
    eventType: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const eventRef = db.collection("bloodRequestEvents").doc();
  transaction.set(eventRef, {
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
  const auditRef = db.collection("auditLogs").doc();
  transaction.set(auditRef, {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "bloodRequest",
    entityId: input.requestId,
    organizationId: input.organizationId,
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function updateRequestTriage(
  idToken: string,
  requestId: string,
  action: AdminTriageAction,
  message = "",
) {
  const { decoded, db } = await requireTrustedAdmin(idToken);
  const cleanMessage = message.trim();
  if (action === "review_message" || action === "request_information") {
    if (cleanMessage.length < 5 || cleanMessage.length > 1000) {
      throw new Error("Enter a hospital-visible message between 5 and 1000 characters.");
    }
  }

  const result = await db.runTransaction(async (transaction) => {
    const [requestSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(db.collection("bloodRequests").doc(requestId)),
      transaction.get(db.collection("users").doc(decoded.uid)),
    ]);
    assertAdminProfile(profileSnapshot.data(), profileSnapshot.exists);
    if (!requestSnapshot.exists) throw new Error("Blood request not found.");

    const request = requestSnapshot.data() as BloodRequest;
    if (!activeStatuses.includes(request.status)) {
      throw new Error("This request is no longer active for triage.");
    }
    if (request.ownerUserId && request.ownerUserId !== decoded.uid) {
      throw new Error("This request is assigned to another administrator.");
    }

    if (action === "assign_to_me") {
      if (request.ownerUserId === decoded.uid) return { createdBy: "", notification: "" };
      transaction.update(requestSnapshot.ref, {
        ownerUserId: decoded.uid,
        assignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeEventAndAudit(transaction, db, {
        requestId,
        actorUserId: decoded.uid,
        organizationId: request.hospitalId,
        eventType: "assigned",
        action: "request.assigned",
        metadata: { ownerUserId: decoded.uid },
      });
      return { createdBy: "", notification: "" };
    }

    if (action === "acknowledge") {
      if (request.status !== "submitted") {
        throw new Error("Only a submitted request can be acknowledged.");
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(requestSnapshot.ref, {
        status: "under_review",
        acknowledgedAt: now,
        firstResponseAt: request.firstResponseAt ?? now,
        updatedAt: now,
      });
      writeEventAndAudit(transaction, db, {
        requestId,
        actorUserId: decoded.uid,
        organizationId: request.hospitalId,
        eventType: "acknowledged",
        action: "request.acknowledged",
      });
      return { createdBy: request.createdBy, notification: "acknowledged" };
    }

    if (action === "review_message") {
      if (request.status !== "under_review") {
        throw new Error("A request must be acknowledged before sending a review message.");
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(requestSnapshot.ref, {
        firstResponseAt: request.firstResponseAt ?? now,
        updatedAt: now,
      });
      writeEventAndAudit(transaction, db, {
        requestId,
        actorUserId: decoded.uid,
        organizationId: request.hospitalId,
        eventType: "review_message",
        action: "request.review_message",
        metadata: { message: cleanMessage, visibility: "hospital" },
      });
      return { createdBy: request.createdBy, notification: "" };
    }

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("This request is not ready for another information request.");
    }
    const now = FieldValue.serverTimestamp();
    const newlyAcknowledged = !request.acknowledgedAt;
    transaction.update(requestSnapshot.ref, {
      status: "needs_information",
      acknowledgedAt: request.acknowledgedAt ?? now,
      firstResponseAt: request.firstResponseAt ?? now,
      updatedAt: now,
    });
    if (newlyAcknowledged) {
      writeEventAndAudit(transaction, db, {
        requestId,
        actorUserId: decoded.uid,
        organizationId: request.hospitalId,
        eventType: "acknowledged",
        action: "request.acknowledged",
      });
    }
    const publicMetadata = { message: cleanMessage, visibility: "hospital" };
    writeEventAndAudit(transaction, db, {
      requestId,
      actorUserId: decoded.uid,
      organizationId: request.hospitalId,
      eventType: "review_message",
      action: "request.review_message",
      metadata: publicMetadata,
    });
    writeEventAndAudit(transaction, db, {
      requestId,
      actorUserId: decoded.uid,
      organizationId: request.hospitalId,
      eventType: "information_requested",
      action: "request.information_requested",
      metadata: publicMetadata,
    });
    return {
      createdBy: request.createdBy,
      notification: newlyAcknowledged ? "acknowledged_and_information" : "information",
      message: cleanMessage,
    };
  });

  if (result.createdBy && result.notification.includes("acknowledged")) {
    await createNotification({
      recipientUserId: result.createdBy,
      type: "request",
      title: "Request acknowledged",
      body: "An administrator has acknowledged your blood request for review.",
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
  }
  if (result.createdBy && result.notification.includes("information")) {
    await createNotification({
      recipientUserId: result.createdBy,
      type: "request",
      title: "Information requested for your blood request",
      body: result.message ?? "Please review the request activity for details.",
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
  }
}

export async function respondToInformationRequest(
  idToken: string,
  requestId: string,
  message: string,
) {
  const actor = await requireVerifiedOrganizationActor(idToken, "hospital");
  const { db } = actor;
  const cleanMessage = message.trim();
  if (cleanMessage.length < 2 || cleanMessage.length > 1000) {
    throw new Error("Enter a response between 2 and 1000 characters.");
  }

  const result = await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(db.collection("bloodRequests").doc(requestId));
    if (!requestSnapshot.exists) throw new Error("Blood request not found.");
    const request = requestSnapshot.data() as BloodRequest;
    if (request.hospitalId !== actor.organizationId) {
      throw new Error("Hospital authorization is required for this request.");
    }
    if (request.status !== "needs_information") {
      throw new Error("This request is not waiting for hospital information.");
    }

    transaction.update(requestSnapshot.ref, {
      status: "under_review",
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeEventAndAudit(transaction, db, {
      requestId,
      actorUserId: actor.uid,
      organizationId: request.hospitalId,
      eventType: "hospital_response",
      action: "request.hospital_responded",
      metadata: { message: cleanMessage, visibility: "hospital" },
    });
    return { createdBy: request.createdBy };
  });

  if (result.createdBy) {
    await createNotification({
      recipientUserId: result.createdBy,
      type: "request",
      title: "Hospital response received",
      body: "A response was added to the blood request and it is back under review.",
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
  }
}
