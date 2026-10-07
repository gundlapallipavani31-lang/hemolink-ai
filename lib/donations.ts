import type { Donation } from "@/types/domain";

export async function listOwnDonations(getToken: () => Promise<string>) {
  const token = await getToken();
  const response = await fetch("/api/donor/donations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { donations?: Donation[]; error?: string };
  if (!response.ok) throw new Error(body.error || "Donation history could not be loaded.");
  return body.donations || [];
}
