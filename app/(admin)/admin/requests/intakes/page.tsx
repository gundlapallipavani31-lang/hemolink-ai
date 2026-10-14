import { PublicEmergencyIntakes } from "@/components/admin/requests/PublicEmergencyIntakes";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function PublicEmergencyIntakesPage() {
  return <AdminRouteGuard><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><PublicEmergencyIntakes /></main></AdminRouteGuard>;
}
