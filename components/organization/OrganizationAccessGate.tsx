"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { OrganizationType } from "@/types/domain";
import { OrganizationOnboarding } from "./OrganizationOnboarding";

export function OrganizationAccessGate({
  type,
  children,
}: {
  type: OrganizationType;
  children: ReactNode;
}) {
  const { firebaseUser } = useAuth();
  const [access, setAccess] = useState<boolean | null>(null);
  const markAccessReady = useCallback(() => setAccess(true), []);

  useEffect(() => {
    let active = true;
    if (!firebaseUser) return () => { active = false; };
    void (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch("/api/organization/onboarding", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = await response.json() as { operationalAccess?: boolean };
        if (active) setAccess(response.ok && result.operationalAccess === true);
      } catch {
        if (active) setAccess(false);
      }
    })();
    return () => { active = false; };
  }, [firebaseUser]);

  if (!firebaseUser) return <OrganizationOnboarding type={type} />;
  if (access === null) {
    return <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-border bg-surface p-6 text-sm text-foreground-muted">Verifying organization access…</div>;
  }
  return access ? children : <OrganizationOnboarding type={type} onAccessReady={markAccessReady} />;
}
