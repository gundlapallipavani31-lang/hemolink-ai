import { createConnection } from "node:net";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const QA_PROJECT_ID = "demo-hemolink-qa";
export const QA_AUTH_HOST = "127.0.0.1:9099";
export const QA_FIRESTORE_HOST = "127.0.0.1:8080";
export const QA_AUTH_URL = `http://${QA_AUTH_HOST}`;
export const QA_CREDENTIALS = {
  admin: { email: "admin.qa@hemolink.test", password: "QaOnly-ChangeMe-2026!" },
  hospital: { email: "hospital.qa@hemolink.test", password: "QaOnly-ChangeMe-2026!" },
  bloodBank: { email: "bloodbank.qa@hemolink.test", password: "QaOnly-ChangeMe-2026!" },
};
export const QA_ORGANIZATIONS = {
  hospital: "qa-hospital-synthetic",
  bloodBank: "qa-blood-bank-synthetic",
};

function assertEmulatorListening(port, label) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`${label} Emulator is not reachable on 127.0.0.1:${port}. Start the local Firebase emulators before running QA scripts.`));
    });
    socket.once("error", () => {
      reject(new Error(`${label} Emulator is not reachable on 127.0.0.1:${port}. Start the local Firebase emulators before running QA scripts.`));
    });
  });
}

export async function getQaAdminServices() {
  const warning = "QA scripts require FIREBASE_QA_MODE=true, FIREBASE_ADMIN_PROJECT_ID=demo-hemolink-qa, FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099, and FIRESTORE_EMULATOR_HOST=127.0.0.1:8080. No production Firebase connection will be attempted.";
  if (
    process.env.FIREBASE_QA_MODE !== "true"
    || process.env.FIREBASE_ADMIN_PROJECT_ID !== QA_PROJECT_ID
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== QA_AUTH_HOST
    || process.env.FIRESTORE_EMULATOR_HOST !== QA_FIRESTORE_HOST
  ) {
    console.warn(warning);
    throw new Error(warning);
  }

  await Promise.all([
    assertEmulatorListening(9099, "Firebase Authentication"),
    assertEmulatorListening(8080, "Cloud Firestore"),
  ]);

  const app = getApps()[0] ?? initializeApp({ projectId: QA_PROJECT_ID });
  if (app.options.projectId !== QA_PROJECT_ID) {
    throw new Error(`Refusing to use Firebase project ${app.options.projectId ?? "unknown"} in QA mode.`);
  }

  return { auth: getAuth(app), db: getFirestore(app) };
}

export async function findOrCreateQaUser(auth, account, displayName) {
  try {
    return await auth.getUserByEmail(account.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    return auth.createUser({
      email: account.email,
      password: account.password,
      emailVerified: true,
      displayName,
    });
  }
}

export async function signInQaUser(account) {
  const response = await fetch(
    `${QA_AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-emulator-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    },
  );
  const result = await response.json();
  if (!response.ok || typeof result.idToken !== "string") {
    throw new Error(`QA sign-in failed for ${account.email}: ${result.error?.message ?? response.statusText}`);
  }
  return result.idToken;
}
