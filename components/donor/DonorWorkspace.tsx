"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { getDonorProfile, saveDonorProfile, updateDonorAvailability } from "@/lib/donorProfile";
import { DonationHistory } from "./DonationHistory";
import type { BloodGroup, DonorProfile, RhFactor } from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function useDonorProfile() {
  const { firebaseUser } = useAuth();
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!firebaseUser) return;
    getDonorProfile(firebaseUser.uid).then(setProfile).catch(() => setError("We could not load your donor profile.")).finally(() => setLoading(false));
  }, [firebaseUser]);
  return { profile, setProfile, loading, error, setError };
}

export function DonorDashboard() {
  const { userProfile, firebaseUser } = useAuth();
  const { profile, loading, error } = useDonorProfile();
  if (loading) return <LoadingState title="Loading donor workspace" />;
  if (error) return <ErrorState title="Donor profile unavailable" description={error} />;
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor workspace</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">
        Good to see you, {userProfile?.name || firebaseUser?.email}.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">
        Your donor information, eligibility context, and availability in one calm view.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Blood group", profile?.bloodGroup || "Not set"], ["Eligibility", profile?.eligibilityStatus || "Unknown"], ["Last donation", profile?.lastDonationAt ? profile.lastDonationAt.toDate().toLocaleDateString() : "Not recorded"], ["Availability", profile?.availabilityStatus || "Unknown"]].map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-border bg-surface p-5 shadow-xs">
            <p className="text-xs uppercase tracking-[0.14em] text-foreground-subtle">{label}</p>
            <p className="mt-3 text-xl font-semibold capitalize text-primary">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/donor/profile" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Complete profile</Link>
        <Link href="/donor/availability" className="rounded-lg border border-border-strong px-4 py-3 text-sm font-semibold text-primary">Set availability</Link>
        <Link href="/donor/eligibility" className="rounded-lg border border-border-strong px-4 py-3 text-sm font-semibold text-primary">View eligibility</Link>
        <Link href="/donor/opportunities" className="rounded-lg border border-primary px-4 py-3 text-sm font-semibold text-primary">View donation opportunities</Link>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1rem] border border-border bg-surface p-6">
          <h2 className="font-semibold text-foreground">Recent donations</h2>
          <div className="mt-5"><DonationHistory compact /></div>
        </section>
        <section className="rounded-[1rem] border border-border bg-surface p-6">
          <h2 className="font-semibold text-foreground">Donation opportunities</h2>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">Review invitations from verified blood banks and manage your response.</p>
          <Link href="/donor/opportunities" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">Open opportunities</Link>
        </section>
      </div>
    </main>
  );
}

export function DonorProfilePage() {
  const { firebaseUser, userProfile } = useAuth();
  const { profile, setProfile, loading, error, setError } = useDonorProfile();
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  if (loading) return <LoadingState title="Loading donor profile" />;
  if (error) return <ErrorState description={error} />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setSaved(""); setError("");
    try {
      const next = { phone: String(data.get("phone") || "").trim(), bloodGroup: String(data.get("bloodGroup") || "") as BloodGroup, rhFactor: String(data.get("rhFactor") || "") as RhFactor, city: String(data.get("city") || "").trim(), availabilityStatus: String(data.get("availabilityStatus") || "unknown") as DonorProfile["availabilityStatus"], consentToEmergencyContact: data.get("consent") === "on" };
      await saveDonorProfile(firebaseUser.uid, next); setProfile({ ...(profile || { userId: firebaseUser.uid, eligibilityStatus: "unknown", availabilityStatus: "unknown", consentToEmergencyContact: false }), ...next }); setSaved("Your donor profile was saved.");
    } catch { setError("We could not save your donor profile. Please try again."); } finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor profile</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Your information</h1><p className="mt-4 text-sm leading-6 text-foreground-muted">Manage permitted contact and availability details. Verified eligibility and donation records remain read-only.</p><div className="mt-8 grid gap-4 rounded-[1rem] border border-border bg-surface p-6 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Full name</p><p className="mt-2 font-medium text-foreground">{userProfile?.name || "Not recorded"}</p></div><div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Email</p><p className="mt-2 font-medium text-foreground">{userProfile?.email || firebaseUser?.email || "Not recorded"}</p></div></div><form onSubmit={submit} className="mt-5 space-y-5 rounded-[1rem] border border-border bg-surface p-6 shadow-xs"><label className="grid gap-2 text-sm font-medium">Phone<input name="phone" type="tel" defaultValue={profile?.phone || userProfile?.phone || ""} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Blood group<select name="bloodGroup" defaultValue={profile?.bloodGroup || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select blood group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">RH factor<select name="rhFactor" defaultValue={profile?.rhFactor || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select RH factor</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label><label className="grid gap-2 text-sm font-medium">City<input name="city" defaultValue={profile?.city || ""} className="h-12 rounded-lg border border-border-strong px-3" placeholder="Your city" /></label><label className="grid gap-2 text-sm font-medium">Availability<select name="availabilityStatus" defaultValue={profile?.availabilityStatus || "unknown"} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label><label className="flex items-start gap-2 text-sm text-foreground-muted"><input name="consent" type="checkbox" defaultChecked={profile?.consentToEmergencyContact} className="mt-1 accent-primary" />Allow contact for future emergency opportunities.</label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}{saved && <p role="status" className="text-sm text-success">{saved}</p>}<button disabled={saving} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button></form></main>;
}

export function DonorEligibilityPage() { const { profile, loading, error } = useDonorProfile(); if (loading) return <LoadingState />; if (error) return <ErrorState description={error} />; return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Eligibility</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Donation eligibility</h1><div className="mt-8 rounded-[1rem] border border-border bg-surface p-6"><p className="text-sm text-foreground-muted">Current status</p><p className="mt-2 text-2xl font-semibold capitalize text-primary">{profile?.eligibilityStatus || "unknown"}</p><p className="mt-5 text-sm leading-6 text-foreground-muted">Eligibility information will be provided by authorized healthcare or blood-bank staff. HemoLink AI does not infer medical eligibility here.</p></div></main>; }
export function DonorAvailabilityPage() {
  const { firebaseUser } = useAuth();
  const [status, setStatus] = useState<"available" | "unavailable" | "unknown" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let active = true;
    if (!firebaseUser) return () => { active = false; };
    getDonorProfile(firebaseUser.uid)
      .then((profile) => {
        if (active) setStatus(profile?.availabilityStatus || null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Availability could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [firebaseUser]);

  async function changeAvailability(value: "available" | "unavailable") {
    if (!firebaseUser) return;
    setSaving(true);
    setError("");
    setSaved("");
    try {
      await updateDonorAvailability(firebaseUser.uid, value);
      setStatus(value);
      setSaved("Availability saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Availability could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && firebaseUser) return <LoadingState title="Loading availability" />;
  if (!firebaseUser) return <ErrorState title="Sign in required" description="Sign in to manage your donor availability." />;
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Availability</p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">Your availability</h1>
      <p className="mt-4 text-sm text-foreground-muted">Set whether you are open to future opportunities. This does not create or promise a donation request.</p>
      {!status ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-foreground-muted">Complete your donor profile before setting availability.</p>
          <Link href="/donor/profile" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">Complete donor profile</Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-3">
          {(["available", "unavailable"] as const).map((value) => (
            <button key={value} disabled={saving} onClick={() => void changeAvailability(value)} className={`rounded-lg border px-5 py-3 text-sm font-semibold capitalize disabled:opacity-60 ${status === value ? "border-primary bg-soft-rose text-primary" : "border-border-strong bg-surface text-foreground-muted"}`}>
              {saving ? "Saving…" : value}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      {saved && <p role="status" className="mt-4 text-sm text-success">{saved}</p>}
    </main>
  );
}
export function DonorPlaceholder({ title, description }: { title: string; description: string }) { return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor workspace</p><h1 className="mt-3 text-4xl font-semibold text-foreground">{title}</h1><div className="mt-8"><EmptyState title="Coming next" description={description} /></div></main>; }
