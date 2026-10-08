import { adminErrorResponse, bearerToken } from "@/lib/adminAuth";
import { submitOrganizationRequest } from "@/lib/serverOrganizationOnboarding";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "A JSON object is required." }, { status: 400 });
    }
    return Response.json(
      await submitOrganizationRequest(token, { ...(body as Record<string, unknown>), type: "hospital" }),
      { status: 201 },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
