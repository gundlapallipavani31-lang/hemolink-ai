import type { Firestore, Transaction } from "firebase-admin/firestore";

const validBloodBankMemberRoles = new Set([
  "owner",
  "staff",
  "clinician",
  "inventory_manager",
  "viewer",
]);

type SnapshotDocument = {
  id: string;
  data(): Record<string, unknown>;
};

export function verifiedActiveBloodBankIdsFromDocuments(
  organizations: SnapshotDocument[],
  memberships: SnapshotDocument[],
) {
  const verifiedOrganizations = new Set(
    organizations
      .filter((document) => {
        const data = document.data();
        return data.type === "bloodBank" && data.verificationStatus === "verified";
      })
      .map((document) => document.id),
  );
  const activeOrganizationIds = new Set<string>();
  for (const document of memberships) {
    const member = document.data();
    if (
      typeof member.organizationId === "string"
      && verifiedOrganizations.has(member.organizationId)
      && typeof member.userId === "string"
      && member.userId.length > 0
      && member.status === "active"
      && typeof member.role === "string"
      && validBloodBankMemberRoles.has(member.role)
    ) {
      activeOrganizationIds.add(member.organizationId);
    }
  }
  return activeOrganizationIds;
}

export async function loadVerifiedActiveBloodBankIds(db: Firestore) {
  const [organizations, memberships] = await Promise.all([
    db.collection("organizations").where("type", "==", "bloodBank").get(),
    db.collection("organizationMembers")
      .where("status", "==", "active")
      .get(),
  ]);
  return verifiedActiveBloodBankIdsFromDocuments(organizations.docs, memberships.docs);
}

export async function loadVerifiedActiveBloodBanks(db: Firestore) {
  const [organizations, memberships] = await Promise.all([
    db.collection("organizations").where("type", "==", "bloodBank").get(),
    db.collection("organizationMembers")
      .where("status", "==", "active")
      .get(),
  ]);
  const activeIds = verifiedActiveBloodBankIdsFromDocuments(
    organizations.docs,
    memberships.docs,
  );
  return new Map(
    organizations.docs
      .filter((document) => activeIds.has(document.id))
      .map((document) => [document.id, document.data()]),
  );
}

export async function readVerifiedActiveBloodBankIds(
  transaction: Transaction,
  db: Firestore,
  organizationIds: Iterable<string>,
) {
  const ids = [...new Set(organizationIds)].filter(Boolean);
  const results = await Promise.all(ids.map(async (id) => {
    const [organization, memberships] = await Promise.all([
      transaction.get(db.collection("organizations").doc(id)),
      transaction.get(
        db.collection("organizationMembers")
          .where("organizationId", "==", id),
      ),
    ]);
    if (
      !organization.exists
      || organization.data()?.type !== "bloodBank"
      || organization.data()?.verificationStatus !== "verified"
    ) {
      return null;
    }
    const hasOperationalMember = memberships.docs.some((document) => {
      const member = document.data();
      return member.organizationId === id
        && typeof member.userId === "string"
        && member.userId.length > 0
        && member.status === "active"
        && typeof member.role === "string"
        && validBloodBankMemberRoles.has(member.role);
    });
    return hasOperationalMember ? id : null;
  }));
  return new Set(results.filter((id): id is string => id !== null));
}
