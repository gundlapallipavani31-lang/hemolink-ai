"use client";

import { useAuth } from "@/hooks/useAuth";
import { formatRole } from "@/types/auth";

export function PersonalAccountDetails() {
  const { firebaseUser, userProfile } = useAuth();
  const name =
    userProfile?.name || firebaseUser?.displayName || "Not recorded";
  const email = userProfile?.email || firebaseUser?.email || "Not recorded";
  const phone = userProfile?.phone || "Not recorded";
  const role = userProfile?.role ? formatRole(userProfile.role) : "Not recorded";

  return (
    <section
      aria-labelledby="personal-account-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs"
    >
      <h2 id="personal-account-heading" className="font-semibold text-foreground">
        Your HemoLink account
      </h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">
            Name
          </dt>
          <dd className="mt-1 break-words font-medium text-foreground">{name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">
            Role
          </dt>
          <dd className="mt-1 font-medium text-foreground">{role}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">
            Email
          </dt>
          <dd className="mt-1 break-all font-medium text-foreground">{email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">
            Phone
          </dt>
          <dd className="mt-1 break-words font-medium text-foreground">{phone}</dd>
        </div>
      </dl>
    </section>
  );
}
