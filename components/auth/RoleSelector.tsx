"use client";

import { useState } from "react";

const roles = [
  ["Donor", "Manage eligibility, donations and emergency opportunities.", "♡"],
  ["Hospital", "Request blood and coordinate emergency requirements.", "＋"],
  ["Blood Bank", "Manage inventory, requests and distribution.", "◒"],
  ["Administrator", "Monitor the entire HemoLink network.", "⌘"],
];

export function RoleSelector() {
  const [selected, setSelected] = useState("Donor");
  const description = roles.find(([role]) => role === selected)?.[1];

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Your role</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map(([role, detail, icon]) => (
          <label key={role} className={`group relative cursor-pointer rounded-[0.8rem] border p-3.5 transition hover:-translate-y-0.5 hover:border-primary/40 ${selected === role ? "border-primary bg-soft-rose/60 shadow-xs" : "border-border-strong bg-surface"}`}>
            <input type="radio" name="role" value={role} checked={selected === role} onChange={() => setSelected(role)} className="sr-only" />
            <span className="flex items-start gap-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base ${selected === role ? "bg-primary text-white" : "bg-surface-muted text-primary"}`}>{icon}</span>
              <span><span className="block text-sm font-semibold text-foreground">{role}</span><span className="mt-1 block text-xs leading-5 text-foreground-subtle">{detail}</span></span>
            </span>
            {selected === role && <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-success text-[0.6rem] text-white">✓</span>}
          </label>
        ))}
      </div>
      <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-xs leading-5 text-foreground-muted"><span className="font-semibold text-primary">Selected role:</span> {description}</p>
    </fieldset>
  );
}
