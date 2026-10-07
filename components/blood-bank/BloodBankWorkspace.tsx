"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { getOrganization, updateOrganizationProfile } from "@/lib/bloodBank";
import {
  createBloodInventory,
  getBloodInventory,
  getExpiryState,
  listBloodInventory,
  updateBloodInventory,
  type InventoryInput,
} from "@/lib/bloodInventory";
import type {
  BloodComponent,
  BloodGroup,
  BloodInventory,
  InventoryStatus,
  Organization,
  RhFactor,
} from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];
const statuses: InventoryStatus[] = [
  "available",
  "reserved",
  "dispatched",
  "expired",
  "quarantined",
  "discarded",
];

function label(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: BloodInventory["expiryDate"]) {
  return value?.toDate().toLocaleDateString() ?? "Not recorded";
}

function useBloodBankOrganization() {
  const { userProfile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userProfile?.organizationId) return;
    getOrganization(userProfile.organizationId)
      .then(setOrganization)
      .catch(() => setError("We could not load your blood-bank profile."))
      .finally(() => setLoading(false));
  }, [userProfile?.organizationId]);

  return { organization, setOrganization, loading, error, setError };
}

function useInventory() {
  const { userProfile } = useAuth();
  const [inventory, setInventory] = useState<BloodInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userProfile?.organizationId) return;
    listBloodInventory(userProfile.organizationId)
      .then(setInventory)
      .catch(() => setError("We could not load inventory. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, [userProfile?.organizationId]);

  return { inventory, setInventory, loading, error, setError };
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const tone =
    status === "available"
      ? "bg-green-50 text-success"
      : status === "reserved"
        ? "bg-amber-50 text-warning"
        : status === "quarantined" || status === "expired" || status === "discarded"
          ? "bg-red-50 text-danger"
          : "bg-surface-muted text-foreground-muted";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label(status)}</span>;
}

function ExpiryIndicator({ item }: { item: BloodInventory }) {
  const state = getExpiryState(item.expiryDate);
  const text = {
    expired: "Expired",
    within7Days: "Within 7 days",
    within30Days: "Within 30 days",
    normal: "Normal",
    unknown: "Unknown",
  }[state];
  const tone = state === "expired" ? "text-danger" : state === "within7Days" ? "text-warning" : "text-foreground-muted";
  return <span className={`text-xs font-medium ${tone}`}>{text}</span>;
}

export function BloodBankDashboard() {
  const { userProfile } = useAuth();
  const { inventory, loading, error } = useInventory();
  const totalAvailable = inventory.reduce((sum, item) => sum + item.unitsAvailable, 0);
  const totalReserved = inventory.reduce((sum, item) => sum + item.unitsReserved, 0);
  const expiringSoon = inventory.filter((item) => {
    const state = getExpiryState(item.expiryDate);
    return state === "within7Days" || state === "within30Days";
  }).length;

  if (loading) return <LoadingState title="Loading blood-bank dashboard" />;
  if (error) return <ErrorState title="Dashboard unavailable" description={error} />;
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood-bank workspace</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">{userProfile?.name || "Blood-bank operations"}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Monitor recorded units and maintain a reliable inventory trail for your organization.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Available units", totalAvailable.toString()], ["Reserved units", totalReserved.toString()], ["Expiring soon", expiringSoon.toString()], ["Low stock", "Not configured"]].map(([heading, value]) => <div key={heading} className="rounded-[1rem] border border-border bg-surface p-5 shadow-xs"><p className="text-xs uppercase tracking-[0.14em] text-foreground-subtle">{heading}</p><p className="mt-3 text-2xl font-semibold text-primary">{value}</p></div>)}
      </div>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/blood-bank/inventory/new" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Add blood units</Link><Link href="/blood-bank/inventory" className="rounded-lg border border-border-strong px-4 py-3 text-sm font-semibold text-primary">View inventory</Link></div>
      <section className="mt-8 rounded-[1rem] border border-border bg-surface p-6"><h2 className="font-semibold text-foreground">Blood-group availability overview</h2>{inventory.length === 0 ? <div className="mt-5"><EmptyState title="No inventory recorded yet" description="Recorded blood units will appear here after authorized staff add inventory." /></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{bloodGroups.map((group) => <div key={group} className="rounded-lg bg-surface-muted p-4"><p className="text-sm font-semibold text-foreground">{group}</p><p className="mt-2 text-lg font-semibold text-primary">{inventory.filter((item) => item.bloodGroup === group).reduce((sum, item) => sum + item.unitsAvailable, 0)} units</p></div>)}</div>}</section>
    </main>
  );
}

export function BloodBankProfilePage() {
  const { organization, setOrganization, loading, error, setError } = useBloodBankOrganization();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  if (loading) return <LoadingState title="Loading organization profile" />;
  if (!organization) return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><EmptyState title="Organization membership is not configured" description="A trusted blood-bank organization membership is required before profile data can be displayed or edited." /></main>;
  const current = organization;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = {
      name: String(data.get("name") || "").trim(),
      legalName: String(data.get("legalName") || "").trim(),
      registrationNumber: String(data.get("registrationNumber") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      address: String(data.get("address") || "").trim(),
      city: String(data.get("city") || "").trim(),
      state: String(data.get("state") || "").trim(),
      country: String(data.get("country") || "").trim(),
    };
    setSaving(true); setSaved(""); setError("");
    try { await updateOrganizationProfile(current.id, next); setOrganization({ ...current, ...next }); setSaved("Organization profile saved."); } catch { setError("We could not save this profile."); } finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood-bank profile</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Organization information</h1><form onSubmit={submit} className="mt-8 grid gap-5 rounded-[1rem] border border-border bg-surface p-6 sm:grid-cols-2">{["name", "legalName", "registrationNumber", "email", "phone", "address", "city", "state", "country"].map((field) => <label key={field} className="grid gap-2 text-sm font-medium capitalize">{label(field)}<input name={field} defaultValue={current[field as keyof Organization] as string || ""} className="h-12 rounded-lg border border-border-strong px-3" /></label>)}<div className="sm:col-span-2"><p className="text-sm text-foreground-muted">Verification status: <span className="font-semibold capitalize text-primary">{current.verificationStatus}</span></p>{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}{saved && <p role="status" className="mt-3 text-sm text-success">{saved}</p>}<button disabled={saving} className="mt-5 h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button></div></form></main>;
}

function InventoryTable({ inventory }: { inventory: BloodInventory[] }) {
  return <div className="overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Blood group</th><th className="px-5 py-4">Component</th><th className="px-5 py-4">Units</th><th className="px-5 py-4">Expiry</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Location</th></tr></thead><tbody className="divide-y divide-border">{inventory.map((item) => <tr key={item.id} className="hover:bg-surface-muted"><td className="px-5 py-4 font-semibold text-foreground"><Link href={`/blood-bank/inventory/${item.id}`} className="hover:text-primary">{item.bloodGroup} <span className="text-xs font-normal text-foreground-muted">({item.rhFactor})</span></Link></td><td className="px-5 py-4 text-foreground-muted">{label(item.componentType)}</td><td className="px-5 py-4 text-foreground">{item.unitsAvailable} available / {item.unitsReserved} reserved</td><td className="px-5 py-4"><p className="text-foreground">{formatDate(item.expiryDate)}</p><ExpiryIndicator item={item} /></td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4 text-foreground-muted">{item.storageLocation || "—"}</td></tr>)}</tbody></table></div>;
}

export function InventoryListPage() {
  const { inventory, loading, error } = useInventory();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [component, setComponent] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => inventory.filter((item) => `${item.bloodGroup} ${item.componentType} ${item.storageLocation}`.toLowerCase().includes(search.toLowerCase()) && (!group || item.bloodGroup === group) && (!component || item.componentType === component) && (!status || item.status === status)), [component, group, inventory, search, status]);
  if (loading) return <LoadingState title="Loading inventory" />;
  if (error) return <ErrorState title="Inventory unavailable" description={error} />;
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Inventory</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Blood units</h1></div><Link href="/blood-bank/inventory/new" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Add blood units</Link></div><div className="mt-8 grid gap-3 rounded-[1rem] border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" className="h-11 rounded-lg border border-border-strong px-3 text-sm" /><select value={group} onChange={(event) => setGroup(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All blood groups</option>{bloodGroups.map((item) => <option key={item}>{item}</option>)}</select><select value={component} onChange={(event) => setComponent(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All components</option>{components.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div><div className="mt-5">{filtered.length === 0 ? <EmptyState title="No inventory recorded yet" description={inventory.length === 0 ? "Add recorded units to begin managing blood-bank inventory." : "No inventory matches the selected filters."} /> : <InventoryTable inventory={filtered} />}</div></main>;
}

function InventoryForm({ existing, onSaved }: { existing?: BloodInventory; onSaved: (id: string) => void }) {
  const { userProfile } = useAuth();
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!userProfile?.organizationId) { setError("Your trusted organization membership is not configured."); return; }
    const data = new FormData(event.currentTarget); const collectionDate = new Date(String(data.get("collectionDate"))); const expiryDate = new Date(String(data.get("expiryDate"))); const units = Number(data.get("unitsAvailable")); const reserved = Number(data.get("unitsReserved") || 0);
    if (!Number.isInteger(units) || units <= 0 || !Number.isInteger(reserved) || reserved < 0 || reserved > units) { setError("Units must be positive whole numbers, and reserved units cannot exceed available units."); return; }
    if (Number.isNaN(collectionDate.getTime()) || Number.isNaN(expiryDate.getTime()) || expiryDate < collectionDate) { setError("Expiry date cannot be earlier than collection date."); return; }
    const input: InventoryInput = { componentType: String(data.get("componentType")) as BloodComponent, bloodGroup: String(data.get("bloodGroup")) as BloodGroup, rhFactor: String(data.get("rhFactor")) as RhFactor, unitsAvailable: units, unitsReserved: reserved, collectionDate, expiryDate, storageLocation: String(data.get("storageLocation") || "").trim(), status: String(data.get("status")) as InventoryStatus };
    setSaving(true); setError("");
    try { if (existing) { await updateBloodInventory(existing.id, userProfile.organizationId, input); onSaved(existing.id); } else { const ref = await createBloodInventory(userProfile.organizationId, input); onSaved(ref.id); } } catch { setError("We could not save this inventory record."); } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="grid gap-5 rounded-[1rem] border border-border bg-surface p-6 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Component<select required name="componentType" defaultValue={existing?.componentType || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select component</option>{components.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Blood group<select required name="bloodGroup" defaultValue={existing?.bloodGroup || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select blood group</option>{bloodGroups.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">RH factor<select required name="rhFactor" defaultValue={existing?.rhFactor || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select RH factor</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label><label className="grid gap-2 text-sm font-medium">Available units<input required min="1" step="1" type="number" name="unitsAvailable" defaultValue={existing?.unitsAvailable || ""} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Reserved units<input min="0" step="1" type="number" name="unitsReserved" defaultValue={existing?.unitsReserved || 0} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Collection date<input required type="date" name="collectionDate" defaultValue={existing?.collectionDate?.toDate().toISOString().slice(0, 10)} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Expiry date<input required type="date" name="expiryDate" defaultValue={existing?.expiryDate?.toDate().toISOString().slice(0, 10)} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Storage location<input name="storageLocation" defaultValue={existing?.storageLocation || ""} className="h-12 rounded-lg border border-border-strong px-3" placeholder="Cold room / shelf" /></label><label className="grid gap-2 text-sm font-medium">Status<select required name="status" defaultValue={existing?.status || "available"} className="h-12 rounded-lg border border-border-strong bg-surface px-3">{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>{error && <p role="alert" className="sm:col-span-2 text-sm text-danger">{error}</p>}<div className="sm:col-span-2"><button disabled={saving} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : existing ? "Save changes" : "Add blood units"}</button></div></form>;
}

export function InventoryFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ inventoryId?: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [existing, setExisting] = useState<BloodInventory | undefined>();
  const [loading, setLoading] = useState(edit);
  const [error, setError] = useState("");
  useEffect(() => { if (!edit || !params.inventoryId || !userProfile?.organizationId) return; getBloodInventory(params.inventoryId, userProfile.organizationId).then((item) => { if (item) setExisting(item); else setError("This inventory record was not found."); }).catch(() => setError("We could not load this inventory record.")).finally(() => setLoading(false)); }, [edit, params.inventoryId, userProfile?.organizationId]);
  if (loading) return <LoadingState title="Loading inventory record" />;
  if (error) return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><ErrorState title="Inventory unavailable" description={error} /></main>;
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Inventory</p><h1 className="mt-3 text-4xl font-semibold text-foreground">{edit ? "Edit blood units" : "Add blood units"}</h1><p className="mt-4 text-sm leading-6 text-foreground-muted">Only records belonging to your trusted blood-bank organization can be created or edited.</p><div className="mt-8"><InventoryForm existing={existing} onSaved={(id) => { router.push(`/blood-bank/inventory/${id}`); }} /></div></main>;
}

export function InventoryDetailPage() {
  return <InventoryFormPage edit />;
}

export function BloodBankPlaceholder({ title, description }: { title: string; description: string }) {
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Blood-bank workspace</p><h1 className="mt-3 text-4xl font-semibold text-foreground">{title}</h1><div className="mt-8"><EmptyState title="Coming in a future phase" description={description} /></div></main>;
}
