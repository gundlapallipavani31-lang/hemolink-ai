import type { User as FirebaseUser } from "firebase/auth";

type AdminErrorBody = {
  error?: string;
  code?: string;
};

async function readBody(response: Response) {
  try {
    return await response.json() as AdminErrorBody & Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function adminClientFetch<T>(
  path: string | URL,
  user: FirebaseUser,
  init: RequestInit = {},
): Promise<T> {
  const request = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers });
    return { response, body: await readBody(response) };
  };

  let result = await request(false);
  if (
    result.response.status === 403
    && result.body.code === "admin_claim_missing"
  ) {
    result = await request(true);
  }
  if (!result.response.ok) {
    throw new Error(result.body.error || "Administrator data could not be loaded.");
  }
  return result.body as T;
}
