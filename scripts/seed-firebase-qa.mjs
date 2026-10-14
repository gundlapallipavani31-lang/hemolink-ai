import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  findOrCreateQaUser,
  getQaAdminServices,
  QA_CREDENTIALS,
  QA_ORGANIZATIONS,
} from "./firebase-qa-common.mjs";

const { auth, db } = await getQaAdminServices();

const accounts = {
  admin: {
    account: QA_CREDENTIALS.admin,
    name: "Synthetic QA Administrator",
    role: "administrator",
  },
  hospital: {
    account: QA_CREDENTIALS.hospital,
    name: "Synthetic QA Hospital User",
    role: "hospital",
    organizationId: QA_ORGANIZATIONS.hospital,
  },
  bloodBank: {
    account: QA_CREDENTIALS.bloodBank,
    name: "Synthetic QA Blood Bank User",
    role: "bloodBank",
    organizationId: QA_ORGANIZATIONS.bloodBank,
  },
};

for (const user of Object.values(accounts)) {
  user.authUser = await findOrCreateQaUser(auth, user.account, user.name);
  await auth.updateUser(user.authUser.uid, {
    emailVerified: true,
    disabled: false,
    password: user.account.password,
  });
}

const adminUser = accounts.admin.authUser;
await auth.setCustomUserClaims(adminUser.uid, { admin: true });
for (const user of [accounts.hospital, accounts.bloodBank]) {
  await auth.setCustomUserClaims(user.authUser.uid, {});
}

const now = new Date();
const batch = db.batch();
const usersCollection = db.collection("users");
const organizationsCollection = db.collection("organizations");
const membershipsCollection = db.collection("organizationMembers");

for (const user of Object.values(accounts)) {
  batch.set(usersCollection.doc(user.authUser.uid), {
    email: user.account.email,
    name: user.name,
    role: user.role,
    status: "active",
    isSynthetic: true,
    ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });
  if (user.organizationId) {
    batch.set(
      membershipsCollection.doc(`${user.organizationId}_${user.authUser.uid}`),
      {
        organizationId: user.organizationId,
        userId: user.authUser.uid,
        role: "owner",
        status: "active",
        isSynthetic: true,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      },
    );
  }
}

batch.set(organizationsCollection.doc(QA_ORGANIZATIONS.hospital), {
  type: "hospital",
  name: "Synthetic QA Hospital (Emulator Only)",
  city: "Example QA City",
  country: "Synthetic",
  verificationStatus: "verified",
  isSynthetic: true,
  createdAt: Timestamp.fromDate(now),
  updatedAt: Timestamp.fromDate(now),
});
batch.set(organizationsCollection.doc(QA_ORGANIZATIONS.bloodBank), {
  type: "bloodBank",
  name: "Synthetic QA Blood Bank (Emulator Only)",
  city: "Example QA City",
  country: "Synthetic",
  verificationStatus: "verified",
  isSynthetic: true,
  createdAt: Timestamp.fromDate(now),
  updatedAt: Timestamp.fromDate(now),
});

const collectionDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const expiryDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
batch.set(db.collection("_qaMetadata").doc("firebase-qa"), {
  isSynthetic: true,
  projectId: "demo-hemolink-qa",
  description: "Synthetic emulator-only QA fixtures. Contains no real patient information.",
  seededAt: FieldValue.serverTimestamp(),
});

await batch.commit();

const inventoryLots = [
  {
    id: "qa-synthetic-inventory",
    bloodBankId: QA_ORGANIZATIONS.bloodBank,
    componentType: "redCells",
    bloodGroup: "O+",
    rhFactor: "positive",
    unitsAvailable: 3,
    unitsReserved: 0,
    collectionDate: Timestamp.fromDate(collectionDate),
    expiryDate: Timestamp.fromDate(expiryDate),
    storageLocation: "Synthetic QA inventory",
    status: "available",
  },
  {
    id: "qa-synthetic-a-positive-whole-blood",
    bloodBankId: QA_ORGANIZATIONS.bloodBank,
    componentType: "wholeBlood",
    bloodGroup: "A+",
    rhFactor: "positive",
    unitsAvailable: 2,
    unitsReserved: 0,
    collectionDate: Timestamp.fromDate(collectionDate),
    expiryDate: Timestamp.fromDate(expiryDate),
    storageLocation: "Synthetic QA A+ whole blood",
    status: "available",
  },
];

const inventoryResults = [];
for (const { id, ...data } of inventoryLots) {
  const inventoryRef = db.collection("bloodInventory").doc(id);
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(inventoryRef);
    if (existing.exists) {
      const current = existing.data();
      if (
        current.bloodBankId !== data.bloodBankId
        || current.componentType !== data.componentType
        || current.bloodGroup !== data.bloodGroup
        || current.rhFactor !== data.rhFactor
      ) {
        throw new Error(`Existing synthetic inventory lot ${id} does not match its expected QA owner and type; it was not changed.`);
      }
      return false;
    }

    transaction.create(inventoryRef, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  inventoryResults.push({ id, result: created ? "created" : "preserved" });
}

console.log(JSON.stringify({
  projectId: "demo-hemolink-qa",
  syntheticOnly: true,
  patientRecordsSeeded: 0,
  organizations: QA_ORGANIZATIONS,
  users: Object.fromEntries(
    Object.entries(accounts).map(([role, user]) => [
      role,
      { uid: user.authUser.uid, email: user.account.email, password: user.account.password },
    ]),
  ),
  inventoryLots: inventoryResults,
}, null, 2));
