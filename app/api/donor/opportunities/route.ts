import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { listMyDonorOpportunities } from "@/lib/serverDonorOpportunities";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const opportunities = await listMyDonorOpportunities(token);
    return Response.json({ opportunities });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
