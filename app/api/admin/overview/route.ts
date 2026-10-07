import { getAdminOverview } from "@/lib/adminOverview";
import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    await requireTrustedAdmin(token);
    return Response.json(await getAdminOverview());
  } catch (error) {
    return adminErrorResponse(error);
  }
}
