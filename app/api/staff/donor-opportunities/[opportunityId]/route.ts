import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { updateStaffDonorOpportunity } from "@/lib/serverDonorOpportunities";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    const { opportunityId } = await params;
    const result = await updateStaffDonorOpportunity(token, opportunityId, body);
    return Response.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
