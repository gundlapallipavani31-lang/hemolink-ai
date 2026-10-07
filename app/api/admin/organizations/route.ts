import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db } = await requireTrustedAdmin(token);
    const organizations = await db.collection("organizations").get();
    const members = await db.collection("organizationMembers").get();
    const memberCount = new Map<string, number>();
    members.docs.forEach((item) => {
      const organizationId = item.data().organizationId;
      memberCount.set(organizationId, (memberCount.get(organizationId) || 0) + 1);
    });
    return Response.json({
      organizations: organizations.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        memberCount: memberCount.get(item.id) || 0,
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
