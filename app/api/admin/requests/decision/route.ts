import {
  approveRequestWithTrustedAdmin,
  rejectRequestWithTrustedAdmin,
} from "@/lib/serverApproval";
import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { updateRequestTriage, type AdminTriageAction } from "@/lib/serverRequestTriage";

const adminActions = new Set([
  "approve",
  "reject",
  "acknowledge",
  "assign_to_me",
  "review_message",
  "request_information",
]);

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    if (typeof payload.requestId !== "string" || !payload.requestId.trim()) {
      return Response.json({ error: "Request ID is required." }, { status: 400 });
    }
    if (typeof payload.action !== "string" || !adminActions.has(payload.action)) {
      return Response.json({ error: "Unsupported request action." }, { status: 400 });
    }
    if (
      payload.message !== undefined
      && typeof payload.message !== "string"
    ) {
      return Response.json({ error: "Message must be text." }, { status: 400 });
    }
    if (payload.reason !== undefined && typeof payload.reason !== "string") {
      return Response.json({ error: "Rejection reason must be text." }, { status: 400 });
    }

    const requestId = payload.requestId.trim();
    const action = payload.action;
    if (action === "approve") {
      await approveRequestWithTrustedAdmin(token, requestId);
    } else if (action === "reject") {
      await rejectRequestWithTrustedAdmin(token, requestId, (payload.reason as string | undefined) ?? "");
    } else {
      await updateRequestTriage(token, requestId, action as AdminTriageAction, (payload.message as string | undefined) ?? "");
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request decision could not be completed.";
    const status = message.includes("Insufficient stock")
      || message.includes("assigned to another")
      || message.includes("no longer active")
      ? 409
      : undefined;
    return status
      ? Response.json({ error: message }, { status })
      : adminErrorResponse(error);
  }
}
