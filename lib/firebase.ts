import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const QA_PROJECT_ID = "demo-hemolink-qa";

function getFirebaseServices() {
  const qaMode = process.env.NEXT_PUBLIC_FIREBASE_QA_MODE === "true";
  const emulatorAuthHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  const emulatorFirestoreHost = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST;
  const emulatorFirestorePort = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT;

  if (qaMode) {
    const warning = "Firebase QA mode requires the demo-hemolink-qa project and loopback Auth/Firestore emulator settings. Source scripts/qa-env.ps1 and start the emulators; no production Firebase connection will be attempted.";
    if (
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== QA_PROJECT_ID
      || emulatorAuthHost !== "127.0.0.1:9099"
      || emulatorFirestoreHost !== "127.0.0.1"
      || emulatorFirestorePort !== "8080"
    ) {
      console.warn(warning);
      throw new Error(warning);
    }
  }

  const firebaseConfig = qaMode
    ? {
      apiKey: "qa-emulator-api-key",
      authDomain: "127.0.0.1",
      projectId: QA_PROJECT_ID,
      appId: "1:000000000000:web:qa-emulator",
    }
    : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

  const existingApp = getApps().length ? getApp() : null;
  if (qaMode && existingApp && existingApp.options.projectId !== QA_PROJECT_ID) {
    const warning = "Firebase QA mode refused to reuse an app that is not configured for demo-hemolink-qa.";
    console.warn(warning);
    throw new Error(warning);
  }

  const firebaseApp = existingApp ?? initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  if (qaMode) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }

  return { firebaseApp, auth, db, storage: getStorage(firebaseApp) };
}

const firebaseServices = getFirebaseServices();

export const firebaseApp = firebaseServices.firebaseApp;
export const auth = firebaseServices.auth;
export const db = firebaseServices.db;
export const storage = firebaseServices.storage;