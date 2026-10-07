import type { BloodComponent, BloodGroup, BloodInventory } from "@/types/domain";
import type { ForecastResult } from "./types";

export type ShortageRisk = {
  bloodGroup: BloodGroup;
  componentType: BloodComponent;
  level: "low" | "moderate" | "high" | "critical" | "insufficient";
  availableUnits: number;
  forecastUnits: number | null;
  explanation: string;
  action: string;
};

export type ShortageRiskThresholds = {
  criticalBelowCoverageRatio: number;
  highBelowCoverageRatio: number;
  moderateBelowCoverageRatio: number;
};

export const SHORTAGE_RISK_THRESHOLDS: ShortageRiskThresholds = {
  criticalBelowCoverageRatio: 0.25,
  highBelowCoverageRatio: 0.5,
  moderateBelowCoverageRatio: 1,
};

export function analyzeShortage(
  inventory: BloodInventory[],
  forecast: ForecastResult,
  thresholds: ShortageRiskThresholds = SHORTAGE_RISK_THRESHOLDS,
): ShortageRisk {
  const availableUnits = inventory
    .filter((item) => item.bloodGroup === forecast.bloodGroup && item.componentType === forecast.componentType && item.status === "available")
    .reduce((sum, item) => sum + item.unitsAvailable, 0);
  if (forecast.estimatedDemand === null) {
    return { bloodGroup: forecast.bloodGroup, componentType: forecast.componentType, level: "insufficient", availableUnits, forecastUnits: null, explanation: "Insufficient historical demand data for a shortage estimate.", action: "Collect more dated request history before acting on a shortage signal." };
  }
  const ratio = forecast.estimatedDemand === 0 ? 1 : availableUnits / forecast.estimatedDemand;
  const level = ratio < thresholds.criticalBelowCoverageRatio
    ? "critical"
    : ratio < thresholds.highBelowCoverageRatio
      ? "high"
      : ratio < thresholds.moderateBelowCoverageRatio
        ? "moderate"
        : "low";
  return { bloodGroup: forecast.bloodGroup, componentType: forecast.componentType, level, availableUnits, forecastUnits: forecast.estimatedDemand, explanation: `${availableUnits} available units are compared with an estimated ${forecast.estimatedDemand}-unit demand over ${forecast.horizonDays} days.`, action: level === "low" ? "Continue monitoring." : "Review inventory, donor outreach, and replenishment options." };
}
