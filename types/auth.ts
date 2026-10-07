import type { Timestamp } from "firebase/firestore";

export type AppRole =
  | "donor"
  | "hospital"
  | "bloodBank"
  | "administrator"
  | "pending";

export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  requestedRole: string;
  organizationId?: string;
  status?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const roleAliases: Record<string, AppRole> = {
  donor: "donor",
  hospital: "hospital",
  bloodbank: "bloodBank",
  "blood bank": "bloodBank",
  administrator: "administrator",
  pending: "pending",
};

export function normalizeRole(value: unknown): AppRole {
  if (typeof value !== "string") {
    return "pending";
  }

  return roleAliases[value.trim().toLowerCase()] ?? "pending";
}

export function formatRole(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    donor: "Donor",
    hospital: "Hospital",
    bloodBank: "Blood bank",
    administrator: "Administrator",
    pending: "Profile under review",
  };

  return labels[role];
}
