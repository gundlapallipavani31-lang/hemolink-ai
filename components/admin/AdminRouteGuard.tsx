"use client";

import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={["administrator"]}>{children}</RoleGuard>;
}
