"use client";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase";
import { createUserProfile } from "@/lib/userProfile";
import { AuthInput } from "./AuthInput";
import { getFirebaseErrorMessage } from "./firebaseErrorMessage";
import { PasswordField } from "./PasswordField";
import { RoleSelector } from "./RoleSelector";

type ProfileToSave = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  requestedRole: string;
};

export function RegisterForm() {
  const router = useRouter();
  const submissionInProgress = useRef(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profileToSave, setProfileToSave] = useState<ProfileToSave | null>(null);

  async function saveProfile(profile: ProfileToSave) {
    if (submissionInProgress.current) return;

    submissionInProgress.current = true;
    setSubmitting(true);
    setError("");

    try {
      await createUserProfile(profile);
      setProfileToSave(null);
      router.replace("/dashboard");
    } catch {
      setError(
        "Your account was created, but profile setup could not be completed. Retry profile setup below. If it continues to fail, contact support; creating another account will not resolve it.",
      );
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInProgress.current || profileToSave) return;

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("register-password") ?? "");
    const confirmPassword = String(formData.get("confirm-password") ?? "");
    const role = String(formData.get("role") ?? "").trim();
    const termsAccepted = formData.get("terms") === "on";

    setError("");

    if (!fullName) return setError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (!phone) return setError("Enter your phone number.");
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!role) return setError("Select a role to continue.");
    if (!termsAccepted) return setError("Accept the Terms of Service and Privacy Policy to continue.");

    submissionInProgress.current = true;
    setSubmitting(true);
    let profile: ProfileToSave;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      profile = {
        uid: user.uid,
        name: fullName,
        email,
        phone,
        requestedRole: role,
      };
    } catch (firebaseError: unknown) {
      setError(getFirebaseErrorMessage(firebaseError, "register"));
      submissionInProgress.current = false;
      setSubmitting(false);
      return;
    }

    setProfileToSave(profile);
    submissionInProgress.current = false;
    setSubmitting(false);
    await saveProfile(profile);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={submitting || profileToSave !== null} className="space-y-5">
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
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-danger">{error}</p>}
      {profileToSave ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void saveProfile(profileToSave)}
          className="h-12 w-full rounded-[0.7rem] bg-primary text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? "Saving profile…" : "Retry profile setup"}
        </button>
      ) : (
        <button type="submit" disabled={submitting} className="h-12 w-full rounded-[0.7rem] bg-primary text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:cursor-wait disabled:opacity-70">{submitting ? "Creating account…" : "Create Account"}</button>
      )}
    </form>
  );
}
