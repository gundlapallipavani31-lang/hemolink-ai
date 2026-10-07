"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
    ["Requests", "/blood-bank/requests"],
    ["Distribution", "/blood-bank/distribution"],
    ["Team", "/blood-bank/team"],
  ],
  administrator: [
    ["Overview", "/admin"],
    ["Requests", "/admin/requests"],
    ["Users", "/admin/users"],
    ["Organizations", "/admin/organizations"],
    ["Inventory", "/admin/inventory"],
    ["AI intelligence", "/admin/ai"],
  ],
} as const;

export function WorkspaceShell({ kind, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const { userProfile, firebaseUser } = useAuth();
  const name = userProfile?.name || firebaseUser?.email || "Workspace user";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface p-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex size-9 items-center justify-center rounded-[0.7rem] bg-primary text-white">H</span>
          HemoLink <span className="text-medical">AI</span>
        </Link>
        <p className="mt-10 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-foreground-subtle">{kind} workspace</p>
        <nav className="mt-3 grid gap-1" aria-label={`${kind} workspace navigation`}>
          {links[kind].map(([label, href]) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${pathname === href ? "bg-soft-rose text-primary" : "text-foreground-muted hover:bg-surface-muted hover:text-primary"}`}>{label}</Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between px-5 sm:px-8">
            <div><p className="text-sm font-semibold text-foreground">{name}</p><p className="text-xs text-foreground-subtle">{userProfile?.role ? formatRole(userProfile.role) : ""}</p></div>
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:text-primary-hover">Main workspace</Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden" aria-label={`${kind} mobile navigation`}>
            {links[kind].map(([label, href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${pathname === href ? "bg-soft-rose text-primary" : "text-foreground-muted"}`}>{label}</Link>)}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
