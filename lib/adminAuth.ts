import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminServices } from "@/lib/firebaseAdmin";

export async function requireTrustedAdmin(idToken: string) {
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken);
  if (decoded.admin !== true) throw new Error("Administrator authorization is required.");

  const profile = await db.collection("users").doc(decoded.uid).get();
  if (!profile.exists || profile.data()?.role !== "administrator") {
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
  const status = message.includes("authorization") ? 403 : message.includes("not found") ? 404 : 400;
  return Response.json({ error: message }, { status });
}

export type AdminToken = DecodedIdToken;
