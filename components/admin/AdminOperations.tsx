"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import {
  inventoryDate,
  inventoryEligibilityMessage,
  operationalAvailableUnits,
} from "@/lib/inventoryAvailability";

type MetricSet = Record<string, number>;
type AdminUser = { uid: string; email: string; name: string; role: string; requestedRole?: string | null; organizationId: string | null; status: string; disabled: boolean; createdAt: string | null };
type Organization = { id: string; type: string; name: string; verificationStatus: string; memberCount: number; city?: string; state?: string };
type InventoryRecord = { id: string; bloodBankId?: unknown; bloodGroup?: unknown; rhFactor?: unknown; componentType?: unknown; unitsAvailable?: unknown; unitsReserved?: unknown; status?: unknown; collectionDate?: unknown; expiryDate?: unknown };

async function adminFetch<T>(path: string, user: { getIdToken: () => Promise<string> }) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Admin data could not be loaded.");
  return body as T;
}

const readable = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const displayValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "Not recorded";
const inventoryDateLabel = (value: unknown) => {
  const date = inventoryDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : "Not recorded";
};

export function AdminDashboardOverview() {
  const { firebaseUser } = useAuth();
  const [metrics, setMetrics] = useState<MetricSet | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; action: string; entityType: string; createdAt: string | null }>>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!firebaseUser) return; adminFetch<{ metrics: MetricSet; activity: typeof activity }>("/api/admin/overview", firebaseUser).then((data) => { setMetrics(data.metrics); setActivity(data.activity); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Dashboard unavailable.")); }, [firebaseUser]);
  if (error) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><ErrorState title="Admin dashboard unavailable" description={error} /></main>;
  if (!metrics) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><LoadingState title="Loading operational command center" /></main>;
  const cards: Array<[string, string]> = [["Total donors", "donors"], ["Hospitals", "hospitals"], ["Blood banks", "bloodBanks"], ["Usable available units", "availableUnits"], ["Pending requests", "pendingRequests"], ["Emergency requests", "emergencyRequests"], ["Approved requests", "approvedRequests"], ["Rejected requests", "rejectedRequests"], ["Usable lots expiring within 30 days", "expiringInventory"]];
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Operational command center</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Admin overview</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Live operational signals from authenticated Firebase-backed records.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, key]) => <div key={key} className="rounded-[1rem] border border-border bg-surface p-5 shadow-xs"><p className="text-xs uppercase tracking-[0.14em] text-foreground-subtle">{title}</p><p className="mt-3 text-2xl font-semibold text-primary">{metrics[key]}</p></div>)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-[1rem] border border-border bg-surface p-6"><div className="flex items-center justify-between"><h2 className="font-semibold text-foreground">Quick operations</h2><Link href="/admin/requests" className="text-sm font-semibold text-primary">Review requests</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Link href="/admin/users" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Users</Link><Link href="/admin/donors" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Donors</Link><Link href="/admin/organizations" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Organizations</Link><Link href="/admin/inventory" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Inventory oversight</Link></div></section><section className="rounded-[1rem] border border-border bg-surface p-6"><h2 className="font-semibold text-foreground">Recent operational activity</h2>{activity.length === 0 ? <div className="mt-5"><EmptyState title="No administrative activity yet" description="Audit events will appear here as operations are recorded." /></div> : <ul className="mt-4 space-y-3">{activity.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 text-sm"><span className="font-medium text-foreground">{item.action}</span><span className="text-foreground-muted">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Pending timestamp"}</span></li>)}</ul>}</section></div></main>;
}

export function AdminUsersPage() {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [savingUid, setSavingUid] = useState("");
  useEffect(() => { if (!firebaseUser) return; adminFetch<{ users: AdminUser[] }>("/api/admin/users", firebaseUser).then((data) => setUsers(data.users)).catch((reason) => setError(reason instanceof Error ? reason.message : "Users unavailable.")); }, [firebaseUser]);
  const filtered = users.filter((user) => (!role || user.role === role) && `${user.email} ${user.name} ${user.uid}`.toLowerCase().includes(search.toLowerCase()));
  async function toggleAccess(user: AdminUser) {
    if (!firebaseUser) return;
    setSavingUid(user.uid); setError("");
    try {
      const response = await fetch("/api/admin/users/" + user.uid, { method: "PATCH", headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ disabled: !user.disabled }) });
      if (!response.ok) throw new Error((await response.json()).error || "Access update failed.");
      setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, disabled: !user.disabled, status: user.disabled ? "active" : "disabled" } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Access update failed."); } finally { setSavingUid(""); }
  }
  if (error) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>;
  if (!firebaseUser) return <LoadingState />;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">User management</h1><div className="mt-8 flex flex-wrap gap-3 rounded-[1rem] border border-border bg-surface p-5"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or UID" className="h-11 min-w-64 rounded-lg border border-border-strong px-3 text-sm" /><select value={role} onChange={(event) => setRole(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All roles</option>{["donor", "hospital", "bloodBank", "administrator", "pending"].map((item) => <option key={item}>{item}</option>)}</select></div>{error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}{filtered.length === 0 ? <div className="mt-5"><EmptyState title="No users found" description="User records will appear here when available." /></div> : <div className="mt-5 overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Organization</th><th className="px-5 py-4">Access</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((user) => <tr key={user.uid}><td className="px-5 py-4"><p className="font-semibold text-foreground">{user.name || "Unnamed user"}</p><p className="text-foreground-muted">{user.email || user.uid}</p></td><td className="px-5 py-4 capitalize">{readable(user.role)}{user.requestedRole && user.requestedRole !== user.role && <span className="mt-1 block text-xs text-warning">Requested: {user.requestedRole}</span>}</td><td className="px-5 py-4 text-foreground-muted">{user.organizationId || "Not assigned"}</td><td className="px-5 py-4">{user.disabled ? <span className="text-danger">Disabled</span> : <span className="text-success">Active</span>}</td><td className="px-5 py-4 text-foreground-muted">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td><td className="px-5 py-4"><button disabled={savingUid === user.uid} onClick={() => toggleAccess(user)} className="rounded-lg border border-border-strong px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60">{savingUid === user.uid ? "Saving…" : user.disabled ? "Enable" : "Disable"}</button></td></tr>)}</tbody></table></div>}</main>;
}

export function AdminOrganizationsPage() {
  const { firebaseUser } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!firebaseUser) return; adminFetch<{ organizations: Organization[] }>("/api/admin/organizations", firebaseUser).then((data) => setOrganizations(data.organizations)).catch((reason) => setError(reason instanceof Error ? reason.message : "Organizations unavailable.")); }, [firebaseUser]);
  if (error) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Organizations</h1>{organizations.length === 0 ? <div className="mt-8"><EmptyState title="No organizations found" description="Hospitals and blood banks will appear here after trusted setup." /></div> : <div className="mt-8 grid gap-4 md:grid-cols-2">{organizations.map((organization) => <article key={organization.id} className="rounded-[1rem] border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{organization.name}</h2><p className="mt-1 text-sm capitalize text-foreground-muted">{readable(organization.type)}</p></div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold capitalize">{organization.verificationStatus}</span></div><p className="mt-4 text-sm text-foreground-muted">{organization.city || "Location not set"}{organization.state ? `, ${organization.state}` : ""}</p><p className="mt-2 text-sm text-foreground-muted">{organization.memberCount} member records</p></article>)}</div>}</main>;
}

export function AdminInventoryPage() {
  const { firebaseUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!firebaseUser) return; adminFetch<{ inventory: InventoryRecord[] }>("/api/admin/inventory", firebaseUser).then((data) => setInventory(data.inventory)).catch((reason) => setError(reason instanceof Error ? reason.message : "Inventory unavailable.")); }, [firebaseUser]);
  if (error) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Inventory oversight</h1>{inventory.length === 0 ? <div className="mt-8"><EmptyState title="No inventory recorded yet" description="Blood-bank inventory records will appear here when available." /></div> : <div className="mt-8 overflow-x-auto rounded-[1rem] border border-border bg-surface"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Organization</th><th className="px-5 py-4">Blood</th><th className="px-5 py-4">Component</th><th className="px-5 py-4">Usable / recorded</th><th className="px-5 py-4">Reserved</th><th className="px-5 py-4">Expiry</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Eligibility</th></tr></thead><tbody className="divide-y divide-border">{inventory.map((item) => { const status = displayValue(item.status); return <tr key={item.id}><td className="px-5 py-4 text-foreground-muted">{displayValue(item.bloodBankId)}</td><td className="px-5 py-4 font-semibold">{displayValue(item.bloodGroup)} <span className="text-xs font-normal text-foreground-muted">({displayValue(item.rhFactor)})</span></td><td className="px-5 py-4">{readable(displayValue(item.componentType))}</td><td className="px-5 py-4"><span className="font-semibold">{operationalAvailableUnits(item)} usable</span><span className="mt-1 block text-xs text-foreground-muted">{displayValue(item.unitsAvailable)} recorded available</span></td><td className="px-5 py-4">{displayValue(item.unitsReserved)}</td><td className="px-5 py-4 text-foreground-muted">{inventoryDateLabel(item.expiryDate)}</td><td className="px-5 py-4 capitalize">{readable(status)}</td><td className="px-5 py-4 text-xs text-foreground-muted">{inventoryEligibilityMessage(item)}</td></tr>; })}</tbody></table></div>}</main>;
}
