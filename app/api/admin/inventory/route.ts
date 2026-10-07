import { adminErrorResponse, bearerToken, requireTrustedAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
    const { db } = await requireTrustedAdmin(token);
    const inventory = await db.collection("bloodInventory").orderBy("expiryDate", "asc").get();
    return Response.json({
      inventory: inventory.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        collectionDate: item.data().collectionDate?.toDate?.()?.toISOString() ?? null,
        expiryDate: item.data().expiryDate?.toDate?.()?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
