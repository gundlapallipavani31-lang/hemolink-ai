import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { respondToInformationRequest } from "@/lib/serverRequestTriage";

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
    if (typeof payload.message !== "string") {
      return Response.json({ error: "Response message is required." }, { status: 400 });
    }
    await respondToInformationRequest(token, payload.requestId.trim(), payload.message);
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
