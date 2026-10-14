"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import { getDonorProfile, saveDonorProfile, updateDonorAvailability } from "@/lib/donorProfile";
import { DonationHistory } from "./DonationHistory";
import type { BloodGroup, DonorProfile, RhFactor } from "@/types/domain";

const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function getDonorProfileErrorMessage(error: unknown, operation: "load" | "save") {
  const code =
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && /^[a-z0-9/_-]+$/i.test(error.code)
      ? error.code
      : "unknown";

  if (code.endsWith("permission-denied")) {
    return `Donor profile ${operation === "load" ? "access" : "update"} was denied (Firebase code: ${code}). If your account is active, contact support and share this code.`;
  }
  if (code.endsWith("unavailable")) {
    return `The donor profile service is temporarily unavailable (Firebase code: ${code}). Try again shortly.`;
  }
  return `We could not ${operation === "load" ? "load" : "save"} your donor profile (Firebase code: ${code}). Try again, and contact support if the issue continues.`;
}

function useDonorProfile() {
  const { firebaseUser } = useAuth();
  const [loaded, setLoaded] = useState<{
    uid: string;
    profile: DonorProfile | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (!firebaseUser) return () => { active = false; };
    getDonorProfile(firebaseUser.uid)
      .then((nextProfile) => {
        if (active) {
          setLoaded({ uid: firebaseUser.uid, profile: nextProfile, error: "" });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoaded({
            uid: firebaseUser.uid,
            profile: null,
            error: getDonorProfileErrorMessage(reason, "load"),
          });
        }
      });
    return () => { active = false; };
  }, [firebaseUser]);

  const current = loaded?.uid === firebaseUser?.uid ? loaded : null;
  const setProfile = (profile: DonorProfile | null) => {
    if (firebaseUser) setLoaded({ uid: firebaseUser.uid, profile, error: "" });
  };

  return {
    profile: current?.profile ?? null,
    setProfile,
    loading: Boolean(firebaseUser) && current === null,
    error: current?.error ?? "",
  };
}

export function DonorDashboard() {
  const { userProfile, firebaseUser } = useAuth();
  const { profile, loading, error } = useDonorProfile();
  if (loading) return <LoadingState title="Loading donor workspace" />;
  if (error) return <ErrorState title="Donor profile unavailable" description={error} />;
  const missingProfileDetails = [
    !profile?.bloodGroup && "blood group",
    !profile?.rhFactor && "RH factor",
    !profile?.phone && !userProfile?.phone && "phone number",
    !profile?.city && "city",
  ].filter((detail): detail is string => Boolean(detail));
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
      {missingProfileDetails.length > 0 && (
        <section
          aria-labelledby="donor-profile-completion-title"
          className="mt-6 flex flex-col gap-4 rounded-xl border border-primary/20 bg-soft-rose p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 id="donor-profile-completion-title" className="font-semibold text-foreground">
              Complete your profile
            </h2>
            <p className="mt-1 text-sm leading-6 text-foreground-muted">
              Add your {missingProfileDetails.join(", ")} to finish setting up your donor details.
            </p>
          </div>
          <Link
            href="/donor/profile"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Complete your profile
          </Link>
        </section>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/donor/profile" className="rounded-lg border border-border-strong px-4 py-3 text-sm font-semibold text-primary">{missingProfileDetails.length ? "Edit profile" : "My profile"}</Link>
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
  const { profile, setProfile, loading, error } = useDonorProfile();
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  if (loading) return <LoadingState title="Loading donor profile" />;
  if (error) return <ErrorState description={error} />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setSaved(""); setSaveError("");
    try {
      const next = { phone: String(data.get("phone") || "").trim(), bloodGroup: String(data.get("bloodGroup") || "") as BloodGroup, rhFactor: String(data.get("rhFactor") || "") as RhFactor, city: String(data.get("city") || "").trim(), availabilityStatus: String(data.get("availabilityStatus") || "unknown") as DonorProfile["availabilityStatus"], consentToEmergencyContact: data.get("consent") === "on" };
      await saveDonorProfile(firebaseUser.uid, next); setProfile({ ...(profile || { userId: firebaseUser.uid, eligibilityStatus: "unknown", availabilityStatus: "unknown", consentToEmergencyContact: false }), ...next }); setSaved("Your donor profile was saved.");
    } catch (reason: unknown) {
      setSaveError(getDonorProfileErrorMessage(reason, "save"));
    } finally {
      setSaving(false);
    }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor profile</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Your information</h1><p className="mt-4 text-sm leading-6 text-foreground-muted">Manage permitted contact and availability details. Verified eligibility and donation records remain read-only.</p>{!profile && <p role="status" className="mt-5 rounded-lg border border-border bg-surface p-4 text-sm text-foreground-muted">Your donor profile has not been set up yet. Complete the details below and save to create it.</p>}<div className="mt-8 grid gap-4 rounded-[1rem] border border-border bg-surface p-6 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Full name</p><p className="mt-2 font-medium text-foreground">{userProfile?.name || "Not recorded"}</p></div><div><p className="text-xs uppercase tracking-[0.12em] text-foreground-subtle">Email</p><p className="mt-2 font-medium text-foreground">{userProfile?.email || firebaseUser?.email || "Not recorded"}</p></div></div><form onSubmit={submit} className="mt-5 space-y-5 rounded-[1rem] border border-border bg-surface p-6 shadow-xs"><label className="grid gap-2 text-sm font-medium">Phone<input name="phone" type="tel" defaultValue={profile?.phone || userProfile?.phone || ""} className="h-12 rounded-lg border border-border-strong px-3" /></label><label className="grid gap-2 text-sm font-medium">Blood group<select name="bloodGroup" defaultValue={profile?.bloodGroup || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select blood group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">RH factor<select name="rhFactor" defaultValue={profile?.rhFactor || ""} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="">Select RH factor</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label><label className="grid gap-2 text-sm font-medium">City<input name="city" defaultValue={profile?.city || ""} className="h-12 rounded-lg border border-border-strong px-3" placeholder="Your city" /></label><label className="grid gap-2 text-sm font-medium">Availability<select name="availabilityStatus" defaultValue={profile?.availabilityStatus || "unknown"} className="h-12 rounded-lg border border-border-strong bg-surface px-3"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label><label className="flex items-start gap-2 text-sm text-foreground-muted"><input name="consent" type="checkbox" defaultChecked={profile?.consentToEmergencyContact} className="mt-1 accent-primary" />Allow contact for future emergency opportunities.</label>{saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}{saved && <p role="status" className="text-sm text-success">{saved}</p>}<button disabled={saving} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button></form></main>;
}

export function DonorEligibilityPage() { const { profile, loading, error } = useDonorProfile(); if (loading) return <LoadingState />; if (error) return <ErrorState title="Eligibility unavailable" description={error} />; return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Eligibility</p><h1 className="mt-3 text-4xl font-semibold text-foreground">Donation eligibility</h1>{!profile && <p role="status" className="mt-5 rounded-lg border border-border bg-surface p-4 text-sm text-foreground-muted">Your donor profile has not been set up yet. Add your information in <Link href="/donor/profile" className="font-semibold text-primary underline">your donor profile</Link>.</p>}<div className="mt-8 rounded-[1rem] border border-border bg-surface p-6"><p className="text-sm text-foreground-muted">Current status</p><p className="mt-2 text-2xl font-semibold capitalize text-primary">{profile?.eligibilityStatus || "unknown"}</p><p className="mt-5 text-sm leading-6 text-foreground-muted">Eligibility information will be provided by authorized healthcare or blood-bank staff. HemoLink AI does not infer medical eligibility here.</p></div></main>; }
export function DonorAvailabilityPage() {
  const { firebaseUser } = useAuth();
  const [loaded, setLoaded] = useState<{
    uid: string;
    status: "available" | "unavailable" | "unknown" | null;
    error: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let active = true;
    if (!firebaseUser) return () => { active = false; };
    getDonorProfile(firebaseUser.uid)
      .then((profile) => {
        if (active) {
          setLoaded({
            uid: firebaseUser.uid,
            status: profile?.availabilityStatus || null,
            error: "",
          });
        }
      })
      .catch((reason) => {
        if (active) {
          setLoaded({
            uid: firebaseUser.uid,
            status: null,
            error: getDonorProfileErrorMessage(reason, "load"),
          });
        }
      });
    return () => { active = false; };
  }, [firebaseUser]);

  const current = loaded?.uid === firebaseUser?.uid ? loaded : null;
  const status = current?.status ?? null;
  const error = current?.error ?? "";
  const loading = Boolean(firebaseUser) && current === null;

  async function changeAvailability(value: "available" | "unavailable") {
    if (!firebaseUser) return;
    setSaving(true);
    setLoaded((previous) => ({
      uid: firebaseUser.uid,
      status: previous?.uid === firebaseUser.uid ? previous.status : null,
      error: "",
    }));
    setSaved("");
    try {
      await updateDonorAvailability(firebaseUser.uid, value);
      setLoaded({ uid: firebaseUser.uid, status: value, error: "" });
      setSaved("Availability saved.");
    } catch (reason) {
      setLoaded((previous) => ({
        uid: firebaseUser.uid,
        status: previous?.uid === firebaseUser.uid ? previous.status : null,
        error: getDonorProfileErrorMessage(reason, "save"),
      }));
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
      {error ? null : !status ? (
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
