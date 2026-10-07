import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Secure workspace access" title="Smarter blood coordination starts here." description="Securely access your HemoLink AI workspace.">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">Welcome back</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-foreground">Sign in to HemoLink AI</h2>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">Continue to your intelligent blood coordination workspace.</p>
      </div>
      <LoginForm />
      <p className="mt-7 text-center text-sm text-foreground-muted">New to HemoLink AI? <a href="/register" className="font-semibold text-primary hover:text-primary-hover">Create an account</a></p>
    </AuthShell>
  );
}
