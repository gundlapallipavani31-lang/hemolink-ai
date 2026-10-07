import type { ForecastResult } from "./types";
import type { ShortageRisk } from "./shortageRisk";
import type { ExpiryRisk } from "./expiryRisk";

export type AIRecommendation = { title: string; explanation: string; severity: "info" | "attention" | "urgent" };

export function buildRecommendations(forecasts: ForecastResult[], shortages: ShortageRisk[], expiry: ExpiryRisk): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  shortages.filter((item) => ["critical", "high"].includes(item.level)).forEach((item) => recommendations.push({ title: `Review ${item.bloodGroup} ${item.componentType} shortage risk`, explanation: item.action, severity: item.level === "critical" ? "urgent" : "attention" }));
  forecasts.filter((item) => item.explanation.includes("trending upward")).forEach((item) => recommendations.push({ title: `Monitor rising ${item.bloodGroup} demand`, explanation: item.explanation, severity: "attention" }));
  if (expiry.unitsAtRisk > 0) recommendations.push({ title: "Review inventory nearing expiry", explanation: expiry.explanation, severity: "attention" });
  return recommendations;
}
