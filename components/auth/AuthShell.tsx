import type { ReactNode } from "react";
import Link from "next/link";
import { AuthIllustration } from "./AuthIllustration";
import { AuthLogo } from "./AuthLogo";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(28rem,1.08fr)]">
      <section className="relative hidden overflow-hidden bg-[#292424] px-10 py-10 text-white lg:flex lg:flex-col xl:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(180,35,24,0.2),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(127,29,29,0.16),transparent_38%)]" />
        <div className="relative flex h-full flex-col">
          <AuthLogo />
          <div className="mt-auto max-w-xl pb-4 pt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-200">{eyebrow}</p>
            <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.055em] xl:text-5xl">{title}</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-stone-300">{description}</p>
            <AuthIllustration />
          </div>
          <p className="mt-auto pt-10 text-xs text-stone-500">Thoughtful technology for healthcare coordination.</p>
        </div>
      </section>
      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 sm:py-10 lg:px-16 xl:px-24">
        <div className="flex justify-between lg:hidden">
          <AuthLogo />
          <Link href="/" className="self-center text-sm font-medium text-foreground-muted hover:text-primary">Back to home</Link>
        </div>
        <div className="mx-auto flex w-full max-w-[34rem] flex-1 items-center py-10 lg:max-w-[32rem] lg:py-16">
          <div className="w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
