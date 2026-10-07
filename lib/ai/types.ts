import type { BloodComponent, BloodGroup, BloodInventory, BloodRequest, DonorProfile } from "@/types/domain";

export type AIRecord = {
  requests: Array<BloodRequest & { createdAt?: { toDate(): Date }; neededBy?: { toDate(): Date } }>;
  inventory: Array<BloodInventory & { expiryDate?: { toDate(): Date }; collectionDate?: { toDate(): Date } }>;
  donors: Array<DonorProfile & { userId: string }>;
  donorUsers: Array<{ uid: string; city?: string; organizationId?: string; disabled?: boolean }>;
};

export type ForecastResult = {
  bloodGroup: BloodGroup;
  componentType: BloodComponent;
  horizonDays: number;
  historicalDailyDemand: number[];
  estimatedDemand: number | null;
  confidence: "insufficient" | "low" | "moderate" | "high";
  dataPoints: number;
  explanation: string;
};
