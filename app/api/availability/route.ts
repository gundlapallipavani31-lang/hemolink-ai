import { getAdminServices } from "@/lib/firebaseAdmin";
import {
  inventoryExpiryState,
  operationalAvailableUnits,
} from "@/lib/inventoryAvailability";
import { isOneOf } from "@/lib/validation";
import type { BloodComponent, BloodGroup } from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const bloodGroup = params.get("bloodGroup");
  const component = params.get("component");
  const location = params.get("location")?.trim().toLowerCase() || "";

  if (!isOneOf(bloodGroup, bloodGroups) || !isOneOf(component, components)) {
    return Response.json(
      { error: "A valid blood group and component are required." },
      { status: 400 },
    );
  }

  try {
    const { db } = getAdminServices();
    const [inventorySnapshot, organizationSnapshot] = await Promise.all([
      db.collection("bloodInventory")
        .where("bloodGroup", "==", bloodGroup)
        .where("componentType", "==", component)
        .get(),
      db.collection("organizations").where("type", "==", "bloodBank").get(),
    ]);
    const organizations = new Map(
      organizationSnapshot.docs.map((item) => [item.id, item.data()]),
    );
    const results = inventorySnapshot.docs
      .map((item) => {
        const stock = item.data();
        const organization = organizations.get(stock.bloodBankId);
        const city = typeof organization?.city === "string" ? organization.city : "";
        const name = typeof organization?.name === "string" ? organization.name : "Blood bank";
        const expiryIndicator = inventoryExpiryState(stock.expiryDate);
        return {
          organizationName: name,
          city,
          bloodGroup,
          component,
          availableUnits: operationalAvailableUnits(stock),
          expiryIndicator: expiryIndicator === "unknown"
            ? "not_recorded"
            : expiryIndicator === "expired"
              ? "expired"
              : expiryIndicator === "within7Days"
                ? "within_7_days"
                : "recorded",
        };
      })
      .filter((item) => item.availableUnits > 0)
      .filter((item) => !location || item.city.toLowerCase().includes(location));

    return Response.json({ results }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Blood availability could not be loaded right now." },
      { status: 503 },
    );
  }
}
