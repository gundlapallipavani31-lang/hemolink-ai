import type { BloodInventory, BloodRequest } from "@/types/domain";

export function isCompatibleInventoryForRequest(
  inventory: BloodInventory,
  request: Pick<BloodRequest, "bloodGroup" | "rhFactor" | "componentType">,
) {
  return (
    inventory.status === "available" &&
    inventory.bloodGroup === request.bloodGroup &&
    inventory.componentType === request.componentType &&
    (!request.rhFactor || inventory.rhFactor === request.rhFactor)
  );
}
