import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><RoleGuard allowedRoles={["administrator"]}><WorkspaceShell kind="administrator">{children}</WorkspaceShell></RoleGuard></AuthProvider>;
}
