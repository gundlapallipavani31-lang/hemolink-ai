import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { confirmRequestReceipt } from "@/lib/serverFulfillment";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const payload = body as { requestId?: unknown; units?: unknown };
    if (typeof payload.requestId !== "string" || !payload.requestId.trim()) {
      return Response.json({ error: "Request ID is required." }, { status: 400 });
    }
    if (typeof payload.units !== "number" || !Number.isSafeInteger(payload.units) || payload.units <= 0) {
      return Response.json({ error: "Receipt quantity must be a positive safe integer." }, { status: 400 });
    }
    await confirmRequestReceipt(token, payload.requestId, payload.units);
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
