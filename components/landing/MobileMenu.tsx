"use client";

import { useState } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  ["Platform", "#platform"],
  ["AI Intelligence", "#intelligence"],
  ["How It Works", "#how-it-works"],
  ["For Hospitals", "#roles"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:border-border-strong hover:bg-surface-muted"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          {open ? <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-navigation" className="absolute inset-x-4 top-[4.5rem] rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="mb-3 px-2 py-2">
            <BrandMark compact />
          </div>
          <nav className="grid gap-1" aria-label="Mobile navigation">
            {links.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-primary">
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid gap-2 border-t border-border pt-3">
            <a href="#login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-foreground-muted hover:bg-surface-muted">Log in</a>
            <a href="#find-blood" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover">Find Blood</a>
          </div>
        </div>
      )}
    </div>
  );
}
