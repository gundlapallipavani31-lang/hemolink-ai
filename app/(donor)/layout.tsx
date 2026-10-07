import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function DonorLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><RoleGuard allowedRoles={["donor"]}><WorkspaceShell kind="donor">{children}</WorkspaceShell></RoleGuard></AuthProvider>;
}
