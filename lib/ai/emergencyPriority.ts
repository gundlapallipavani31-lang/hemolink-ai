import type { BloodRequest } from "@/types/domain";

export function operationalPriority(request: BloodRequest, availableUnits: number | null) {
  if (request.urgency === "emergency" || (availableUnits !== null && availableUnits < request.unitsRequested)) {
    return { level: "critical" as const, explanation: request.urgency === "emergency" ? "Marked emergency by the requesting hospital." : "Available matching inventory is below the requested quantity." };
  }
  if (request.urgency === "urgent" || (request.neededBy && request.neededBy.toDate().getTime() - Date.now() < 48 * 3_600_000)) {
    return { level: "high" as const, explanation: "Urgency or needed-by timing indicates elevated operational attention." };
  }
  return { level: "standard" as const, explanation: "Routine operational priority based on the recorded request fields." };
}
