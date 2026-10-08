import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import {
  dispatchReservedUnits,
  listBloodBankFulfillmentRequests,
  markRequestPreparing,
} from "@/lib/serverFulfillment";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const requests = await listBloodBankFulfillmentRequests(token);
    return Response.json({ requests });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json() as {
      requestId?: string;
      action?: "prepare" | "dispatch";
      units?: number;
    };
    if (!body.requestId || !body.action) {
      return Response.json({ error: "Request ID and action are required." }, { status: 400 });
    }
    if (body.action === "prepare") {
      await markRequestPreparing(token, body.requestId);
    } else if (body.action === "dispatch") {
      await dispatchReservedUnits(token, body.requestId, Number(body.units));
    } else {
      return Response.json({ error: "Unsupported blood-bank request action." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
