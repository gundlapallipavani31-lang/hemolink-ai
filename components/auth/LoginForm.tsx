"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase";
import { AuthInput } from "./AuthInput";
import { getFirebaseErrorMessage } from "./firebaseErrorMessage";
import { PasswordField } from "./PasswordField";

export function LoginForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setError("");
    setSuccess("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccess("You are signed in. Your workspace is ready for the next step.");
    } catch (firebaseError: unknown) {
      setError(getFirebaseErrorMessage(firebaseError, "login"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={submitting} className="space-y-5">
        <AuthInput id="email" name="email" type="email" label="Email address" placeholder="you@organization.com" autoComplete="email" required />
        <PasswordField id="password" label="Password" autoComplete="current-password" />
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="inline-flex items-center gap-2 text-foreground-muted"><input type="checkbox" name="remember" className="size-4 rounded border-border-strong accent-primary" /> Remember me</label>
          <a href="#forgot-password" className="font-medium text-primary hover:text-primary-hover">Forgot password?</a>
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-danger">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-success">{success}</p>}
      <button type="submit" disabled={submitting} className="h-12 w-full rounded-[0.7rem] bg-primary text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:cursor-wait disabled:opacity-70">
        {submitting ? "Signing in…" : "Sign In"}
      </button>
      <div className="relative py-1 text-center"><span className="relative z-10 bg-background px-3 text-xs text-foreground-subtle">or</span><span className="absolute inset-x-0 top-1/2 h-px bg-border" /></div>
      <button type="button" disabled className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[0.7rem] border border-border-strong bg-surface text-sm font-semibold text-foreground-muted transition disabled:cursor-not-allowed disabled:opacity-75">
        <span className="flex size-5 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">G</span> Continue with Google <span className="text-[0.65rem] font-normal text-foreground-subtle">(coming soon)</span>
      </button>
    </form>
  );
}
