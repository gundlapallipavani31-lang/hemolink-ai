import { loadAIRecords } from "@/lib/ai/aggregation";
import { donorMatches } from "@/lib/ai/analysis";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    await requireTrustedAdmin(token);
    const bloodGroup = new URL(request.url).searchParams.get("bloodGroup") as Parameters<typeof donorMatches>[1] | null;
    if (!bloodGroup) return Response.json({ error: "bloodGroup is required." }, { status: 400 });
    return Response.json({ matches: donorMatches(await loadAIRecords(), bloodGroup) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
