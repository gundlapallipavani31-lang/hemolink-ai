import Link from "next/link";
import { PersonalAccountDetails } from "@/components/layout/PersonalAccountDetails";

export function AdminProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">
        Administrator profile
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-foreground">My profile</h1>
      <p className="mt-4 text-sm leading-6 text-foreground-muted">
        Personal account information associated with your HemoLink administrator access.
      </p>
      <div className="mt-8">
        <PersonalAccountDetails />
      </div>
      <Link
        href="/admin"
        className="mt-6 inline-flex min-h-10 items-center rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Return to dashboard
      </Link>
    </main>
  );
}
