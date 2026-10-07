import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
