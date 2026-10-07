import { analyzeRecords } from "@/lib/ai/analysis";
import { loadAIRecords } from "@/lib/ai/aggregation";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    await requireTrustedAdmin(token);
    return Response.json({ shortages: analyzeRecords(await loadAIRecords()).shortages });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
