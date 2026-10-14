import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminServices } from "@/lib/firebaseAdmin";

export class AdminAuthorizationError extends Error {
  constructor(
    readonly code: "admin_claim_missing" | "admin_profile_missing" | "admin_profile_mismatch" | "admin_account_disabled",
    message: string,
  ) {
    super(message);
  }
}

export async function requireTrustedAdmin(idToken: string) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.admin !== true) {
    throw new AdminAuthorizationError(
      "admin_claim_missing",
      "Administrator access is not present in this session. Refreshing your session may resolve this; if not, contact an authorized administrator.",
    );
  }

  const profile = await db.collection("users").doc(decoded.uid).get();
  if (!profile.exists) {
    throw new AdminAuthorizationError("admin_profile_missing", "Administrator profile authorization is unavailable.");
  }
  const profileData = profile.data();
  if (profileData?.status === "disabled") {
    throw new AdminAuthorizationError("admin_account_disabled", "This account is disabled.");
  }
  if (profileData?.role !== "administrator") {
    throw new AdminAuthorizationError("admin_profile_mismatch", "Administrator profile authorization is required.");
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
  if (error instanceof AdminAuthorizationError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
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
