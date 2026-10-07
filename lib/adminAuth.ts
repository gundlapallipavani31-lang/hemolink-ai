import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminServices } from "@/lib/firebaseAdmin";

export async function requireTrustedAdmin(idToken: string) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.admin !== true) throw new Error("Administrator authorization is required.");

  const profile = await db.collection("users").doc(decoded.uid).get();
  if (
    !profile.exists
    || profile.data()?.role !== "administrator"
    || profile.data()?.status === "disabled"
  ) {
    throw new Error("Administrator authorization is required.");
  }
  return { auth, db, decoded };
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

export function adminErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The operation could not be completed.";
  const authError = error as { code?: string };
  const status = authError.code === "auth/id-token-revoked" || authError.code === "auth/invalid-id-token"
    ? 401
    : message.includes("authorization")
      ? 403
      : message.includes("not found")
        ? 404
        : 400;
  return Response.json({ error: message }, { status });
}

export type AdminToken = DecodedIdToken;
