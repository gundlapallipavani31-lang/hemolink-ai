"use client";

import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete?: string;
};

export function PasswordField({ id, label, autoComplete }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="h-12 w-full rounded-[0.7rem] border border-border-strong bg-surface px-3.5 pr-12 text-sm text-foreground shadow-xs outline-none transition placeholder:text-foreground-subtle hover:border-[#b9aaa1] focus:border-medical focus:ring-4 focus:ring-red-100"
          placeholder="Enter your password"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-foreground-subtle transition hover:text-primary"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.3A10.8 10.8 0 0 1 12 5c5.1 0 8.5 4.3 9.5 7-.4 1.1-1.2 2.4-2.3 3.5M6.5 6.6C4.6 8 3.4 10 2.5 12c1 2.7 4.4 7 9.5 7 1.2 0 2.3-.2 3.3-.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
