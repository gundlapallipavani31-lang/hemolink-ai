import type {
  BloodComponent,
  BloodGroup,
  InventoryStatus,
} from "@/types/domain";

export const INVENTORY_EXPIRY_POLICY =
  "Inventory remains eligible through its expiry date in UTC and expires at the start of the following UTC day.";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];
const statuses: InventoryStatus[] = [
  "available",
  "reserved",
  "dispatched",
  "expired",
  "quarantined",
  "discarded",
];

export type InventoryEligibilityInput = {
  bloodBankId?: unknown;
  bloodGroup?: unknown;
  rhFactor?: unknown;
  componentType?: unknown;
  status?: unknown;
  unitsAvailable?: unknown;
  unitsReserved?: unknown;
  collectionDate?: unknown;
  expiryDate?: unknown;
  storageLocation?: unknown;
  ownerVerified?: unknown;
};

export type InventoryExpiryState =
  | "expired"
  | "within7Days"
  | "within30Days"
  | "normal"
  | "unknown";

export function inventoryDate(value: unknown): Date | null {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
      return null;
    }
    date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value) {
      return null;
    }
  } else if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const converted = value.toDate();
      if (converted instanceof Date) date = converted;
    } else if ("toMillis" in value && typeof value.toMillis === "function") {
      date = new Date(value.toMillis());
    }
  }
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function inventoryExpiryDays(expiryDate: unknown, now = new Date()) {
  const expiry = inventoryDate(expiryDate);
  if (!expiry || !Number.isFinite(now.getTime())) return null;
  return (utcDay(expiry) - utcDay(now)) / 86_400_000;
}

export function isInventoryExpiryCurrent(expiryDate: unknown, now = new Date()) {
  const days = inventoryExpiryDays(expiryDate, now);
  return days !== null && days >= 0;
}

export function inventoryExpiryState(
  expiryDate: unknown,
  now = new Date(),
): InventoryExpiryState {
  const days = inventoryExpiryDays(expiryDate, now);
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days <= 7) return "within7Days";
  if (days <= 30) return "within30Days";
  return "normal";
}

export function isValidBloodGroupRh(bloodGroup: unknown, rhFactor: unknown) {
  if (typeof bloodGroup !== "string" || !bloodGroups.some((group) => group === bloodGroup)) {
    return false;
  }
  return (bloodGroup.endsWith("+") && rhFactor === "positive")
    || (bloodGroup.endsWith("-") && rhFactor === "negative");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isStructurallyValidInventory(
  inventory: InventoryEligibilityInput,
): boolean {
  const collectionDate = inventoryDate(inventory.collectionDate);
  const expiryDate = inventoryDate(inventory.expiryDate);
  return typeof inventory.bloodBankId === "string"
    && inventory.bloodBankId.trim().length > 0
    && isValidBloodGroupRh(inventory.bloodGroup, inventory.rhFactor)
    && typeof inventory.componentType === "string"
    && components.some((component) => component === inventory.componentType)
    && typeof inventory.status === "string"
    && statuses.some((status) => status === inventory.status)
    && (inventory.storageLocation === undefined || typeof inventory.storageLocation === "string")
    && isNonNegativeInteger(inventory.unitsAvailable)
    && isNonNegativeInteger(inventory.unitsReserved)
    && collectionDate !== null
    && expiryDate !== null
    && collectionDate.getTime() <= expiryDate.getTime();
}

export function isOperationallyEligibleInventory(
  inventory: InventoryEligibilityInput,
  now = new Date(),
): boolean {
  return inventory.ownerVerified === true
    && isStructurallyValidInventory(inventory)
    && inventory.status === "available"
    && isInventoryExpiryCurrent(inventory.expiryDate, now);
}

export function operationalAvailableUnits(
  inventory: InventoryEligibilityInput,
  now = new Date(),
) {
  return isOperationallyEligibleInventory(inventory, now)
    && typeof inventory.unitsAvailable === "number"
    ? inventory.unitsAvailable
    : 0;
}

export function recordedReservedUnits(inventory: InventoryEligibilityInput) {
  return isNonNegativeInteger(inventory.unitsReserved)
    ? inventory.unitsReserved
    : 0;
}

export function inventoryEligibilityMessage(
  inventory: InventoryEligibilityInput,
  now = new Date(),
) {
  const expiryState = inventoryExpiryState(inventory.expiryDate, now);
  if (inventory.ownerVerified !== true) return "Not usable: blood-bank ownership is not verified";
  if (expiryState === "unknown") return "Needs review: expiry missing or invalid";
  if (expiryState === "expired") return "Not usable: expired";
  if (!isStructurallyValidInventory(inventory)) return "Inventory data needs review";
  if (inventory.status !== "available") return `Not usable: ${String(inventory.status)} status`;
  if (inventory.unitsAvailable === 0) return "No unreserved units";
  return "Operationally eligible";
}

export function isInventoryExpiringWithin(
  inventory: InventoryEligibilityInput,
  days: number,
  now = new Date(),
) {
  const daysToExpiry = inventoryExpiryDays(inventory.expiryDate, now);
  return isOperationallyEligibleInventory(inventory, now)
    && isNonNegativeInteger(inventory.unitsAvailable)
    && inventory.unitsAvailable > 0
    && daysToExpiry !== null
    && daysToExpiry >= 0
    && daysToExpiry <= days;
}

export function validateInventoryWrite(
  inventory: InventoryEligibilityInput,
): string | null {
  if (!isStructurallyValidInventory(inventory)) {
    return "Inventory data must include a valid organization, blood group and Rh factor, component, status, whole-unit quantities, and valid collection and expiry dates.";
  }
  return null;
}
