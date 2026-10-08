import { FieldValue } from "firebase-admin/firestore";
import type { BloodRequest, FulfillmentAllocation } from "@/types/domain";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { isOperationallyEligibleInventory } from "@/lib/inventoryAvailability";

type OrganizationActor = {
  uid: string;
  organizationId: string;
  db: ReturnType<typeof getAdminServices>["db"];
};

async function requireOrganizationActor(
  idToken: string,
  expectedRole: "hospital" | "bloodBank",
): Promise<OrganizationActor> {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  const profile = await db.collection("users").doc(decoded.uid).get();
  const data = profile.data();
  if (
    !profile.exists
    || data?.role !== expectedRole
    || data.status === "disabled"
    || typeof data.organizationId !== "string"
    || !data.organizationId
  ) {
    throw new Error(`${expectedRole === "hospital" ? "Hospital" : "Blood-bank"} authorization is required.`);
  }
  return { uid: decoded.uid, organizationId: data.organizationId, db };
}

function requestEvent(
  actorUserId: string,
  requestId: string,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  return {
    requestId,
    actorUserId,
    eventType,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function auditRecord(
  actorUserId: string,
  requestId: string,
  organizationId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  return {
    actorUserId,
    action,
    entityType: "bloodRequest",
    entityId: requestId,
    organizationId,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function notification(
  recipientUserId: string,
  requestId: string,
  title: string,
  body: string,
) {
  return {
    recipientUserId,
    type: "request",
    title,
    body,
    relatedEntityType: "bloodRequest",
    relatedEntityId: requestId,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function readAllocations(request: BloodRequest): FulfillmentAllocation[] {
  return Array.isArray(request.fulfillmentAllocations)
    ? request.fulfillmentAllocations
    : [];
}

function ensureOpenRequest(request: BloodRequest) {
  if (["rejected", "cancelled", "expired", "fulfilled"].includes(request.status)) {
    throw new Error("This request is no longer active for fulfillment.");
  }
}

export async function listBloodBankFulfillmentRequests(idToken: string) {
  const actor = await requireOrganizationActor(idToken, "bloodBank");
  const snapshot = await actor.db.collection("bloodRequests")
    .where("assignedBloodBankIds", "array-contains", actor.organizationId)
    .get();
  const requests = snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }) as BloodRequest)
    .filter((request) =>
      ["approved", "preparing", "dispatched", "partially_fulfilled"].includes(request.status)
      && readAllocations(request).some((allocation) => allocation.bloodBankId === actor.organizationId),
    );

  const hospitalIds = [...new Set(requests.map((request) => request.hospitalId))];
  const hospitals = new Map<string, string>();
  await Promise.all(hospitalIds.map(async (hospitalId) => {
    const organization = await actor.db.collection("organizations").doc(hospitalId).get();
    const name = organization.data()?.name;
    if (typeof name === "string" && name.trim()) hospitals.set(hospitalId, name);
  }));

  return requests
    .map((request) => {
      const allocations = readAllocations(request).filter(
        (item) => item.bloodBankId === actor.organizationId,
      );
      if (allocations.length === 0) return null;
      const neededBy = request.neededBy as { toDate?: () => Date } | undefined;
      return {
        id: request.id,
        hospitalId: request.hospitalId,
        hospitalName: request.hospitalName,
        hospitalDisplayName: hospitals.get(request.hospitalId) || request.hospitalName || request.hospitalId,
        patientName: request.patientName,
        caseId: request.caseId,
        bloodGroup: request.bloodGroup,
        rhFactor: request.rhFactor,
        componentType: request.componentType,
        unitsRequested: request.unitsRequested,
        unitsFulfilled: request.unitsFulfilled || 0,
        urgency: request.urgency,
        priority: request.priority,
        status: request.status,
        neededBy: neededBy?.toDate?.().toISOString() || null,
        notes: request.notes,
        unitsDispatched: request.unitsDispatched || 0,
        allocations,
      };
    })
    .filter((request): request is NonNullable<typeof request> => request !== null)
    .sort((left, right) =>
      (right.urgency === "emergency" ? 1 : 0) - (left.urgency === "emergency" ? 1 : 0)
      || right.priority - left.priority
      || (left.neededBy ? new Date(left.neededBy).getTime() : Number.MAX_SAFE_INTEGER)
        - (right.neededBy ? new Date(right.neededBy).getTime() : Number.MAX_SAFE_INTEGER),
    );
}

export async function markRequestPreparing(idToken: string, requestId: string) {
  const actor = await requireOrganizationActor(idToken, "bloodBank");
  const requestRef = actor.db.collection("bloodRequests").doc(requestId);
  await actor.db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Blood request not found.");
    const request = { ...snapshot.data(), id: requestId } as BloodRequest;
    ensureOpenRequest(request);
    if (!request.assignedBloodBankIds?.includes(actor.organizationId)) {
      throw new Error("This blood bank is not assigned to fulfill this request.");
    }
    const allocations = readAllocations(request);
    const ownAllocations = allocations.filter((item) => item.bloodBankId === actor.organizationId);
    if (ownAllocations.length === 0) {
      throw new Error("This request has no reservation assigned to this blood bank.");
    }
    if (ownAllocations.every((item) => item.status !== "reserved")) return;
    const nextAllocations = allocations.map((item) =>
      item.bloodBankId === actor.organizationId && item.status === "reserved"
        ? { ...item, status: "preparing" as const }
        : item,
    );
    const nextStatus = request.status === "approved" ? "preparing" : request.status;
    transaction.update(requestRef, {
      fulfillmentAllocations: nextAllocations,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(actor.db.collection("bloodRequestEvents").doc(), requestEvent(
      actor.uid,
      requestId,
      "preparing",
      { bloodBankId: actor.organizationId },
    ));
    transaction.create(actor.db.collection("auditLogs").doc(), auditRecord(
      actor.uid,
      requestId,
      actor.organizationId,
      "request.preparing",
      { bloodBankId: actor.organizationId },
    ));
  });
}

export async function dispatchReservedUnits(
  idToken: string,
  requestId: string,
  units: number,
) {
  if (!Number.isInteger(units) || units <= 0) {
    throw new Error("Dispatch quantity must be a positive whole number.");
  }
  const actor = await requireOrganizationActor(idToken, "bloodBank");
  const requestRef = actor.db.collection("bloodRequests").doc(requestId);
  await actor.db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new Error("Blood request not found.");
    const request = { ...requestSnapshot.data(), id: requestId } as BloodRequest;
    ensureOpenRequest(request);
    if (!request.assignedBloodBankIds?.includes(actor.organizationId)) {
      throw new Error("This blood bank is not assigned to fulfill this request.");
    }
    const allocations = readAllocations(request);
    const ownAllocations = allocations.filter(
      (item) => item.bloodBankId === actor.organizationId && item.status !== "reserved",
    );
    const remainingReservedTotal = ownAllocations.reduce(
      (total, item) => total + item.unitsReserved - item.unitsDispatched,
      0,
    );
    if (ownAllocations.length === 0) {
      throw new Error("Accept and prepare this request before dispatching units.");
    }
    if (units > remainingReservedTotal) {
      throw new Error(`Dispatch quantity cannot exceed the ${remainingReservedTotal} reserved units remaining.`);
    }
    if (Number(request.unitsDispatched || 0) + units > request.unitsRequested) {
      throw new Error("Dispatch quantity cannot exceed the units requested.");
    }
    let unitsToAllocate = units;
    const nextAllocations = allocations.map((allocation) => {
      if (allocation.bloodBankId !== actor.organizationId || allocation.status === "reserved" || unitsToAllocate === 0) {
        return allocation;
      }
      const dispatchedHere = Math.min(
        unitsToAllocate,
        allocation.unitsReserved - allocation.unitsDispatched,
      );
      unitsToAllocate -= dispatchedHere;
      return {
        ...allocation,
        unitsDispatched: allocation.unitsDispatched + dispatchedHere,
        status: "dispatched" as const,
      };
    });
    const dispatches = nextAllocations
      .map((allocation, index) => ({
        allocation,
        previous: allocations[index],
      }))
      .filter(({ allocation, previous }) =>
        allocation.bloodBankId === actor.organizationId
        && allocation.unitsDispatched > previous.unitsDispatched,
      )
      .map(({ allocation, previous }) => ({
        allocation,
        units: allocation.unitsDispatched - previous.unitsDispatched,
        ref: actor.db.collection("bloodInventory").doc(allocation.inventoryId),
      }));
    const inventorySnapshots = await Promise.all(
      dispatches.map((dispatch) => transaction.get(dispatch.ref)),
    );
    const inventoryToUpdate = dispatches.map((dispatch, index) => {
      const inventorySnapshot = inventorySnapshots[index];
      if (!inventorySnapshot.exists) throw new Error("Reserved inventory record not found.");
      const inventory = inventorySnapshot.data()!;
      const reservedUnits = Number(inventory.unitsReserved || 0);
      if (inventory.bloodBankId !== actor.organizationId || reservedUnits < dispatch.units) {
        throw new Error("The reserved inventory no longer matches this dispatch.");
      }
      if (!isOperationallyEligibleInventory(inventory)) {
        throw new Error("This reserved inventory is no longer eligible for dispatch.");
      }
      return { ...dispatch, reservedUnits };
    });
    if (unitsToAllocate !== 0) {
      throw new Error("Dispatch quantity could not be matched to its reserved allocation.");
    }
    const nextDispatched = Number(request.unitsDispatched || 0) + units;
    const nextStatus = ["approved", "preparing"].includes(request.status)
      ? "dispatched"
      : request.status;
    for (const dispatch of inventoryToUpdate) {
      transaction.update(dispatch.ref, {
        unitsReserved: dispatch.reservedUnits - dispatch.units,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.update(requestRef, {
      fulfillmentAllocations: nextAllocations,
      unitsDispatched: nextDispatched,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(actor.db.collection("bloodRequestEvents").doc(), requestEvent(
      actor.uid,
      requestId,
      "dispatched",
      { bloodBankId: actor.organizationId, units, totalDispatched: nextDispatched },
    ));
    transaction.create(actor.db.collection("auditLogs").doc(), auditRecord(
      actor.uid,
      requestId,
      actor.organizationId,
      "request.dispatched",
      { bloodBankId: actor.organizationId, units, totalDispatched: nextDispatched },
    ));
    transaction.create(actor.db.collection("notifications").doc(), notification(
      request.createdBy,
      requestId,
      "Blood request dispatched",
      `${units} unit${units === 1 ? "" : "s"} dispatched. ${nextDispatched} of ${request.unitsRequested} requested units are now in transit.`,
    ));
  });
}

export async function confirmRequestReceipt(
  idToken: string,
  requestId: string,
  units: number,
) {
  if (!Number.isInteger(units) || units <= 0) {
    throw new Error("Receipt quantity must be a positive whole number.");
  }
  const actor = await requireOrganizationActor(idToken, "hospital");
  const requestRef = actor.db.collection("bloodRequests").doc(requestId);
  await actor.db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Blood request not found.");
    const request = { ...snapshot.data(), id: requestId } as BloodRequest;
    if (request.hospitalId !== actor.organizationId) {
      throw new Error("Hospital authorization is required for this request.");
    }
    ensureOpenRequest(request);
    const dispatched = Number(request.unitsDispatched || 0);
    const received = Number(request.unitsFulfilled || 0);
    const outstanding = dispatched - received;
    const remainingRequested = request.unitsRequested - received;
    if (units > outstanding || units > remainingRequested) {
      throw new Error(`Receipt quantity cannot exceed the ${Math.max(0, Math.min(outstanding, remainingRequested))} units currently dispatched and still requested.`);
    }
    const allocations = readAllocations(request);
    let remainingToReceive = units;
    const nextAllocations = allocations.map((allocation) => {
      if (remainingToReceive <= 0) return allocation;
      const outstandingFromAllocation = allocation.unitsDispatched - allocation.unitsReceived;
      const receivedHere = Math.min(remainingToReceive, outstandingFromAllocation);
      remainingToReceive -= receivedHere;
      return { ...allocation, unitsReceived: allocation.unitsReceived + receivedHere };
    });
    if (remainingToReceive > 0) {
      throw new Error("Dispatched allocation records do not match the request total.");
    }
    const nextReceived = received + units;
    const fulfilled = nextReceived >= request.unitsRequested;
    const nextStatus = fulfilled ? "fulfilled" : "partially_fulfilled";
    transaction.update(requestRef, {
      fulfillmentAllocations: nextAllocations,
      unitsFulfilled: nextReceived,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(actor.db.collection("bloodRequestEvents").doc(), requestEvent(
      actor.uid,
      requestId,
      "received",
      { hospitalId: actor.organizationId, units, totalReceived: nextReceived },
    ));
    transaction.create(actor.db.collection("auditLogs").doc(), auditRecord(
      actor.uid,
      requestId,
      actor.organizationId,
      fulfilled ? "request.fulfilled" : "request.partially_received",
      { units, totalReceived: nextReceived },
    ));
    transaction.create(actor.db.collection("notifications").doc(), notification(
      request.createdBy,
      requestId,
      fulfilled ? "Blood request fulfilled" : "Blood receipt confirmed",
      fulfilled
        ? `Receipt of all ${nextReceived} requested units has been confirmed.`
        : `Receipt of ${units} unit${units === 1 ? "" : "s"} confirmed. ${nextReceived} of ${request.unitsRequested} requested units received.`,
    ));
    if (fulfilled) {
      transaction.create(actor.db.collection("bloodRequestEvents").doc(), requestEvent(
        actor.uid,
        requestId,
        "fulfilled",
        { hospitalId: actor.organizationId, totalReceived: nextReceived },
      ));
    }
  });
}
