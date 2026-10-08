import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { requireVerifiedOrganizationActor } from "@/lib/serverOrganizationOnboarding";
import type { BloodComponent, BloodGroup, RequestUrgency } from "@/types/domain";

const requestFields = [
  "patientId",
  "patientName",
  "caseId",
  "bloodGroup",
  "rhFactor",
  "componentType",
  "unitsRequested",
  "urgency",
  "neededBy",
  "notes",
] as const;

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];
const urgencies: RequestUrgency[] = ["routine", "urgent", "emergency"];

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const actor = await requireVerifiedOrganizationActor(token, "hospital");
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    if (Object.keys(payload).some((key) => !requestFields.includes(key as typeof requestFields[number]))) {
      return Response.json({ error: "The request contains unsupported fields." }, { status: 400 });
    }
    if (
      typeof payload.unitsRequested !== "number"
      || !Number.isSafeInteger(payload.unitsRequested)
      || payload.unitsRequested <= 0
    ) {
      return Response.json({ error: "Units requested must be a positive safe integer." }, { status: 400 });
    }
    if (!bloodGroups.includes(payload.bloodGroup as BloodGroup)) {
      return Response.json({ error: "A supported blood group is required." }, { status: 400 });
    }
    if (!components.includes(payload.componentType as BloodComponent)) {
      return Response.json({ error: "A supported blood component is required." }, { status: 400 });
    }
    if (!urgencies.includes(payload.urgency as RequestUrgency)) {
      return Response.json({ error: "A supported urgency is required." }, { status: 400 });
    }
    if (
      payload.rhFactor !== undefined
      && payload.rhFactor !== "positive"
      && payload.rhFactor !== "negative"
    ) {
      return Response.json({ error: "A supported Rh factor is required." }, { status: 400 });
    }
    if (
      typeof payload.neededBy !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.neededBy)
    ) {
      return Response.json({ error: "A valid needed-by date is required." }, { status: 400 });
    }
    const neededBy = new Date(payload.neededBy);
    if (
      !Number.isFinite(neededBy.getTime())
      || neededBy.toISOString() !== payload.neededBy
    ) {
      return Response.json({ error: "A valid needed-by date is required." }, { status: 400 });
    }
    if (
      payload.notes !== undefined && typeof payload.notes !== "string"
      || payload.patientId !== undefined && typeof payload.patientId !== "string"
      || payload.patientName !== undefined && typeof payload.patientName !== "string"
      || payload.caseId !== undefined && typeof payload.caseId !== "string"
    ) {
      return Response.json({ error: "Request details must be text." }, { status: 400 });
    }

    const emergency = payload.urgency === "emergency";
    const patientId = typeof payload.patientId === "string" ? payload.patientId.trim() : "";
    const patientName = typeof payload.patientName === "string" ? payload.patientName.trim() : "";
    const caseId = typeof payload.caseId === "string" ? payload.caseId.trim() : "";
    if (emergency && (!patientName || !caseId)) {
      return Response.json({ error: "Emergency requests require a patient name and case ID." }, { status: 400 });
    }
    if (!emergency && !patientId) {
      return Response.json({ error: "A hospital patient is required." }, { status: 400 });
    }

    const organizationSnapshot = await actor.db.collection("organizations").doc(actor.organizationId).get();
    const organizationName = organizationSnapshot.data()?.name;
    if (typeof organizationName !== "string" || !organizationName.trim()) {
      throw new Error("Verified hospital organization details are unavailable.");
    }

    const requestRef = actor.db.collection("bloodRequests").doc();
    const eventRef = actor.db.collection("bloodRequestEvents").doc();
    const auditRef = actor.db.collection("auditLogs").doc();
    await actor.db.runTransaction(async (transaction) => {
      if (patientId) {
        const patientSnapshot = await transaction.get(actor.db.collection("patients").doc(patientId));
        if (!patientSnapshot.exists || patientSnapshot.data()?.hospitalId !== actor.organizationId) {
          throw new Error("Patient is not part of this hospital.");
        }
      }
      const requestData = {
        hospitalId: actor.organizationId,
        createdBy: actor.uid,
        patientId: patientId || null,
        patientName: patientName || null,
        caseId: caseId || null,
        hospitalName: organizationName.trim(),
        bloodGroup: payload.bloodGroup,
        ...(payload.rhFactor === undefined ? {} : { rhFactor: payload.rhFactor }),
        componentType: payload.componentType,
        unitsRequested: payload.unitsRequested,
        urgency: payload.urgency,
        neededBy: Timestamp.fromDate(neededBy),
        ...(typeof payload.notes === "string" && payload.notes.trim()
          ? { notes: payload.notes.trim() }
          : {}),
        unitsFulfilled: 0,
        priority: payload.urgency === "emergency" ? 3 : payload.urgency === "urgent" ? 2 : 1,
        status: "submitted",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.create(requestRef, requestData);
      transaction.create(eventRef, {
        requestId: requestRef.id,
        actorUserId: actor.uid,
        eventType: "created",
        metadata: { urgency: payload.urgency, patientName: patientName || null, caseId: caseId || null },
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actorUserId: actor.uid,
        action: "request.created",
        entityType: "bloodRequest",
        entityId: requestRef.id,
        organizationId: actor.organizationId,
        metadata: { urgency: payload.urgency, unitsRequested: payload.unitsRequested },
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return Response.json({ id: requestRef.id }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
