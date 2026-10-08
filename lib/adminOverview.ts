import { getAdminServices } from "@/lib/firebaseAdmin";
import {
  isInventoryExpiringWithin,
  operationalAvailableUnits,
} from "@/lib/inventoryAvailability";

export async function getAdminOverview() {
  const { db } = getAdminServices();
  const [usersSnapshot, organizationsSnapshot, inventorySnapshot, requestsSnapshot, auditSnapshot] =
    await Promise.all([
      db.collection("users").get(),
      db.collection("organizations").get(),
      db.collection("bloodInventory").get(),
      db.collection("bloodRequests").get(),
      db.collection("auditLogs").orderBy("createdAt", "desc").limit(10).get(),
    ]);

  const users = usersSnapshot.docs.map((item) => item.data());
  const organizations = organizationsSnapshot.docs.map((item) => item.data());
  const inventory = inventorySnapshot.docs.map((item) => item.data());
  const requests = requestsSnapshot.docs.map((item) => item.data());
  const now = new Date();

  return {
    metrics: {
      donors: users.filter((item) => item.role === "donor").length,
      hospitals: organizations.filter((item) => item.type === "hospital").length,
      bloodBanks: organizations.filter((item) => item.type === "bloodBank").length,
      availableUnits: inventory.reduce(
        (total, item) => total + operationalAvailableUnits(item, now),
        0,
      ),
      pendingRequests: requests.filter((item) => ["submitted", "under_review"].includes(item.status)).length,
      emergencyRequests: requests.filter((item) => item.urgency === "emergency" && !["fulfilled", "cancelled", "rejected"].includes(item.status)).length,
      approvedRequests: requests.filter((item) => item.status === "approved").length,
      rejectedRequests: requests.filter((item) => item.status === "rejected").length,
      expiringInventory: inventory.filter((item) =>
        isInventoryExpiringWithin(item, 30, now),
      ).length,
    },
    activity: auditSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      createdAt: item.data().createdAt?.toDate?.()?.toISOString() ?? null,
    })),
  };
}
