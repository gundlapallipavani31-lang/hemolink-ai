"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { formatRole } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";

type ProtectedShellProps = {
  children: ReactNode;
};

function SessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm text-foreground-muted">
        <span className="size-2 animate-pulse-soft rounded-full bg-medical" />
        Resolving your secure workspace…
      </div>
    </main>
  );
}

export function ProtectedShell({ children }: ProtectedShellProps) {
  const router = useRouter();
  const { firebaseUser, userProfile, loading, isAuthenticated, profileError } =
    useAuth();
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) {
    return <SessionLoading />;
  }

  async function handleLogout() {
    setLogoutError("");

    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      setLogoutError("We could not sign you out. Please try again.");
    }
  }

  const displayName =
    userProfile?.name || firebaseUser?.displayName || firebaseUser?.email;
  const displayRole = userProfile?.role
    ? formatRole(userProfile.role)
    : "Profile unavailable";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <a href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="HemoLink AI dashboard">
            <span className="relative flex size-9 items-center justify-center rounded-[0.7rem] bg-primary text-white shadow-xs">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3.8c-2.9 3.5-5.6 6.6-5.6 10.2A5.6 5.6 0 0 0 12 19.6a5.6 5.6 0 0 0 5.6-5.6C17.6 10.4 14.9 7.3 12 3.8Z" />
                <path d="M8.7 14.2a3.3 3.3 0 0 0 3.3 3.3" strokeLinecap="round" />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-medical ring-2 ring-surface" />
            </span>
            <span className="text-base font-semibold tracking-[-0.03em] text-foreground">
              HemoLink <span className="text-medical">AI</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-foreground-subtle">{displayRole}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-[0.65rem] border border-border-strong bg-surface px-3.5 py-2 text-sm font-semibold text-foreground-muted transition hover:border-primary/40 hover:text-primary"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      {logoutError && (
        <p role="alert" className="mx-auto max-w-7xl px-5 pt-4 text-sm text-danger sm:px-8 lg:px-10">
          {logoutError}
        </p>
      )}
      {profileError && (
        <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
          <div role="status" className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
            {profileError}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
