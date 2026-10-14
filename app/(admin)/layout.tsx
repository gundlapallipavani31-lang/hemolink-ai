import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><WorkspaceShell kind="administrator">{children}</WorkspaceShell></AuthProvider>;
}
