import { FieldValue } from "firebase-admin/firestore";
import type { BloodRequest, FulfillmentAllocation } from "@/types/domain";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";

export async function approveRequestWithTrustedAdmin(
  idToken: string,
  requestId: string,
) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.admin !== true) throw new Error("Administrator authorization is required.");

  const userProfile = await db.collection("users").doc(decoded.uid).get();
  if (
    !userProfile.exists
    || userProfile.data()?.role !== "administrator"
    || userProfile.data()?.status === "disabled"
  ) {
    throw new Error("Administrator authorization is required.");
  }

  const result = await db.runTransaction(async (transaction) => {
    const requestRef = db.collection("bloodRequests").doc(requestId);
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new Error("Blood request not found.");
    const request = { ...requestSnapshot.data(), id: requestId } as BloodRequest;
    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("This request is not awaiting approval.");
    }

    const inventorySnapshot = await transaction.get(
      db.collection("bloodInventory")
        .where("bloodGroup", "==", request.bloodGroup),
    );
    const eligible = inventorySnapshot.docs
      .filter((item) => {
      const data = item.data();
      return (
        data.status === "available" &&
        typeof data.bloodBankId === "string" &&
        data.bloodBankId.length > 0 &&
        data.componentType === request.componentType &&
        (!request.rhFactor || data.rhFactor === request.rhFactor) &&
        data.unitsAvailable > 0 &&
        (!data.expiryDate || data.expiryDate.toMillis() >= Date.now())
      );
      })
      .sort((left, right) => {
        const leftExpiry = left.data().expiryDate?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        const rightExpiry = right.data().expiryDate?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        return leftExpiry - rightExpiry;
      });
    const available = eligible.reduce(
      (total, item) => total + Number(item.data().unitsAvailable || 0),
      0,
    );
    if (available < request.unitsRequested) {
      throw new Error(`Insufficient stock. Only ${available} matching units are available.`);
    }

    let remaining = request.unitsRequested;
    const allocations: FulfillmentAllocation[] = [];
    for (const item of eligible) {
      if (remaining === 0) break;
      const data = item.data();
      const allocated = Math.min(remaining, Number(data.unitsAvailable));
      allocations.push({
        bloodBankId: data.bloodBankId,
        inventoryId: item.id,
        unitsReserved: allocated,
        unitsDispatched: 0,
        unitsReceived: 0,
        status: "reserved",
      });
      transaction.update(item.ref, {
        unitsAvailable: Number(data.unitsAvailable) - allocated,
        unitsReserved: Number(data.unitsReserved || 0) + allocated,
        updatedAt: FieldValue.serverTimestamp(),
      });
      remaining -= allocated;
    }

    transaction.update(requestRef, {
      status: "approved",
      unitsFulfilled: 0,
      unitsDispatched: 0,
      fulfillmentAllocations: allocations,
      assignedBloodBankIds: [...new Set(allocations.map((item) => item.bloodBankId))],
      updatedAt: FieldValue.serverTimestamp(),
    });
    const eventRef = db.collection("bloodRequestEvents").doc();
    transaction.set(eventRef, {
      requestId,
      actorUserId: decoded.uid,
      eventType: "approved",
      metadata: { unitsReserved: request.unitsRequested },
      createdAt: FieldValue.serverTimestamp(),
    });
    const auditRef = db.collection("auditLogs").doc();
    transaction.set(auditRef, {
      actorUserId: decoded.uid,
      action: "request.approved",
      entityType: "bloodRequest",
      entityId: requestId,
      organizationId: request.hospitalId,
      metadata: { unitsReserved: request.unitsRequested },
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "approved" as const, createdBy: request.createdBy };
  });
  if (result.createdBy) {
    await createNotification({
      recipientUserId: result.createdBy,
      type: "approval",
      title: "Blood request approved",
      body: "Your blood request was approved and matching stock was reserved.",
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
  }
  return { status: result.status };
}

export async function rejectRequestWithTrustedAdmin(
  idToken: string,
  requestId: string,
  reason: string,
) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.admin !== true) throw new Error("Administrator authorization is required.");
  const userProfile = await db.collection("users").doc(decoded.uid).get();
  if (
    !userProfile.exists
    || userProfile.data()?.role !== "administrator"
    || userProfile.data()?.status === "disabled"
  ) {
    throw new Error("Administrator authorization is required.");
  }
  if (!reason.trim()) throw new Error("A rejection reason is required.");

  const result = await db.runTransaction(async (transaction) => {
    const requestRef = db.collection("bloodRequests").doc(requestId);
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Blood request not found.");
    const request = snapshot.data() as BloodRequest;
    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("This request is not awaiting review.");
    }
    transaction.update(requestRef, {
      status: "rejected",
      updatedAt: FieldValue.serverTimestamp(),
    });
    const eventRef = db.collection("bloodRequestEvents").doc();
    transaction.set(eventRef, {
      requestId,
      actorUserId: decoded.uid,
      eventType: "rejected",
      metadata: { reason: reason.trim() },
      createdAt: FieldValue.serverTimestamp(),
    });
    const auditRef = db.collection("auditLogs").doc();
    transaction.set(auditRef, {
      actorUserId: decoded.uid,
      action: "request.rejected",
      entityType: "bloodRequest",
      entityId: requestId,
      organizationId: request.hospitalId,
      metadata: { reason: reason.trim() },
      createdAt: FieldValue.serverTimestamp(),
    });
    return { createdBy: request.createdBy };
  });
  if (result.createdBy) {
    await createNotification({
      recipientUserId: result.createdBy,
      type: "request",
      title: "Blood request rejected",
      body: `Your blood request was rejected: ${reason.trim()}`,
      relatedEntityType: "bloodRequest",
      relatedEntityId: requestId,
    });
  }
}
