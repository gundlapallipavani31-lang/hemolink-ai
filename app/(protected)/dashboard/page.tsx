"use client";

import { formatRole } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { firebaseUser, userProfile, profileError, role } = useAuth();
  const name =
    userProfile?.name || firebaseUser?.displayName || firebaseUser?.email;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">
          Workspace
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
          Workspace ready, {name}.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-foreground-muted">
          Your secure HemoLink AI session is active. The role-specific workspace
          will be introduced in the next product phase.
        </p>
      </div>
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1rem] border border-border bg-surface p-6 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle">
            Current role
          </p>
          <p className="mt-3 text-2xl font-semibold text-primary">
            {role ? formatRole(role) : "Profile unavailable"}
          </p>
          {role === "pending" && (
            <p className="mt-3 text-sm leading-6 text-warning">
              Your requested administrator access is under review. No
              administrator capabilities are enabled.
            </p>
          )}
        </div>
        <div className="rounded-[1rem] border border-border bg-surface p-6 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle">
            Session status
          </p>
          <p className="mt-3 flex items-center gap-2 text-2xl font-semibold text-success">
            <span className="size-2 rounded-full bg-success" />
            Authenticated
          </p>
          {profileError && (
            <p className="mt-3 text-sm leading-6 text-foreground-muted">
              Profile details will appear once your user profile is available.
            </p>
          )}
        </div>
      </section>
      <div className="mt-8 rounded-[1rem] border border-dashed border-border-strong bg-surface-muted p-6">
        <p className="text-sm font-semibold text-foreground">
          Role-specific workspace coming next
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
          This protected placeholder confirms that authentication and session
          loading are working. Operational modules are intentionally not
          available yet.
        </p>
      </div>
    </main>
  );
}
