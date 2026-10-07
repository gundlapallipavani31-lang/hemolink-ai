import { loadAIRecords } from "@/lib/ai/aggregation";
import { analyzeRecords } from "@/lib/ai/analysis";
import { getAIProviderStatus } from "@/lib/ai/provider";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db, decoded } = await requireTrustedAdmin(token);
    const result = analyzeRecords(await loadAIRecords());
    await db.collection("auditLogs").add({
      actorUserId: decoded.uid,
      action: "ai.analysis.viewed",
      entityType: "aiAnalysis",
      entityId: "overview",
      metadata: { requestCount: result.coverage.requestCount, inventoryCount: result.coverage.inventoryCount, donorCount: result.coverage.donorCount },
      createdAt: new Date(),
    });
    return Response.json({ ...result, provider: getAIProviderStatus(), generatedAt: new Date().toISOString() });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
