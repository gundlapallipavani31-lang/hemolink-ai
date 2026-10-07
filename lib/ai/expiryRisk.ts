import type { BloodInventory } from "@/types/domain";

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
    const expiry = item.expiryDate?.toDate();
    if (!expiry) return;
    const days = (expiry.getTime() - now.getTime()) / 86_400_000;
    if (days < 0) expired.push(item);
    else if (days <= 7) expiringWithin7Days.push(item);
    else if (days <= 30) expiringWithin30Days.push(item);
  });
  const unitsAtRisk = [...expiringWithin7Days, ...expiringWithin30Days].reduce((sum, item) => sum + item.unitsAvailable, 0);
  return { expiringWithin7Days, expiringWithin30Days, expired, unitsAtRisk, explanation: unitsAtRisk ? "High expiry exposure" : "No inventory is currently within the 30-day expiry window." };
}
