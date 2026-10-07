import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function BloodBankLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RoleGuard allowedRoles={["bloodBank"]}>
        <WorkspaceShell kind="bloodBank">{children}</WorkspaceShell>
      </RoleGuard>
    </AuthProvider>
  );
}
