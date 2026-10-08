import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import {
  createDonorOpportunity,
  listStaffDonorOpportunities,
} from "@/lib/serverDonorOpportunities";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const bloodGroup = new URL(request.url).searchParams.get("bloodGroup") || "";
    const result = await listStaffDonorOpportunities(token, bloodGroup);
    return Response.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    const result = await createDonorOpportunity(token, body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
