import type { BloodComponent, BloodGroup, BloodRequest } from "@/types/domain";
import type { ForecastResult } from "./types";

function dateOf(value: unknown) {
  return value && typeof value === "object" && "toDate" in value
    ? (value as { toDate(): Date }).toDate()
    : null;
}

export function forecastDemand(
  requests: Array<Pick<BloodRequest, "bloodGroup" | "componentType" | "unitsRequested" | "createdAt">>,
  bloodGroup: BloodGroup,
  componentType: BloodComponent,
  horizonDays = 30,
): ForecastResult {
  const matching = requests.filter((request) => request.bloodGroup === bloodGroup && request.componentType === componentType);
  const buckets = Array.from({ length: 8 }, () => 0);
  const now = Date.now();
  matching.forEach((request) => {
    const date = dateOf(request.createdAt)?.getTime();
    if (!date) return;
    const age = Math.floor((now - date) / 86_400_000);
    if (age >= 0 && age < 56) buckets[7 - Math.floor(age / 7)] += request.unitsRequested;
  });
  const dataPoints = matching.length;
  if (dataPoints < 3 || buckets.every((value) => value === 0)) {
    return { bloodGroup, componentType, horizonDays, historicalDailyDemand: buckets, estimatedDemand: null, confidence: "insufficient", dataPoints, explanation: "Insufficient data. At least three dated requests are needed for a transparent baseline." };
  }
  const recent = buckets.slice(-4);
  const older = buckets.slice(0, 4);
  const recentDaily = recent.reduce((sum, value) => sum + value, 0) / 28;
  const olderDaily = older.reduce((sum, value) => sum + value, 0) / 28;
  const weightedDaily = recentDaily * 0.7 + olderDaily * 0.3;
  const trend = recentDaily > olderDaily * 1.1 ? "trending upward" : recentDaily < olderDaily * 0.9 ? "trending downward" : "stable";
  return {
    bloodGroup,
    componentType,
    horizonDays,
    historicalDailyDemand: buckets,
    estimatedDemand: Math.ceil(weightedDaily * horizonDays),
    confidence: dataPoints >= 12 ? "high" : dataPoints >= 6 ? "moderate" : "low",
    dataPoints,
    explanation: `${bloodGroup} ${componentType} demand is ${trend} based on the last eight weeks of recorded requests.`,
  };
}
