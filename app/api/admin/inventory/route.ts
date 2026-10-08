import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import { inventoryDate } from "@/lib/inventoryAvailability";
import { loadVerifiedActiveBloodBankIds } from "@/lib/serverInventoryOwnership";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db } = await requireTrustedAdmin(token);
    const [inventory, verifiedBloodBanks] = await Promise.all([
      db.collection("bloodInventory").get(),
      loadVerifiedActiveBloodBankIds(db),
    ]);
    return Response.json({
      inventory: inventory.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        ownerVerified: verifiedBloodBanks.has(String(item.data().bloodBankId)),
        collectionDate: inventoryDate(item.data().collectionDate)?.toISOString() ?? null,
        expiryDate: inventoryDate(item.data().expiryDate)?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
