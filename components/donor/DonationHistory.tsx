"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { listOwnDonations } from "@/lib/donations";
import type { Donation } from "@/types/domain";

const label = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

export function DonationHistory({ compact = false }: { compact?: boolean }) {
  const { firebaseUser } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!firebaseUser) return;
    listOwnDonations(() => firebaseUser.getIdToken()).then(setDonations).catch((reason) => setError(reason instanceof Error ? reason.message : "Donation history could not be loaded.")).finally(() => setLoading(false));
  }, [firebaseUser]);
  if (loading) return <LoadingState title="Loading donation history" />;
  if (error) return <ErrorState title="Donation history unavailable" description={error} />;
  if (donations.length === 0) return <EmptyState title="No donations recorded yet." description="Verified donation records will appear here when an authorized blood-bank or administrator records them." />;
  const visible = compact ? donations.slice(0, 3) : donations;
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Blood group</th><th className="px-3 py-3">Component</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{visible.map((donation) => <tr key={donation.id}><td className="px-3 py-3 text-foreground-muted">{donation.donationDate ? new Date(donation.donationDate as unknown as string).toLocaleDateString() : "Not recorded"}</td><td className="px-3 py-3 font-semibold text-primary">{donation.bloodGroup}</td><td className="px-3 py-3 text-foreground-muted">{label(donation.componentType)}</td><td className="px-3 py-3 capitalize text-foreground-muted">{donation.status}</td></tr>)}</tbody></table></div>;
}
