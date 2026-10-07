import { NextResponse } from "next/server";
import {
  approveRequestWithTrustedAdmin,
  rejectRequestWithTrustedAdmin,
} from "@/lib/serverApproval";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      requestId?: string;
      action?: "approve" | "reject";
      reason?: string;
    };
    if (!body.requestId || !body.action) {
      return NextResponse.json({ error: "Request ID and action are required." }, { status: 400 });
    }
    if (body.action === "approve") {
      await approveRequestWithTrustedAdmin(token, body.requestId);
    } else {
      await rejectRequestWithTrustedAdmin(token, body.requestId, body.reason ?? "");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request decision could not be completed.";
    const status = message.includes("Insufficient stock") ? 409 : message.includes("authorization") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
