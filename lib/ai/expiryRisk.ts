import type { BloodInventory } from "@/types/domain";
import {
  inventoryExpiryDays,
  operationalAvailableUnits,
} from "@/lib/inventoryAvailability";

export type ExpiryRisk = {
  expiringWithin7Days: BloodInventory[];
  expiringWithin30Days: BloodInventory[];
  expired: BloodInventory[];
  unitsAtRisk: number;
  explanation: string;
};

export function analyzeExpiryRisk(inventory: BloodInventory[], now = new Date()): ExpiryRisk {
  const expiringWithin7Days: BloodInventory[] = [];
  const expiringWithin30Days: BloodInventory[] = [];
  const expired: BloodInventory[] = [];
  inventory.forEach((item) => {
    const days = inventoryExpiryDays(item.expiryDate, now);
    if (days === null) return;
    if (days < 0) expired.push(item);
    else if (operationalAvailableUnits(item, now) > 0 && days <= 7) {
      expiringWithin7Days.push(item);
    } else if (operationalAvailableUnits(item, now) > 0 && days <= 30) {
      expiringWithin30Days.push(item);
    }
  });
  const unitsAtRisk = [...expiringWithin7Days, ...expiringWithin30Days]
    .reduce((sum, item) => sum + operationalAvailableUnits(item, now), 0);
  return {
    expiringWithin7Days,
    expiringWithin30Days,
    expired,
    unitsAtRisk,
    explanation: unitsAtRisk
      ? `${unitsAtRisk} currently usable, unreserved units expire within 30 days.`
      : "No currently usable, unreserved inventory is within the 30-day expiry window.",
  };
}
