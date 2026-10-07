"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/AsyncState";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/auth";

type RoleGuardProps = {
  allowedRoles: readonly AppRole[];
  children: ReactNode;
  fallbackPath?: string;
};

export function RoleGuard({
  allowedRoles,
  children,
  fallbackPath = "/dashboard",
}: RoleGuardProps) {
  const router = useRouter();
  const { loading, isAuthenticated, role } = useAuth();
  const allowed = role !== null && allowedRoles.includes(role);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    } else if (!loading && isAuthenticated && !allowed) {
      router.replace(fallbackPath);
    }
  }, [allowed, fallbackPath, isAuthenticated, loading, router]);

  if (loading || !isAuthenticated || !allowed) {
    return <LoadingState title="Checking workspace access" />;
  }

  return children;
}
