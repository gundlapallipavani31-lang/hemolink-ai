"use client";

import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import type { BloodGroup } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components = ["wholeBlood", "redCells", "plasma", "platelets", "cryoprecipitate"];
type Donor = { userId: string; name: string; email: string; accountStatus: string; bloodGroup: BloodGroup | null; availabilityStatus: string; eligibilityStatus: string; city: string; donationHistoryAvailable: boolean; donationCount: number };
type BloodBankChoice = { id: string; name: string };

async function authorizedFetch(path: string, user: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>, init?: RequestInit) {
  const token = await user.getIdToken();
  return fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
}

export function DonorManagement() {
  const { firebaseUser } = useAuth();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [bloodBanks, setBloodBanks] = useState<BloodBankChoice[]>([]);
  const [selected, setSelected] = useState<Donor | null>(null);
  const [search, setSearch] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [availability, setAvailability] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!firebaseUser) return;
    authorizedFetch("/api/admin/donors", firebaseUser).then(async (response) => {
      const body = await response.json() as { donors?: Donor[]; bloodBanks?: BloodBankChoice[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Donors could not be loaded.");
      setDonors(body.donors || []);
      setBloodBanks(body.bloodBanks || []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Donors could not be loaded."));
  }, [firebaseUser]);
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !selected) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await authorizedFetch(`/api/admin/donors/${selected.userId}`, firebaseUser, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bloodGroup: data.get("bloodGroup"), availabilityStatus: data.get("availabilityStatus"), city: String(data.get("city") || "") }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Donor profile could not be updated.");
      const next = { ...selected, bloodGroup: String(data.get("bloodGroup")) as BloodGroup, availabilityStatus: String(data.get("availabilityStatus")), city: String(data.get("city") || "") };
      setSelected(next); setDonors((current) => current.map((donor) => donor.userId === next.userId ? next : donor)); setMessage("Donor profile updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Donor profile could not be updated."); } finally { setSaving(false); }
  }
  async function toggleAccount() {
    if (!firebaseUser || !selected || !window.confirm(`${selected.accountStatus === "disabled" ? "Enable" : "Disable"} this donor account?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await authorizedFetch(`/api/admin/users/${selected.userId}`, firebaseUser, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabled: selected.accountStatus !== "disabled" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Account status could not be changed.");
      const accountStatus = selected.accountStatus === "disabled" ? "active" : "disabled";
      const next = { ...selected, accountStatus };
      setSelected(next); setDonors((current) => current.map((donor) => donor.userId === next.userId ? next : donor)); setMessage(`Donor account ${accountStatus === "disabled" ? "disabled" : "enabled"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Account status could not be changed."); } finally { setSaving(false); }
  }
  async function recordDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !selected) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setError(""); setMessage("");
    try {
      const bloodGroup = String(data.get("bloodGroup") || "");
      const response = await authorizedFetch("/api/admin/donations", firebaseUser, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donorId: selected.userId, organizationId: data.get("organizationId"), bloodGroup, rhFactor: bloodGroup.endsWith("+") ? "positive" : "negative", componentType: data.get("componentType"), unitsCollected: Number(data.get("unitsCollected")), status: data.get("status"), donationDate: data.get("donationDate") }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Donation could not be recorded.");
      setMessage("Donation recorded."); event.currentTarget.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Donation could not be recorded."); } finally { setSaving(false); }
  }
  const filtered = donors.filter((donor) => (!bloodGroup || donor.bloodGroup === bloodGroup) && (!availability || donor.availabilityStatus === availability) && `${donor.name} ${donor.email} ${donor.userId} ${donor.city}`.toLowerCase().includes(search.toLowerCase()));
  if (error && donors.length === 0) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState title="Donor management unavailable" description={error} /></main>;
  if (!firebaseUser) return <LoadingState />;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Donor management</h1>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Review profiles, update permitted donor fields, record verified donations, and manage account access.</p>
    <div className="mt-8 flex flex-wrap gap-3 rounded-[1rem] border border-border bg-surface p-5"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search donor, email, city, or UID" className="h-11 min-w-64 flex-1 rounded-lg border border-border-strong px-3 text-sm" /><select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All blood groups</option>{groups.map((group) => <option key={group}>{group}</option>)}</select><select value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></div>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-success">{message}</p>}
    {filtered.length === 0 ? <div className="mt-6"><EmptyState title="No donor profiles found" description="Donor profiles will appear here after donors complete their profile setup." /></div> : <div className="mt-6 overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Donor</th><th className="px-5 py-4">Blood group</th><th className="px-5 py-4">Availability</th><th className="px-5 py-4">Eligibility</th><th className="px-5 py-4">Account</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((donor) => <tr key={donor.userId}><td className="px-5 py-4"><button onClick={() => setSelected(donor)} className="text-left"><p className="font-semibold text-primary hover:underline">{donor.name}</p><p className="text-xs text-foreground-muted">{donor.email || donor.city || "Contact not recorded"}</p></button></td><td className="px-5 py-4 font-semibold text-primary">{donor.bloodGroup || "Not set"}</td><td className="px-5 py-4 capitalize text-foreground-muted">{donor.availabilityStatus}</td><td className="px-5 py-4 capitalize text-foreground-muted">{donor.eligibilityStatus.replace("_", " ")}</td><td className="px-5 py-4 capitalize text-foreground-muted">{donor.accountStatus}</td>    <td className="px-5 py-4"><button onClick={() => setSelected(donor)} className="text-sm font-semibold text-primary">Open</button></td></tr>)}</tbody></table></div>}
    {selected && <section className="mt-8 grid gap-6 rounded-[1rem] border border-border bg-surface p-6 lg:grid-cols-2"><div><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-foreground-subtle">Selected donor</p><h2 className="mt-2 text-xl font-semibold text-foreground">{selected.name}</h2><p className="mt-1 text-sm text-foreground-muted">{selected.email || "Email not recorded"}</p><p className="mt-2 text-sm text-foreground-muted">{selected.donationCount} donation record{selected.donationCount === 1 ? "" : "s"}</p></div><button onClick={() => setSelected(null)} className="text-sm text-foreground-muted underline">Close</button></div><form onSubmit={updateProfile} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-medium">Blood group<select name="bloodGroup" defaultValue={selected.bloodGroup || ""} className="h-11 rounded-lg border border-border-strong bg-surface px-3"><option value="">Not set</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Availability<select name="availabilityStatus" defaultValue={selected.availabilityStatus} className="h-11 rounded-lg border border-border-strong bg-surface px-3"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label><label className="grid gap-2 text-sm font-medium">City<input name="city" defaultValue={selected.city} className="h-11 rounded-lg border border-border-strong px-3" /></label><button disabled={saving} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save permitted fields"}</button></form><button onClick={() => void toggleAccount()} disabled={saving} className="mt-4 text-sm font-semibold text-danger">{selected.accountStatus === "disabled" ? "Enable account" : "Disable account"}</button></div><form onSubmit={recordDonation} className="grid content-start gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6"><h3 className="font-semibold text-foreground">Record verified donation</h3><p className="text-sm leading-6 text-foreground-muted">This creates a persisted record and audit event. Completed donations update the donor’s last donation date.</p><label className="grid gap-2 text-sm font-medium">Blood Bank<select name="organizationId" required className="h-11 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select verified blood bank</option>{bloodBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Blood group<select name="bloodGroup" defaultValue={selected.bloodGroup || ""} required className="h-11 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select group</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Component<select name="componentType" required className="h-11 rounded-lg border border-border-strong bg-surface px-3">{components.map((component) => <option key={component} value={component}>{component}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Units collected<input name="unitsCollected" type="number" min={1} step={1} required className="h-11 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Donation date<input name="donationDate" type="date" required className="h-11 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Status<select name="status" defaultValue="completed" className="h-11 rounded-lg border border-border-strong bg-surface px-3"><option value="completed">Completed</option><option value="scheduled">Scheduled</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label><button disabled={saving || bloodBanks.length === 0} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Recording…" : "Record donation"}</button></form></section>}
  </main>;
}
