import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  BloodComponent,
  BloodGroup,
  BloodInventory,
  InventoryStatus,
  RhFactor,
} from "@/types/domain";

export type InventoryInput = {
  componentType: BloodComponent;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  unitsAvailable: number;
  unitsReserved: number;
  collectionDate: Date;
  expiryDate: Date;
  storageLocation: string;
  status: InventoryStatus;
};

function toInventory(id: string, data: Record<string, unknown>): BloodInventory {
  return {
    id,
    bloodBankId: data.bloodBankId as string,
    componentType: data.componentType as BloodComponent,
    bloodGroup: data.bloodGroup as BloodGroup,
    rhFactor: data.rhFactor as RhFactor,
    unitsAvailable: typeof data.unitsAvailable === "number" ? data.unitsAvailable : 0,
    unitsReserved: typeof data.unitsReserved === "number" ? data.unitsReserved : 0,
    collectionDate: data.collectionDate as BloodInventory["collectionDate"],
    expiryDate: data.expiryDate as BloodInventory["expiryDate"],
    storageLocation: typeof data.storageLocation === "string" ? data.storageLocation : "",
    status: data.status as InventoryStatus,
    createdAt: data.createdAt as BloodInventory["createdAt"],
    updatedAt: data.updatedAt as BloodInventory["updatedAt"],
  };
}

export async function listBloodInventory(bloodBankId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "bloodInventory"),
      where("bloodBankId", "==", bloodBankId),
      orderBy("expiryDate", "asc"),
    ),
  );
  return snapshot.docs.map((item) => toInventory(item.id, item.data()));
}

export async function getBloodInventory(inventoryId: string, bloodBankId: string) {
  const snapshot = await getDoc(doc(db, "bloodInventory", inventoryId));
  if (!snapshot.exists() || snapshot.data().bloodBankId !== bloodBankId) return null;
  return toInventory(snapshot.id, snapshot.data());
}

export async function createBloodInventory(
  bloodBankId: string,
  input: InventoryInput,
) {
  return addDoc(collection(db, "bloodInventory"), {
    ...input,
    bloodBankId,
    collectionDate: Timestamp.fromDate(input.collectionDate),
    expiryDate: Timestamp.fromDate(input.expiryDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateBloodInventory(
  inventoryId: string,
  bloodBankId: string,
  input: Partial<InventoryInput>,
) {
  const existing = await getBloodInventory(inventoryId, bloodBankId);
  if (!existing) throw new Error("Inventory item not found.");

  const update = {
    ...input,
    ...(input.collectionDate
      ? { collectionDate: Timestamp.fromDate(input.collectionDate) }
      : {}),
    ...(input.expiryDate
      ? { expiryDate: Timestamp.fromDate(input.expiryDate) }
      : {}),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "bloodInventory", inventoryId), update);
}

export function getExpiryState(expiryDate: BloodInventory["expiryDate"]) {
  if (!expiryDate) return "unknown" as const;
  const days = (expiryDate.toDate().getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "expired" as const;
  if (days <= 7) return "within7Days" as const;
  if (days <= 30) return "within30Days" as const;
  return "normal" as const;
}
