"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { OrganizationRequest, OrganizationType } from "@/types/domain";

type OnboardingResponse = {
  request: (OrganizationRequest & {
    createdAt: string | null;
    updatedAt: string | null;
    decidedAt: string | null;
  }) | null;
  organization: Record<string, unknown> | null;
  operationalAccess: boolean;
};

const typeLabels: Record<OrganizationType, string> = {
  hospital: "Hospital",
  bloodBank: "Blood bank",
};

export function OrganizationOnboarding({
  type,
  onAccessReady,
}: {
  type: OrganizationType;
  onAccessReady?: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<OnboardingResponse | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    if (!firebaseUser) throw new Error("Sign in to manage organization verification.");
    const token = await firebaseUser.getIdToken();
    const response = await fetch("/api/organization/onboarding", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json() as OnboardingResponse & { error?: string };
    if (!response.ok) throw new Error(result.error || "Onboarding status could not be loaded.");
    return result;
  }, [firebaseUser]);

  useEffect(() => {
    let active = true;
    if (!firebaseUser) return () => { active = false; };
    void (async () => {
      try {
        const result = await loadStatus();
        if (!active) return;
        setError("");
        setData(result);
        if (result.operationalAccess) onAccessReady?.();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Onboarding status could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [firebaseUser, loadStatus, onAccessReady]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setSaving(true);
    setError("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/organization/onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...values, type }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Organization request could not be submitted.");
      form.reset();
      const onboarding = await loadStatus();
      setData(onboarding);
      setError("");
      if (onboarding.operationalAccess) onAccessReady?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Organization request could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  const request = data?.request;
  const canSubmit = !data?.operationalAccess && request?.status !== "pending";
  const title = typeLabels[type];

  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Organization verification</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{title} onboarding</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          Submit your organization details for administrator review. Operational access becomes available after verification.
        </p>
      </div>

      {!firebaseUser ? (
        <p className="mt-6 text-sm text-foreground-muted">Sign in to manage organization verification.</p>
      ) : loading ? (
        <p className="mt-6 text-sm text-foreground-muted">Loading your verification status…</p>
      ) : (
        <>
          {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</p>}
          {data?.operationalAccess && data.organization ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="font-semibold text-success">Verified — operational access ready</p>
              <p className="mt-2 text-sm text-foreground">{String(data.organization.name || title)}</p>
              <p className="text-sm text-foreground-muted">
                {[data.organization.city, data.organization.state, data.organization.country]
                  .filter((value): value is string => typeof value === "string" && Boolean(value))
                  .join(", ")}
              </p>
            </div>
          ) : request?.status === "pending" ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-warning">Verification pending</p>
              <p className="mt-2 text-sm text-foreground">{request.name} · {request.city}</p>
              <p className="mt-1 text-sm text-foreground-muted">Submitted {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "recently"}</p>
            </div>
          ) : request?.status === "rejected" ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-danger">Rejected — action required</p>
              <p className="mt-2 text-sm text-foreground">{request.rejectionReason || "Please update your organization details and resubmit."}</p>
              {request.decidedAt && <p className="mt-1 text-xs text-foreground-muted">Reviewed {new Date(request.decidedAt).toLocaleDateString()}</p>}
            </div>
          ) : null}

          {canSubmit && (
            <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Organization name
                <input name="name" required maxLength={160} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Legal name
                <input name="legalName" maxLength={200} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Registration number
                <input name="registrationNumber" maxLength={120} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                City
                <input name="city" required maxLength={100} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Contact email
                <input name="email" type="email" maxLength={254} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Contact phone
                <input name="phone" type="tel" maxLength={40} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Street address
                <input name="address" maxLength={250} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                State or region
                <input name="state" maxLength={100} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Country
                <input name="country" maxLength={100} className="h-11 rounded-lg border border-border-strong bg-surface px-3" />
              </label>
              <div className="sm:col-span-2">
                <button disabled={saving} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? "Submitting…" : request?.status === "rejected" ? "Resubmit for verification" : "Submit for verification"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
