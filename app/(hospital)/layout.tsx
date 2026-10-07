import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function HospitalLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><RoleGuard allowedRoles={["hospital"]}><WorkspaceShell kind="hospital">{children}</WorkspaceShell></RoleGuard></AuthProvider>;
}
