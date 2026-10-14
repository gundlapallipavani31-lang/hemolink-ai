"use client";

import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { OrganizationAccessGate } from "@/components/organization/OrganizationAccessGate";

export function HospitalRouteGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["hospital"]}>
      <OrganizationAccessGate type="hospital">{children}</OrganizationAccessGate>
    </RoleGuard>
  );
}
