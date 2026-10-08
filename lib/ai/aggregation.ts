import { getAdminServices } from "@/lib/firebaseAdmin";
import type { AIRecord } from "./types";
import { loadVerifiedActiveBloodBankIds } from "@/lib/serverInventoryOwnership";

export async function loadAIRecords(): Promise<AIRecord> {
  const { db } = getAdminServices();
  const [requests, inventory, donors, users, verifiedBloodBanks] = await Promise.all([
    db.collection("bloodRequests").get(),
    db.collection("bloodInventory").get(),
    db.collection("donorProfiles").get(),
    db.collection("users").get(),
    loadVerifiedActiveBloodBankIds(db),
  ]);
  const donorUsers = new Map(users.docs.map((item) => [item.id, item.data()]));
  return {
    requests: requests.docs.map((item) => ({ id: item.id, ...item.data() })) as AIRecord["requests"],
    inventory: inventory.docs
      .filter((item) => verifiedBloodBanks.has(String(item.data().bloodBankId)))
      .map((item) => ({ id: item.id, ...item.data(), ownerVerified: true })) as AIRecord["inventory"],
    donors: donors.docs.map((item) => ({ userId: item.id, ...item.data() })) as AIRecord["donors"],
    donorUsers: donors.docs.map((item) => ({
      uid: item.id,
      city: donorUsers.get(item.id)?.city,
      organizationId: donorUsers.get(item.id)?.organizationId,
      disabled: donorUsers.get(item.id)?.status === "disabled",
    })),
  };
}
