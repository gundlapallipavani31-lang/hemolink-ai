import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Join the network" title="Build a more responsive blood network." description="Create your HemoLink AI profile and connect with the role you play in coordinated care.">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">Create your account</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-foreground">Get started with HemoLink AI</h2>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">Tell us a little about yourself so we can shape your workspace.</p>
      </div>
      <RegisterForm />
      <p className="mt-7 text-center text-sm text-foreground-muted">Already have an account? <a href="/login" className="font-semibold text-primary hover:text-primary-hover">Sign in</a></p>
    </AuthShell>
  );
}
