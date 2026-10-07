import type { FirebaseError } from "firebase/app";

export function getFirebaseErrorMessage(error: unknown, action: "login" | "register") {
  if (!(error instanceof Error) || !("code" in error)) {
    return "Something went wrong. Please try again.";
  }

  const code = (error as FirebaseError).code;

  if (code === "auth/network-request-failed") {
    return "We could not reach Firebase. Check your connection and try again.";
  }

  if (action === "register") {
    if (code === "auth/email-already-in-use") {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (code === "auth/invalid-email") {
      return "Enter a valid email address.";
    }
    if (code === "auth/weak-password") {
      return "Choose a stronger password with at least 8 characters.";
    }
  }

  if (action === "login") {
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password"
    ) {
      return "The email or password is incorrect.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (code === "auth/invalid-email") {
      return "Enter a valid email address.";
    }
  }

  return "We could not complete that request. Please try again.";
}
