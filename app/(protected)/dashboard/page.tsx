"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/auth";

const workspacePaths: Record<Exclude<AppRole, "pending">, string> = {
  donor: "/donor",
  hospital: "/hospital",
  bloodBank: "/blood-bank",
  administrator: "/admin",
};

function DashboardStatus({
  title,
  description,
  tone = "muted",
}: {
  title: string;
  description: string;
  tone?: "muted" | "warning" | "danger";
}) {
  const toneClasses = {
    muted: "border-border bg-surface-muted text-foreground-muted",
    warning: "border-amber-200 bg-amber-50 text-warning",
    danger: "border-red-200 bg-red-50 text-danger",
  };

  return (
    <section
      className={`mt-8 rounded-[1rem] border p-6 ${toneClasses[tone]}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">{description}</p>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    userProfile,
    loading,
    isAuthenticated,
    profileError,
    role,
  } = useAuth();

  useEffect(() => {
    if (loading || !isAuthenticated || profileError || !userProfile || !role) {
      return;
    }
    if (role === "pending") return;

    router.replace(workspacePaths[role]);
  }, [isAuthenticated, loading, profileError, role, router, userProfile]);

  if (loading || !isAuthenticated) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <p role="status" className="text-sm text-foreground-muted">
          Resolving your secure workspace…
        </p>
      </main>
    );
  }

  if (profileError || !userProfile || !role) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">
          Workspace
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
          Profile unavailable
        </h1>
        <DashboardStatus
          title="Your workspace is not available yet"
          description={`${profileError || "We could not find a profile for this account."} No role workspace has been opened. Refresh to retry the profile check. If your profile remains unavailable, contact support for help. Do not create another account.`}
          tone="danger"
        />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/40"
        >
          Retry profile check
        </button>
      </main>
    );
  }

  if (role !== "pending") {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <p role="status" className="text-sm text-foreground-muted">
          Opening your secure workspace…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">
          Workspace
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
          Access pending
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-foreground-muted">
          Your account is signed in, but no role workspace is enabled for it.
        </p>
      </div>
      <DashboardStatus
        title="Administrator access requires approval"
        description="Your account is pending access approval. Administrator capabilities remain disabled until your role is explicitly approved."
        tone="warning"
      />
    </main>
  );
}
