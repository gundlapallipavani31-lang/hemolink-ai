import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function DonorLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><WorkspaceShell kind="donor">{children}</WorkspaceShell></AuthProvider>;
}
