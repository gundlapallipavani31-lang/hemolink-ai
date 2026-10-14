import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const QA_PROJECT_ID = "demo-hemolink-qa";

function configureQaEmulators() {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const warning = "Firebase QA mode requires FIREBASE_ADMIN_PROJECT_ID=demo-hemolink-qa, FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099, and FIRESTORE_EMULATOR_HOST=127.0.0.1:8080. Source scripts/qa-env.ps1 and start the emulators; no production Firebase connection will be attempted.";

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID !== QA_PROJECT_ID
    || authEmulatorHost !== "127.0.0.1:9099"
    || firestoreEmulatorHost !== "127.0.0.1:8080"
  ) {
    console.warn(warning);
    throw new Error(warning);
  }

  process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulatorHost;
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulatorHost;
}

function getAdminApp() {
  const qaMode = process.env.FIREBASE_QA_MODE === "true";
  if (qaMode) configureQaEmulators();

  const existing = getApps()[0];
  if (existing) {
    if (qaMode && existing.options.projectId !== QA_PROJECT_ID) {
      const warning = "Firebase Admin QA mode refused to reuse an app that is not configured for demo-hemolink-qa.";
      console.warn(warning);
      throw new Error(warning);
    }
    return existing;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (qaMode) return initializeApp({ projectId: QA_PROJECT_ID });

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin configuration is missing.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminServices() {
  const app = getAdminApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
