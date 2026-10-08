import type { BloodInventory, BloodRequest } from "@/types/domain";
import { isOperationallyEligibleInventory } from "@/lib/inventoryAvailability";

export function isCompatibleInventoryForRequest(
  inventory: BloodInventory,
  request: Pick<BloodRequest, "bloodGroup" | "rhFactor" | "componentType">,
) {
  return (
    isOperationallyEligibleInventory(inventory) &&
    inventory.bloodGroup === request.bloodGroup &&
    inventory.componentType === request.componentType &&
    (!request.rhFactor || inventory.rhFactor === request.rhFactor)
  );
}
