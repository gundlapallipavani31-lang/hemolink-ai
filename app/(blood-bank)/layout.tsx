import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { OrganizationAccessGate } from "@/components/organization/OrganizationAccessGate";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function BloodBankLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RoleGuard allowedRoles={["bloodBank"]}>
        <WorkspaceShell kind="bloodBank">
          <OrganizationAccessGate type="bloodBank">{children}</OrganizationAccessGate>
        </WorkspaceShell>
      </RoleGuard>
    </AuthProvider>
  );
}
