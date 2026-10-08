import type { BloodComponent, BloodGroup } from "@/types/domain";
import { operationalAvailableUnits } from "@/lib/inventoryAvailability";
import { analyzeExpiryRisk } from "./expiryRisk";
import { forecastDemand } from "./demandForecast";
import { analyzeShortage } from "./shortageRisk";
import { buildRecommendations } from "./recommendations";
import { operationalPriority } from "./emergencyPriority";
import { matchDonors } from "./donorMatching";
import type { AIRecord } from "./types";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];

export function analyzeRecords(records: AIRecord) {
  const combinations = new Set(records.requests.map((item) => `${item.bloodGroup}|${item.componentType}`));
  const forecasts = [...combinations].map((key) => {
    const [bloodGroup, componentType] = key.split("|") as [BloodGroup, BloodComponent];
    return forecastDemand(records.requests, bloodGroup, componentType);
  });
  const shortages = forecasts.map((forecast) => analyzeShortage(records.inventory, forecast));
  const expiry = analyzeExpiryRisk(records.inventory);
  const priorities = records.requests
    .filter((item) => !["fulfilled", "rejected", "cancelled"].includes(item.status))
    .map((item) => {
      const available = records.inventory
        .filter((stock) => stock.bloodGroup === item.bloodGroup && stock.componentType === item.componentType && (!item.rhFactor || stock.rhFactor === item.rhFactor))
        .reduce((sum, stock) => sum + operationalAvailableUnits(stock), 0);
      return { ...item, signal: operationalPriority(item, available) };
    })
    .sort((left, right) => {
      const order = { critical: 3, high: 2, standard: 1 };
      return order[right.signal.level] - order[left.signal.level];
    });
  return {
    forecasts,
    shortages,
    expiry: { ...expiry, expiringWithin7Days: expiry.expiringWithin7Days.map((item) => item.id), expiringWithin30Days: expiry.expiringWithin30Days.map((item) => item.id), expired: expiry.expired.map((item) => item.id) },
    priorities: priorities.map((item) => ({ requestId: item.id, bloodGroup: item.bloodGroup, componentType: item.componentType, urgency: item.urgency, unitsRequested: item.unitsRequested, signal: item.signal })),
    recommendations: buildRecommendations(forecasts, shortages, expiry),
    coverage: { requestCount: records.requests.length, inventoryCount: records.inventory.length, donorCount: records.donors.length, supportedGroups: groups.length, supportedComponents: components.length },
  };
}

export function donorMatches(records: AIRecord, bloodGroup: BloodGroup) {
  const userData = new Map(records.donorUsers.map((item) => [item.uid, item]));
  return matchDonors(records.donors.map((donor) => ({ ...donor, city: userData.get(donor.userId)?.city, disabled: userData.get(donor.userId)?.disabled })), bloodGroup);
}
