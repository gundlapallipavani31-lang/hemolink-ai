"use client";

import { useRef, useState, type FormEvent } from "react";
import type { BloodComponent, BloodGroup } from "@/types/domain";

const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const components: BloodComponent[] = [
  "wholeBlood",
  "redCells",
  "plasma",
  "platelets",
  "cryoprecipitate",
];

const label = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

function newSubmissionKey() {
  return crypto.randomUUID();
}

export function PublicEmergencyIntakeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInProgress = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const lastPayload = useRef("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInProgress.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const neededByLocal = String(data.get("neededBy") || "");
    const neededBy = new Date(neededByLocal);
    if (!Number.isFinite(neededBy.getTime())) {
      setError("Enter a valid required-by date and time.");
      return;
    }

    const payload = {
      requesterName: data.get("requesterName"),
      requesterPhone: data.get("requesterPhone"),
      bloodGroup: data.get("bloodGroup"),
      componentType: data.get("componentType"),
      unitsNeeded: Number(data.get("unitsNeeded")),
      facilityName: data.get("facilityName"),
      locality: data.get("locality"),
      urgency: data.get("urgency"),
      neededBy: neededBy.toISOString(),
      note: data.get("note"),
      website: data.get("website"),
    };
    const serializedPayload = JSON.stringify(payload);
    if (!idempotencyKey.current || (lastPayload.current && lastPayload.current !== serializedPayload)) {
      idempotencyKey.current = newSubmissionKey();
    }
    lastPayload.current = serializedPayload;

    submissionInProgress.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/public/emergency-intakes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !result.reference) {
        throw new Error(result.error || "Your request could not be submitted.");
      }
      setReference(result.reference);
      form.reset();
      idempotencyKey.current = null;
      lastPayload.current = "";
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : "Your request could not be submitted. Please try again.");
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section
      id="emergency-intake"
      className="mt-12 scroll-mt-8 rounded-[1rem] border border-red-200 bg-surface p-5 shadow-xs sm:p-8"
      aria-labelledby="emergency-intake-title"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Patient and attendant requests</p>
        <h2 id="emergency-intake-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Submit an emergency blood requirement
        </h2>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">
          Share the minimum details an authorized coordination team needs to review your request. You do not need to create an account.
        </p>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
        <p><strong>Important:</strong> Submitting a request does not guarantee blood availability, reserve stock, or constitute medical approval. An authorized team must review and coordinate the request.</p>
        <p><strong>Life-threatening emergency?</strong> Contact local emergency services or the treating hospital immediately. Do not rely solely on this website.</p>
      </div>

      {reference ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5" role="status" aria-live="polite">
          <h3 className="font-semibold text-success">Request received</h3>
          <p className="mt-2 text-sm leading-6 text-foreground">
            Your request was submitted for authorized review. Keep this reference for your records:
          </p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-foreground">{reference}</p>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            No stock has been reserved, and no availability or fulfillment is guaranteed. This site does not send email or SMS updates.
          </p>
          <button
            type="button"
            onClick={() => {
              setReference("");
              idempotencyKey.current = null;
              lastPayload.current = "";
              formRef.current?.reset();
            }}
            className="mt-4 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-primary"
          >
            Submit another request
          </button>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={submit}
          className="mt-6 grid gap-5 sm:grid-cols-2"
          aria-describedby="emergency-intake-guidance"
        >
          <p id="emergency-intake-guidance" className="sr-only">
            Required fields are marked by the browser. Notes must not include unnecessary medical history or sensitive health details.
          </p>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Requester full name
            <input required name="requesterName" autoComplete="name" maxLength={120} className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Contact phone
            <input required name="requesterPhone" type="tel" autoComplete="tel" maxLength={40} aria-describedby="phone-help" className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
            <span id="phone-help" className="text-xs font-normal text-foreground-muted">Include your country code when possible.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Required blood group
            <select required name="bloodGroup" defaultValue="" className="h-12 rounded-lg border border-border-strong bg-surface px-3">
              <option value="">Select blood group</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Blood component
            <select required name="componentType" defaultValue="" className="h-12 rounded-lg border border-border-strong bg-surface px-3">
              <option value="">Select component</option>
              {components.map((item) => <option key={item} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Units needed
            <input required name="unitsNeeded" type="number" min={1} max={50} step={1} inputMode="numeric" className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
            <span className="text-xs font-normal text-foreground-muted">Enter a whole number from 1 to 50.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Urgency
            <select required name="urgency" defaultValue="emergency" className="h-12 rounded-lg border border-border-strong bg-surface px-3">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Hospital or medical facility
            <input required name="facilityName" maxLength={160} autoComplete="organization" className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            City or locality
            <input required name="locality" maxLength={120} autoComplete="address-level2" className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
            Required by
            <input required name="neededBy" type="datetime-local" className="h-12 rounded-lg border border-border-strong bg-surface px-3" />
            <span className="text-xs font-normal text-foreground-muted">Enter local time; the required time must be within the next 30 days.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
            Optional note
            <textarea name="note" maxLength={500} rows={3} aria-describedby="note-help" className="rounded-lg border border-border-strong bg-surface px-3 py-2.5" placeholder="Coordination details only." />
            <span id="note-help" className="text-xs font-normal leading-5 text-foreground-muted">
              Do not include unnecessary medical history, diagnoses, or other sensitive health details. Maximum 500 characters.
            </span>
          </label>
          <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
            <label>
              Leave this field blank
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {error && (
            <p role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Submitting request…" : "Submit emergency request"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
