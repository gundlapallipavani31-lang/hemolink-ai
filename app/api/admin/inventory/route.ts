import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";
import { inventoryDate } from "@/lib/inventoryAvailability";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db } = await requireTrustedAdmin(token);
    const inventory = await db.collection("bloodInventory").get();
    return Response.json({
      inventory: inventory.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        collectionDate: inventoryDate(item.data().collectionDate)?.toISOString() ?? null,
        expiryDate: inventoryDate(item.data().expiryDate)?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
