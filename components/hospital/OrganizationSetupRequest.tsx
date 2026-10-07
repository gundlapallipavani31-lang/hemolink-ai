"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";

export function OrganizationSetupRequest() {
  const { firebaseUser } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setError(""); setMessage("");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/hospital/organization-request", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), legalName: data.get("legalName"), city: data.get("city") }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Organization setup request could not be submitted.");
      setMessage("Organization setup request submitted for administrator verification.");
      event.currentTarget.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Organization setup request could not be submitted."); } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-border bg-surface-muted p-5 sm:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Hospital name<input name="name" required className="h-11 rounded-lg border border-border-strong bg-surface px-3" /></label><label className="grid gap-2 text-sm font-medium">Legal name<input name="legalName" className="h-11 rounded-lg border border-border-strong bg-surface px-3" /></label><label className="grid gap-2 text-sm font-medium">City<input name="city" required className="h-11 rounded-lg border border-border-strong bg-surface px-3" /></label><div className="sm:col-span-3"><button disabled={saving} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Submitting…" : "Request organization setup"}</button>{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}</div></form>;
}
