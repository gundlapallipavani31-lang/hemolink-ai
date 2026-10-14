import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const emailArguments = args.filter((argument) => argument !== "--apply");
const targetEmail = emailArguments.length === 1 ? emailArguments[0].trim() : "";
let knownUid = "";

function report(uid, outcome, changesApplied) {
  process.stdout.write(`${JSON.stringify({
    targetEmail: targetEmail || null,
    uid: uid || null,
    projectId: projectId || null,
    validationOutcome: outcome,
    changesApplied,
  })}\n`);
}

function fail(outcome, uid = knownUid) {
  report(uid, outcome, "no");
  process.exitCode = 1;
}

if (emailArguments.length !== 1 || !targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  fail("Provide exactly one valid target email address.");
} else if (projectId !== "hemolink-ai") {
  fail("Refusing to run: FIREBASE_ADMIN_PROJECT_ID must be exactly hemolink-ai.");
} else if (
  !process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  || !process.env.FIREBASE_ADMIN_PRIVATE_KEY
) {
  fail("Firebase Admin credentials are not fully configured in the environment.");
} else {
  try {
    const app = getApps()[0] ?? initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    const auth = getAuth(app);
    const db = getFirestore(app);

    let authUser;
    try {
      authUser = await auth.getUserByEmail(targetEmail);
      knownUid = authUser.uid;
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        fail("No Firebase Authentication account was found for the target email.");
      } else {
        fail("The Firebase Authentication account could not be verified.");
      }
    }

    if (authUser) {
      const profileSnapshot = await db.collection("users").doc(authUser.uid).get();
      if (!profileSnapshot.exists) {
        report(authUser.uid, "The saved user profile does not exist.", "no");
        process.exitCode = 1;
      } else {
        const profile = profileSnapshot.data();
        const profileEmail = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
        const authEmail = typeof authUser.email === "string" ? authUser.email.trim().toLowerCase() : "";
        const requestedRole = typeof profile.requestedRole === "string"
          ? profile.requestedRole.trim().toLowerCase()
          : "";

        if (!authEmail || authEmail !== targetEmail.toLowerCase() || profileEmail !== authEmail) {
          report(authUser.uid, "The target email does not match both the Auth account and saved profile.", "no");
          process.exitCode = 1;
        } else if (authUser.disabled || profile.status === "disabled") {
          report(authUser.uid, "The target account is disabled and cannot be bootstrapped.", "no");
          process.exitCode = 1;
        } else if (requestedRole !== "administrator") {
          report(authUser.uid, "The saved profile does not identify an Administrator access request.", "no");
          process.exitCode = 1;
        } else if (!["pending", "administrator"].includes(profile.role)) {
          report(authUser.uid, "The saved role must be pending or already administrator.", "no");
          process.exitCode = 1;
        } else if (!apply) {
          report(authUser.uid, "Validation passed; no changes were made (dry-run).", "no");
        } else {
          const profileRef = db.collection("users").doc(authUser.uid);
          let roleReady = profile.role === "administrator";
          let changed = false;
          try {
            await db.runTransaction(async (transaction) => {
              const currentSnapshot = await transaction.get(profileRef);
              if (!currentSnapshot.exists) {
                throw new Error("Profile changed after validation.");
              }
              const currentProfile = currentSnapshot.data();
              const currentRequestedRole = typeof currentProfile.requestedRole === "string"
                ? currentProfile.requestedRole.trim().toLowerCase()
                : "";
              if (
                currentRequestedRole !== "administrator"
                || currentProfile.status === "disabled"
                || !["pending", "administrator"].includes(currentProfile.role)
              ) {
                throw new Error("Profile no longer passes validation.");
              }
              if (currentProfile.role !== "administrator") {
                transaction.update(profileRef, { role: "administrator" });
              }
              roleReady = true;
            });
            changed = profile.role !== "administrator";
          } catch {
            report(authUser.uid, "The saved profile changed or failed validation; no custom claim was assigned.", "no");
            process.exitCode = 1;
            roleReady = false;
          }

          if (roleReady) {
            try {
              const currentAuthUser = await auth.getUser(authUser.uid);
              if (currentAuthUser.disabled) {
                throw new Error("The Authentication account is disabled.");
              }
              if (currentAuthUser.customClaims?.admin !== true) {
                await auth.setCustomUserClaims(authUser.uid, {
                  ...currentAuthUser.customClaims,
                  admin: true,
                });
                changed = true;
              }
              report(
                authUser.uid,
                "Validation passed; administrator role and claim are reconciled.",
                changed ? "yes" : "no (already reconciled)",
              );
            } catch {
              report(
                authUser.uid,
                "The saved role may now be administrator, but the admin claim update failed. Access is incomplete and must not be used until both are reconciled.",
                changed ? "partial" : "no",
              );
              process.exitCode = 1;
            }
          }
        }
      }
    }
  } catch {
    fail("Firebase verification or bootstrap failed; no sensitive error details were printed.", knownUid);
  }
}
