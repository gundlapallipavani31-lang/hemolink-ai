import { getAdminServices } from "@/lib/firebaseAdmin";
import type { AIRecord } from "./types";

export async function loadAIRecords(): Promise<AIRecord> {
  const { db } = getAdminServices();
  const [requests, inventory, donors, users] = await Promise.all([
    db.collection("bloodRequests").get(),
    db.collection("bloodInventory").get(),
    db.collection("donorProfiles").get(),
    db.collection("users").get(),
  ]);
  const donorUsers = new Map(users.docs.map((item) => [item.id, item.data()]));
  return {
    requests: requests.docs.map((item) => ({ id: item.id, ...item.data() })) as AIRecord["requests"],
    inventory: inventory.docs.map((item) => ({ id: item.id, ...item.data() })) as AIRecord["inventory"],
    donors: donors.docs.map((item) => ({ userId: item.id, ...item.data() })) as AIRecord["donors"],
    donorUsers: donors.docs.map((item) => ({
      uid: item.id,
      city: donorUsers.get(item.id)?.city,
      organizationId: donorUsers.get(item.id)?.organizationId,
      disabled: donorUsers.get(item.id)?.status === "disabled",
    })),
  };
}
