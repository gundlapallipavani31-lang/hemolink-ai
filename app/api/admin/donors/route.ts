import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db } = await requireTrustedAdmin(token);
    const [donorSnapshot, usersSnapshot, donationSnapshot] = await Promise.all([
      db.collection("donorProfiles").get(),
      db.collection("users").get(),
      db.collection("donations").get(),
    ]);
    const users = new Map(usersSnapshot.docs.map((item) => [item.id, item.data()]));
    const donationCounts = new Map<string, number>();
    donationSnapshot.docs.forEach((item) => {
      const donorId = item.data().donorId;
      if (typeof donorId === "string") donationCounts.set(donorId, (donationCounts.get(donorId) || 0) + 1);
    });
    const donors = donorSnapshot.docs.map((item) => {
      const profile = item.data();
      const user = users.get(item.id);
      return {
        userId: item.id,
        name: typeof user?.name === "string" ? user.name : "Unnamed donor",
        email: typeof user?.email === "string" ? user.email : "",
        accountStatus: user?.status === "disabled" ? "disabled" : "active",
        bloodGroup: typeof profile.bloodGroup === "string" ? profile.bloodGroup : null,
        availabilityStatus: typeof profile.availabilityStatus === "string" ? profile.availabilityStatus : "unknown",
        eligibilityStatus: typeof profile.eligibilityStatus === "string" ? profile.eligibilityStatus : "unknown",
        city: typeof profile.city === "string" ? profile.city : "",
        donationHistoryAvailable: (donationCounts.get(item.id) || 0) > 0,
        donationCount: donationCounts.get(item.id) || 0,
      };
    });
    return Response.json({ donors });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
