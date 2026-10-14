import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import { listPublicEmergencyIntakes, PublicIntakeError } from "@/lib/serverPublicEmergencyIntakes";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    await requireTrustedAdmin(token);
    const cursor = new URL(request.url).searchParams.get("after") || undefined;
    return Response.json(
      await listPublicEmergencyIntakes(cursor),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PublicIntakeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return adminErrorResponse(error);
  }
}
