import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { OrganizationAccessGate } from "@/components/organization/OrganizationAccessGate";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function HospitalLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><RoleGuard allowedRoles={["hospital"]}><WorkspaceShell kind="hospital"><OrganizationAccessGate type="hospital">{children}</OrganizationAccessGate></WorkspaceShell></RoleGuard></AuthProvider>;
}
