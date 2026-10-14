import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import {
  PublicIntakeError,
  updatePublicEmergencyIntakeStatus,
  type PublicEmergencyIntakeStatus,
} from "@/lib/serverPublicEmergencyIntakes";

const statuses = new Set<PublicEmergencyIntakeStatus>([
  "received",
  "under_review",
  "contacted",
  "closed",
  "unable_to_fulfill",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ intakeId: string }> },
) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 1024) {
    return Response.json({ error: "The status update is too large." }, { status: 413 });
  }

  try {
    const { decoded } = await requireTrustedAdmin(token);
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return Response.json({ error: "A valid status update is required." }, { status: 400 });
    }
    if (new TextEncoder().encode(bodyText).byteLength > 1024) {
      return Response.json({ error: "The status update is too large." }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return Response.json({ error: "A valid status update is required." }, { status: 400 });
    }
    if (
      typeof body !== "object"
      || body === null
      || Array.isArray(body)
      || Object.keys(body).length !== 1
      || !("status" in body)
      || typeof body.status !== "string"
      || !statuses.has(body.status as PublicEmergencyIntakeStatus)
    ) {
      return Response.json({ error: "A valid intake status is required." }, { status: 400 });
    }

    const { intakeId } = await params;
    const result = await updatePublicEmergencyIntakeStatus(
      intakeId,
      body.status as PublicEmergencyIntakeStatus,
      decoded.uid,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PublicIntakeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return adminErrorResponse(error);
  }
}
