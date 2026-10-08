import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { confirmRequestReceipt } from "@/lib/serverFulfillment";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json() as { requestId?: string; units?: number };
    if (!body.requestId) {
      return Response.json({ error: "Request ID is required." }, { status: 400 });
    }
    await confirmRequestReceipt(token, body.requestId, Number(body.units));
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
