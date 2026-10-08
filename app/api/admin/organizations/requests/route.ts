import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import {
  decideOrganizationRequest,
  listOrganizationRequests,
} from "@/lib/serverOrganizationOnboarding";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const requests = await listOrganizationRequests(token);
    return Response.json({ requests });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (
      typeof input.requestId !== "string"
      || (input.action !== "approve" && input.action !== "reject")
      || Object.keys(input).some((key) => !["requestId", "action", "rejectionReason"].includes(key))
      || (input.rejectionReason !== undefined && typeof input.rejectionReason !== "string")
    ) {
      return Response.json({ error: "A valid organization decision is required." }, { status: 400 });
    }
    const result = await decideOrganizationRequest(
      token,
      input.requestId,
      input.action,
      typeof input.rejectionReason === "string" ? input.rejectionReason : "",
    );
    return Response.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
