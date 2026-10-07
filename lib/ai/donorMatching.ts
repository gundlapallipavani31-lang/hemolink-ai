import type { BloodGroup, DonorProfile } from "@/types/domain";

export type DonorMatch = {
  userId: string;
  bloodGroup?: BloodGroup;
  city?: string;
  availability: string;
  compatibility: "compatible" | "not compatible" | "unknown";
  explanation: string;
  confidence: "complete" | "partial" | "insufficient";
};

export function matchDonors(
  donors: Array<DonorProfile & { userId: string; city?: string; disabled?: boolean }>,
  requestedBloodGroup: BloodGroup,
): DonorMatch[] {
  return donors
    .filter((donor) => !donor.disabled)
    .map((donor) => {
      const compatible = donor.bloodGroup === requestedBloodGroup;
      const complete = Boolean(donor.bloodGroup && donor.availabilityStatus);
      return {
        userId: donor.userId,
        bloodGroup: donor.bloodGroup,
        city: donor.city,
        availability: donor.availabilityStatus,
        compatibility: (donor.bloodGroup ? (compatible ? "compatible" : "not compatible") : "unknown") as DonorMatch["compatibility"],
        explanation: compatible ? "Exact blood-group match and donor profile is available." : donor.bloodGroup ? "Blood group does not exactly match this operational request." : "Blood group is not recorded.",
        confidence: (complete ? "complete" : donor.bloodGroup ? "partial" : "insufficient") as DonorMatch["confidence"],
      };
    })
    .filter((match) => match.compatibility === "compatible" && match.availability === "available")
    .sort((left, right) => (right.confidence === "complete" ? 1 : 0) - (left.confidence === "complete" ? 1 : 0));
}
