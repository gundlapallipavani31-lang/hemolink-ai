import {
  getQaAdminServices,
  QA_CREDENTIALS,
  QA_ORGANIZATIONS,
  signInQaUser,
} from "./firebase-qa-common.mjs";

const { auth, db } = await getQaAdminServices();
const appUrl = process.env.QA_APP_URL ?? "http://127.0.0.1:3000";

async function expectStatus(label, response, expectedStatus) {
  const body = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected HTTP ${expectedStatus}, received ${response.status}: ${body.error ?? ""}`);
  }
  console.log(`PASS ${label} (HTTP ${response.status})`);
  return body;
}

async function api(path, { token, method = "GET", body } = {}) {
  return fetch(new URL(path, appUrl), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const [adminToken, hospitalToken, bloodBankToken] = await Promise.all([
  signInQaUser(QA_CREDENTIALS.admin),
  signInQaUser(QA_CREDENTIALS.hospital),
  signInQaUser(QA_CREDENTIALS.bloodBank),
]);

const hospitalUser = await auth.getUserByEmail(QA_CREDENTIALS.hospital.email);
const bloodBankUser = await auth.getUserByEmail(QA_CREDENTIALS.bloodBank.email);

for (const [label, organizationId, user] of [
  ["hospital", QA_ORGANIZATIONS.hospital, hospitalUser],
  ["blood bank", QA_ORGANIZATIONS.bloodBank, bloodBankUser],
]) {
  const [organization, membership, profile] = await Promise.all([
    db.collection("organizations").doc(organizationId).get(),
    db.collection("organizationMembers").doc(`${organizationId}_${user.uid}`).get(),
    db.collection("users").doc(user.uid).get(),
  ]);
  if (
    !organization.exists
    || organization.data().verificationStatus !== "verified"
    || organization.data().isSynthetic !== true
    || !membership.exists
    || membership.data().status !== "active"
    || membership.data().isSynthetic !== true
    || !profile.exists
    || profile.data().organizationId !== organizationId
    || profile.data().status !== "active"
  ) {
    throw new Error(`Synthetic ${label} verification or active membership is invalid.`);
  }
}
console.log("PASS synthetic hospital and blood-bank verified active memberships");

await expectStatus(
  "unauthenticated hospital request is denied",
  await api("/api/hospital/requests", {
    method: "POST",
    body: {},
  }),
  401,
);
await expectStatus(
  "blood bank cannot create hospital requests",
  await api("/api/hospital/requests", {
    token: bloodBankToken,
    method: "POST",
    body: {},
  }),
  403,
);
await expectStatus(
  "hospital cannot call administrator triage",
  await api("/api/admin/requests/decision", {
    token: hospitalToken,
    method: "POST",
    body: { requestId: "qa-not-created", action: "assign_to_me" },
  }),
  403,
);
await expectStatus(
  "blood bank cannot access administrator users",
  await api("/api/admin/users", { token: bloodBankToken }),
  403,
);

const neededBy = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const created = await expectStatus(
  "verified hospital creates an explicitly synthetic request",
  await api("/api/hospital/requests", {
    token: hospitalToken,
    method: "POST",
    body: {
      patientName: "SYNTHETIC QA ONLY — NOT A REAL PATIENT",
      caseId: `QA-SYNTHETIC-${Date.now()}`,
      bloodGroup: "O+",
      rhFactor: "positive",
      componentType: "redCells",
      unitsRequested: 2,
      urgency: "emergency",
      neededBy,
      notes: "SYNTHETIC QA DATA — emulator workflow validation only; no patient information.",
    },
  }),
  201,
);
if (typeof created.id !== "string" || !created.id) {
  throw new Error("Hospital request API did not return a request ID.");
}

await expectStatus(
  "blood bank cannot act on an unassigned request",
  await api("/api/blood-bank/requests", {
    token: bloodBankToken,
    method: "POST",
    body: { requestId: created.id, action: "prepare" },
  }),
  400,
);

for (const action of ["assign_to_me", "acknowledge"]) {
  await expectStatus(
    `administrator ${action}`,
    await api("/api/admin/requests/decision", {
      token: adminToken,
      method: "POST",
      body: { requestId: created.id, action },
    }),
    200,
  );
}

await expectStatus(
  "administrator approves request and reserves synthetic stock",
  await api("/api/admin/requests/decision", {
    token: adminToken,
    method: "POST",
    body: { requestId: created.id, action: "approve" },
  }),
  200,
);

const bankRequestsResponse = await api("/api/blood-bank/requests", { token: bloodBankToken });
const { requests: bankRequests = [] } = await expectStatus(
  "verified blood bank can see its assigned request",
  bankRequestsResponse,
  200,
);
if (!bankRequests.some((request) => request.id === created.id)) {
  throw new Error("Approved request was not visible to its assigned blood bank.");
}

await expectStatus(
  "blood bank prepares reserved units",
  await api("/api/blood-bank/requests", {
    token: bloodBankToken,
    method: "POST",
    body: { requestId: created.id, action: "prepare" },
  }),
  200,
);
await expectStatus(
  "blood bank dispatches reserved units",
  await api("/api/blood-bank/requests", {
    token: bloodBankToken,
    method: "POST",
    body: { requestId: created.id, action: "dispatch", units: 2 },
  }),
  200,
);
await expectStatus(
  "hospital confirms receipt",
  await api("/api/hospital/requests/receipt", {
    token: hospitalToken,
    method: "POST",
    body: { requestId: created.id, units: 2 },
  }),
  200,
);

const request = await db.collection("bloodRequests").doc(created.id).get();
const events = await db.collection("bloodRequestEvents").where("requestId", "==", created.id).get();
if (
  !request.exists
  || request.data().status !== "fulfilled"
  || request.data().hospitalId !== QA_ORGANIZATIONS.hospital
  || !request.data().assignedBloodBankIds?.includes(QA_ORGANIZATIONS.bloodBank)
  || request.data().patientName !== "SYNTHETIC QA ONLY — NOT A REAL PATIENT"
  || events.docs.length < 6
) {
  throw new Error("Final synthetic request state or workflow audit events did not match expectations.");
}

console.log(JSON.stringify({
  result: "PASS",
  requestId: created.id,
  finalStatus: request.data().status,
  eventCount: events.docs.length,
  syntheticOnly: true,
  projectId: "demo-hemolink-qa",
}, null, 2));
