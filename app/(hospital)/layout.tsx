import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function HospitalLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><WorkspaceShell kind="hospital">{children}</WorkspaceShell></AuthProvider>;
}
