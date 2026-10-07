import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { auth, db } = await requireTrustedAdmin(token);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").toLowerCase();
    const role = url.searchParams.get("role") || "";
    const [authUsers, profiles] = await Promise.all([
      auth.listUsers(1000),
      db.collection("users").get(),
    ]);
    const profileMap = new Map(profiles.docs.map((item) => [item.id, item.data()]));
    const users = authUsers.users
      .map((user) => {
        const profile = profileMap.get(user.uid) || {};
        return {
          uid: user.uid,
          email: user.email || "",
          name: profile.name || "",
          role: profile.role || "pending",
          requestedRole: profile.requestedRole || null,
          organizationId: profile.organizationId || null,
          status: profile.status || "active",
          disabled: user.disabled,
          createdAt: user.metadata.creationTime || null,
          lastSignInAt: user.metadata.lastSignInTime || null,
        };
      })
      .filter((user) => (!role || user.role === role) && (!search || `${user.email} ${user.name} ${user.uid}`.toLowerCase().includes(search)));
    return Response.json({ users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
