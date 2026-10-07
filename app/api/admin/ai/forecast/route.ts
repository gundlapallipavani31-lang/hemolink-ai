import { loadAIRecords } from "@/lib/ai/aggregation";
import { forecastDemand } from "@/lib/ai/demandForecast";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    await requireTrustedAdmin(token);
    const params = new URL(request.url).searchParams;
    const bloodGroup = params.get("bloodGroup") as Parameters<typeof forecastDemand>[1] | null;
    const component = params.get("component") as Parameters<typeof forecastDemand>[2] | null;
    if (!bloodGroup || !component) return Response.json({ error: "bloodGroup and component are required." }, { status: 400 });
    return Response.json({ forecast: forecastDemand((await loadAIRecords()).requests, bloodGroup, component) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
