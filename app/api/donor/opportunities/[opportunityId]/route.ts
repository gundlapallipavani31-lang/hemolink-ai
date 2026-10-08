import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { respondToDonorOpportunity } from "@/lib/serverDonorOpportunities";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    if (
      typeof body !== "object"
      || body === null
      || Array.isArray(body)
      || Object.keys(body).some((key) => key !== "action")
      || ((body as Record<string, unknown>).action !== "accept"
        && (body as Record<string, unknown>).action !== "decline")
    ) {
      return Response.json({ error: "A valid accept or decline action is required." }, { status: 400 });
    }
    const { opportunityId } = await params;
    const result = await respondToDonorOpportunity(
      token,
      opportunityId,
      (body as { action: "accept" | "decline" }).action,
    );
    return Response.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
