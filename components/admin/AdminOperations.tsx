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
type OnboardingRequest = {
  id: string;
  type: "hospital" | "bloodBank";
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city: string;
  state?: string;
  country?: string;
  status: "pending" | "approved" | "rejected";
  organizationId?: string;
  rejectionReason?: string;
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy?: string;
  decidedByName?: string;
};
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
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Operational command center</p><h1 className="mt-3 text-4xl font-semibold tracking-tighter text-foreground">Admin overview</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Live operational signals from authenticated Firebase-backed records.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, key]) => <div key={key} className="rounded-2xl border border-border bg-surface p-5 shadow-xs"><p className="text-xs uppercase tracking-[0.14em] text-foreground-subtle">{title}</p><p className="mt-3 text-2xl font-semibold text-primary">{metrics[key]}</p></div>)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-2xl border border-border bg-surface p-6"><div className="flex items-center justify-between"><h2 className="font-semibold text-foreground">Quick operations</h2><Link href="/admin/requests" className="text-sm font-semibold text-primary">Review requests</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Link href="/admin/users" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Users</Link><Link href="/admin/donors" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Donors</Link><Link href="/admin/organizations" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Organizations</Link><Link href="/admin/inventory" className="rounded-lg border border-border-strong p-4 text-sm font-semibold text-foreground hover:border-primary">Inventory oversight</Link></div></section><section className="rounded-2xl border border-border bg-surface p-6"><h2 className="font-semibold text-foreground">Recent operational activity</h2>{activity.length === 0 ? <div className="mt-5"><EmptyState title="No administrative activity yet" description="Audit events will appear here as operations are recorded." /></div> : <ul className="mt-4 space-y-3">{activity.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 text-sm"><span className="font-medium text-foreground">{item.action}</span><span className="text-foreground-muted">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Pending timestamp"}</span></li>)}</ul>}</section></div></main>;
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
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">User management</h1><div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-border bg-surface p-5"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or UID" className="h-11 min-w-64 rounded-lg border border-border-strong px-3 text-sm" /><select value={role} onChange={(event) => setRole(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm"><option value="">All roles</option>{["donor", "hospital", "bloodBank", "administrator", "pending"].map((item) => <option key={item}>{item}</option>)}</select></div>{error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}{filtered.length === 0 ? <div className="mt-5"><EmptyState title="No users found" description="User records will appear here when available." /></div> : <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full min-w-245 text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Organization</th><th className="px-5 py-4">Access</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((user) => <tr key={user.uid}><td className="px-5 py-4"><p className="font-semibold text-foreground">{user.name || "Unnamed user"}</p><p className="text-foreground-muted">{user.email || user.uid}</p></td><td className="px-5 py-4 capitalize">{readable(user.role)}{user.requestedRole && user.requestedRole !== user.role && <span className="mt-1 block text-xs text-warning">Requested: {user.requestedRole}</span>}</td><td className="px-5 py-4 text-foreground-muted">{user.organizationId || "Not assigned"}</td><td className="px-5 py-4">{user.disabled ? <span className="text-danger">Disabled</span> : <span className="text-success">Active</span>}</td><td className="px-5 py-4 text-foreground-muted">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td><td className="px-5 py-4"><button disabled={savingUid === user.uid} onClick={() => toggleAccess(user)} className="rounded-lg border border-border-strong px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60">{savingUid === user.uid ? "Saving…" : user.disabled ? "Enable" : "Disable"}</button></td></tr>)}</tbody></table></div>}</main>;
}

export function AdminOrganizationsPage() {
  const { firebaseUser } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  useEffect(() => {
    if (!firebaseUser) return;
    Promise.all([
      adminFetch<{ organizations: Organization[] }>("/api/admin/organizations", firebaseUser),
      adminFetch<{ requests: OnboardingRequest[] }>("/api/admin/organizations/requests", firebaseUser),
    ]).then(([organizationData, requestData]) => {
      setOrganizations(organizationData.organizations);
      setRequests(requestData.requests);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Organization data unavailable."));
  }, [firebaseUser]);

  async function decide(item: OnboardingRequest, action: "approve" | "reject") {
    if (!firebaseUser) return;
    const rejectionReason = reasons[item.id]?.trim() || "";
    if (action === "reject" && rejectionReason.length < 5) {
      setError("Enter a rejection reason of at least 5 characters.");
      return;
    }
    setSavingId(item.id);
    setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/organizations/requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: item.id, action, ...(action === "reject" ? { rejectionReason } : {}) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Organization decision could not be saved.");
      const updated = await adminFetch<{ requests: OnboardingRequest[] }>("/api/admin/organizations/requests", firebaseUser);
      setRequests(updated.requests);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Organization decision could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  const filteredRequests = requests.filter((item) =>
    (!typeFilter || item.type === typeFilter)
    && (!statusFilter || item.status === statusFilter),
  );
  if (error) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>;
  if (!firebaseUser) return <LoadingState />;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Organizations</h1>
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-2xl font-semibold text-foreground">Verification requests</h2><p className="mt-1 text-sm text-foreground-muted">Review organization details before enabling operational access.</p></div>
          <div className="flex gap-3">
            <label className="grid gap-1 text-xs font-medium text-foreground-muted">Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground"><option value="">All types</option><option value="hospital">Hospital</option><option value="bloodBank">Blood bank</option></select></label>
            <label className="grid gap-1 text-xs font-medium text-foreground-muted">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
          </div>
        </div>
        {filteredRequests.length === 0 ? <div className="mt-5"><EmptyState title="No requests match these filters" description="New hospital and blood-bank verification requests will appear here." /></div> : (
          <div className="mt-5 grid gap-4">
            {filteredRequests.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{readable(item.type)} · {item.status}</p><h3 className="mt-1 text-lg font-semibold text-foreground">{item.name}</h3><p className="text-sm text-foreground-muted">{item.legalName || "Legal name not provided"} · {item.city}{item.state ? `, ${item.state}` : ""}</p></div>
                  <p className="text-xs text-foreground-muted">Submitted {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</p>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-foreground-muted sm:grid-cols-2">
                  <p><span className="font-medium text-foreground">Requester:</span> {item.requesterName} ({item.requesterUserId})</p>
                  <p><span className="font-medium text-foreground">Account contact:</span> {item.requesterEmail || item.requesterPhone || "Not provided"}</p>
                  <p><span className="font-medium text-foreground">Organization contact:</span> {item.email || "—"} · {item.phone || "—"}</p>
                  <p><span className="font-medium text-foreground">Address:</span> {[item.address, item.city, item.state, item.country].filter(Boolean).join(", ") || "—"}</p>
                  {item.registrationNumber && <p><span className="font-medium text-foreground">Registration:</span> {item.registrationNumber}</p>}
                </div>
                {item.status === "pending" ? (
                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                    <label className="grid flex-1 gap-1 text-xs font-medium text-foreground-muted">Rejection reason (required to reject)<textarea value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={2} className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground" /></label>
                    <div className="flex gap-2"><button disabled={savingId === item.id} onClick={() => void decide(item, "approve")} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{savingId === item.id ? "Saving…" : "Approve"}</button><button disabled={savingId === item.id || (reasons[item.id]?.trim().length || 0) < 5} onClick={() => void decide(item, "reject")} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-danger disabled:opacity-50">Reject</button></div>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-border pt-4 text-xs text-foreground-muted">
                    Decided {item.decidedAt ? new Date(item.decidedAt).toLocaleString() : "—"} by {item.decidedByName || item.decidedBy || "administrator"}
                    {item.organizationId ? ` · Organization ${item.organizationId}` : ""}
                    {item.rejectionReason ? ` · Reason: ${item.rejectionReason}` : ""}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-foreground">Verified organizations</h2>
        {organizations.length === 0 ? <div className="mt-5"><EmptyState title="No organizations found" description="Hospitals and blood banks will appear here after verification." /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{organizations.map((organization) => <article key={organization.id} className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-foreground">{organization.name}</h3><p className="mt-1 text-sm capitalize text-foreground-muted">{readable(organization.type)}</p></div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold capitalize">{organization.verificationStatus}</span></div><p className="mt-4 text-sm text-foreground-muted">{organization.city || "Location not set"}{organization.state ? `, ${organization.state}` : ""}</p><p className="mt-2 text-sm text-foreground-muted">{organization.memberCount} member records</p></article>)}</div>}
      </section>
    </main>
  );
}

export function AdminInventoryPage() {
  const { firebaseUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!firebaseUser) return; adminFetch<{ inventory: InventoryRecord[] }>("/api/admin/inventory", firebaseUser).then((data) => setInventory(data.inventory)).catch((reason) => setError(reason instanceof Error ? reason.message : "Inventory unavailable.")); }, [firebaseUser]);
  if (error) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><ErrorState description={error} /></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Administration</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Inventory oversight</h1>{inventory.length === 0 ? <div className="mt-8"><EmptyState title="No inventory recorded yet" description="Blood-bank inventory records will appear here when available." /></div> : <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full min-w-275 text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-[0.12em] text-foreground-subtle"><tr><th className="px-5 py-4">Organization</th><th className="px-5 py-4">Blood</th><th className="px-5 py-4">Component</th><th className="px-5 py-4">Usable / recorded</th><th className="px-5 py-4">Reserved</th><th className="px-5 py-4">Expiry</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Eligibility</th></tr></thead><tbody className="divide-y divide-border">{inventory.map((item) => { const status = displayValue(item.status); return <tr key={item.id}><td className="px-5 py-4 text-foreground-muted">{displayValue(item.bloodBankId)}</td><td className="px-5 py-4 font-semibold">{displayValue(item.bloodGroup)} <span className="text-xs font-normal text-foreground-muted">({displayValue(item.rhFactor)})</span></td><td className="px-5 py-4">{readable(displayValue(item.componentType))}</td><td className="px-5 py-4"><span className="font-semibold">{operationalAvailableUnits(item)} usable</span><span className="mt-1 block text-xs text-foreground-muted">{displayValue(item.unitsAvailable)} recorded available</span></td><td className="px-5 py-4">{displayValue(item.unitsReserved)}</td><td className="px-5 py-4 text-foreground-muted">{inventoryDateLabel(item.expiryDate)}</td><td className="px-5 py-4 capitalize">{readable(status)}</td><td className="px-5 py-4 text-xs text-foreground-muted">{inventoryEligibilityMessage(item)}</td></tr>; })}</tbody></table></div>}</main>;
}
