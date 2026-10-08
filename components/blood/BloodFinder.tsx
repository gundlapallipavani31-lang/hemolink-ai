"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useState, type FormEvent } from "react";
import type { BloodComponent, BloodGroup } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
const label = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());

type AvailabilityResult = {
  organizationName: string;
  city: string;
  bloodGroup: string;
  component: string;
  availableUnits: number;
  expiryIndicator: string;
};

export function BloodFinder() {
  const { userProfile } = useAuth();
  const [results, setResults] = useState<AvailabilityResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({ bloodGroup: String(data.get("bloodGroup") || ""), component: String(data.get("component") || ""), location: String(data.get("location") || "") });
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/availability?${params.toString()}`);
      const body = (await response.json()) as { results?: AvailabilityResult[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Availability could not be loaded.");
      setResults(body.results || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Availability could not be loaded.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood finder</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Find recorded blood availability</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Search current available inventory shared by participating blood banks. Results show operational availability, not a clinical compatibility decision.</p>
      <form onSubmit={search} className="mt-8 grid gap-4 rounded-[1rem] border border-border bg-surface p-5 shadow-xs sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">Blood group<select name="bloodGroup" required className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select group</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Component<select name="component" required className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select component</option>{components.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">City or location<input name="location" className="h-12 rounded-lg border border-border-strong px-3" placeholder="Optional" /></label>
        <button disabled={loading} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:justify-self-start">{loading ? "Searching…" : "Search availability"}</button>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}
      {results !== null && results.length === 0 && (
        <section className="mt-8 rounded-[1rem] border border-border bg-surface p-8">
          <h2 className="text-lg font-semibold text-foreground">No matching blood available</h2>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">No current matching stock was found for this search. Hospitals can submit a request for authorized review.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-foreground">Need Blood Urgently?</p>
            <Link href={userProfile ? "/hospital/requests/emergency" : "/login"} className="inline-flex rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white">Create Emergency Request</Link>
          </div>
        </section>
      )}
      {results && results.length > 0 && (
        <section className="mt-8 overflow-x-auto rounded-[1rem] border border-border bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Blood bank</th><th className="px-5 py-4">Requirement</th><th className="px-5 py-4">Available units</th><th className="px-5 py-4">Expiry signal</th></tr></thead>
            <tbody className="divide-y divide-border">{results.map((result, index) => <tr key={`${result.organizationName}-${result.city}-${index}`}><td className="px-5 py-4"><p className="font-semibold text-foreground">{result.organizationName}</p><p className="text-xs text-foreground-muted">{result.city || "Location not recorded"}</p></td><td className="px-5 py-4 text-foreground">{result.bloodGroup} · {label(result.component)}</td><td className="px-5 py-4 font-semibold text-success">{result.availableUnits}</td><td className="px-5 py-4 text-foreground-muted">{label(result.expiryIndicator)}</td></tr>)}</tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
            <p className="text-sm font-semibold text-foreground">Need Blood Urgently?</p>
            <Link href={userProfile ? "/hospital/requests/emergency" : "/login"} className="inline-flex rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">Create Emergency Request</Link>
          </div>
        </section>
      )}
    </main>
  );
}
