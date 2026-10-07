import { DonationHistory } from "@/components/donor/DonationHistory";

export default function Page() {
  return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-medical">Donor workspace</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Donation history</h1>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground-muted">Review verified donation records linked to your donor account.</p>
    <section className="mt-8 rounded-[1rem] border border-border bg-surface p-6"><DonationHistory /></section>
  </main>;
}
