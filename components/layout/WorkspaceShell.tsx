"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { formatRole } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";

type WorkspaceShellProps = {
  kind: "donor" | "hospital" | "bloodBank" | "administrator";
  children: ReactNode;
};

const links = {
  donor: [
    ["Overview", "/donor"],
    ["Profile", "/donor/profile"],
    ["Eligibility", "/donor/eligibility"],
    ["Availability", "/donor/availability"],
    ["Donations", "/donor/donations"],
    ["Opportunities", "/donor/opportunities"],
  ],
  hospital: [
    ["Overview", "/hospital"],
    ["Find Blood", "/find-blood"],
    ["Profile", "/hospital/profile"],
    ["Patients", "/hospital/patients"],
    ["Availability", "/hospital/availability"],
    ["Requests", "/hospital/requests"],
    ["Team", "/hospital/team"],
  ],
  bloodBank: [
    ["Overview", "/blood-bank"],
    ["Profile", "/blood-bank/profile"],
    ["Inventory", "/blood-bank/inventory"],
    ["Donor opportunities", "/blood-bank/opportunities"],
    ["Requests", "/blood-bank/requests"],
    ["Distribution", "/blood-bank/distribution"],
    ["Team", "/blood-bank/team"],
  ],
  administrator: [
    ["Overview", "/admin"],
    ["Requests", "/admin/requests"],
    ["Patient intakes", "/admin/requests/intakes"],
    ["Users", "/admin/users"],
    ["Donors", "/admin/donors"],
    ["Organizations", "/admin/organizations"],
    ["Inventory", "/admin/inventory"],
    ["AI intelligence", "/admin/ai"],
  ],
} as const;

const workspacePaths = {
  donor: "/donor",
  hospital: "/hospital",
  bloodBank: "/blood-bank",
  administrator: "/admin",
} as const;

const profilePaths = {
  donor: "/donor/profile",
  hospital: "/hospital/profile",
  bloodBank: "/blood-bank/profile",
  administrator: "/admin/profile",
} as const;

export function WorkspaceShell({ kind, children }: WorkspaceShellProps) {
  const router = useRouter();
  const {
    userProfile,
    firebaseUser,
    loading,
    isAuthenticated,
    signingOut,
    signOutCurrentUser,
  } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const name =
    userProfile?.name ||
    firebaseUser?.displayName ||
    firebaseUser?.email ||
    "Workspace user";
  const role = userProfile?.role ? formatRole(userProfile.role) : formatRole(kind);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, loading, router]);

  async function handleSignOut() {
    if (signingOut) return;
    setSignOutError("");
    try {
      await signOutCurrentUser();
      router.replace("/login");
    } catch {
      setSignOutError("We could not sign you out. Please try again.");
    }
  }

  if (signingOut || loading || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p role="status" className="text-sm text-foreground-muted">
          {signingOut ? "Signing out securely…" : "Resolving your secure workspace…"}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface p-5 lg:block">
        <Link href={workspacePaths[kind]} className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex size-9 items-center justify-center rounded-[0.7rem] bg-primary text-white">H</span>
          HemoLink <span className="text-medical">AI</span>
        </Link>
        <p className="mt-10 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-foreground-subtle">{kind} workspace</p>
        <Suspense fallback={<WorkspaceNavigationFallback kind={kind} />}>
          <WorkspaceNavigation kind={kind} />
        </Suspense>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-8">
            <Link
              href={workspacePaths[kind]}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary transition hover:bg-soft-rose focus-visible:outline-offset-2"
              aria-label={`${role} dashboard`}
            >
              <WorkspaceIcon name="dashboard" />
              <span>Dashboard</span>
            </Link>
            <AccountMenu
              name={name}
              email={userProfile?.email || firebaseUser?.email || ""}
              phone={userProfile?.phone || ""}
              role={role}
              dashboardHref={workspacePaths[kind]}
              profileHref={profilePaths[kind]}
              signingOut={signingOut}
              onSignOut={() => void handleSignOut()}
            />
          </div>
          {signOutError && (
            <p role="alert" className="px-5 pb-3 text-sm text-danger sm:px-8">
              {signOutError}
            </p>
          )}
          <Suspense fallback={<WorkspaceNavigationFallback kind={kind} mobile />}>
            <WorkspaceNavigation kind={kind} mobile />
          </Suspense>
        </header>
        {children}
      </div>
    </div>
  );
}

function AccountMenu({
  name,
  email,
  phone,
  role,
  dashboardHref,
  profileHref,
  signingOut,
  onSignOut,
}: {
  name: string;
  email: string;
  phone: string;
  role: string;
  dashboardHref: string;
  profileHref: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  return (
    <details
      className="group relative"
      open={menuOpen}
      onToggle={(event) => setMenuOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setMenuOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <summary
        ref={triggerRef}
        className="account-menu-trigger flex min-h-10 max-w-[min(14rem,55vw)] cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 transition hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:max-w-64 sm:gap-3 sm:px-3"
        aria-label={`Account menu for ${name}, ${role}`}
        aria-controls="workspace-account-menu"
      >
        <WorkspaceIcon name="account" />
        <span className="min-w-0 text-left">
          <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">
            <span className="sm:hidden">Account</span>
            <span className="hidden sm:inline">{name}</span>
          </span>
          <span className="hidden truncate text-xs text-foreground-subtle sm:block">
            {role}
          </span>
        </span>
        <WorkspaceIcon name="chevron" />
      </summary>
      <div
        id="workspace-account-menu"
        className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-2 shadow-lg"
      >
        <div className="border-b border-border px-3 py-3">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">{role}</p>
          <dl className="mt-3 space-y-1.5 text-xs text-foreground-muted">
            <div className="flex gap-2">
              <dt className="font-medium text-foreground-subtle">Email</dt>
              <dd className="min-w-0 break-all">{email || "Not recorded"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-foreground-subtle">Phone</dt>
              <dd>{phone || "Not recorded"}</dd>
            </div>
          </dl>
        </div>
        <nav aria-label="Account navigation" className="grid gap-1 py-2">
          <Link
            href={dashboardHref}
            onClick={() => setMenuOpen(false)}
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <WorkspaceIcon name="dashboard" />
            Dashboard
          </Link>
          <Link
            href={profileHref}
            onClick={() => setMenuOpen(false)}
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <WorkspaceIcon name="profile" />
            My Profile
          </Link>
        </nav>
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label="Sign out of HemoLink AI"
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-danger transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
          >
            <WorkspaceIcon name="signOut" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </details>
  );
}

function WorkspaceIcon({
  name,
}: {
  name: "dashboard" | "account" | "profile" | "signOut" | "chevron";
}) {
  const paths = {
    dashboard: <><path d="M3.75 10.5 12 3.75l8.25 6.75" /><path d="M5.5 9.25v10h13v-10M9.25 19.25v-6h5.5v6" /></>,
    account: <><circle cx="12" cy="8" r="3.25" /><path d="M5.25 20a6.75 6.75 0 0 1 13.5 0" /></>,
    profile: <><circle cx="12" cy="8" r="3.25" /><path d="M5.25 20a6.75 6.75 0 0 1 13.5 0" /></>,
    signOut: <><path d="M10 5H5.5v14H10M13.5 8l4 4-4 4M17.5 12H9" /></>,
    chevron: <path d="m7 9 5 5 5-5" />,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={name === "chevron" ? "size-4 shrink-0" : "size-5 shrink-0"}
    >
      {paths[name]}
    </svg>
  );
}

function WorkspaceNavigationFallback({
  kind,
  mobile = false,
}: {
  kind: WorkspaceShellProps["kind"];
  mobile?: boolean;
}) {
  return (
    <nav
      className={mobile
        ? "flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden"
        : "mt-3 grid gap-1"}
      aria-label={`${kind} workspace navigation`}
    >
      {links[kind].map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className={mobile
            ? "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-foreground-muted"
            : "rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted"}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function WorkspaceNavigation({
  kind,
  mobile = false,
}: {
  kind: WorkspaceShellProps["kind"];
  mobile?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={mobile
        ? "flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden"
        : "mt-3 grid gap-1"}
      aria-label={`${kind} workspace navigation`}
    >
      {links[kind].map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className={mobile
            ? `whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${pathname === href ? "bg-soft-rose text-primary" : "text-foreground-muted"}`
            : `rounded-lg px-3 py-2.5 text-sm font-medium transition ${pathname === href ? "bg-soft-rose text-primary" : "text-foreground-muted hover:bg-surface-muted hover:text-primary"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
