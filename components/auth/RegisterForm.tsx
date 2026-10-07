"use client";

import { AuthInput } from "./AuthInput";
import { PasswordField } from "./PasswordField";
import { RoleSelector } from "./RoleSelector";

export function RegisterForm() {
  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-5 sm:grid-cols-2">
        <AuthInput id="full-name" name="fullName" label="Full name" placeholder="Your full name" autoComplete="name" required />
        <AuthInput id="phone" name="phone" type="tel" label="Phone number" placeholder="+1 (555) 000-0000" autoComplete="tel" required />
      </div>
      <AuthInput id="register-email" name="email" type="email" label="Email address" placeholder="you@organization.com" autoComplete="email" required />
      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField id="register-password" label="Password" autoComplete="new-password" />
        <PasswordField id="confirm-password" label="Confirm password" autoComplete="new-password" />
      </div>
      <RoleSelector />
      <label className="flex items-start gap-2.5 text-xs leading-5 text-foreground-muted"><input type="checkbox" name="terms" required className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary" /><span>I agree to the <a href="#terms" className="font-medium text-primary underline underline-offset-2">Terms of Service</a> and <a href="#privacy" className="font-medium text-primary underline underline-offset-2">Privacy Policy</a>.</span></label>
      <button type="submit" className="h-12 w-full rounded-[0.7rem] bg-primary text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md">Create Account</button>
    </form>
  );
}
