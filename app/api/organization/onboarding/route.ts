import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import {
  getOnboardingStatus,
  submitOrganizationRequest,
} from "@/lib/serverOrganizationOnboarding";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json(await getOnboardingStatus(token));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    return Response.json(await submitOrganizationRequest(token, body), { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
