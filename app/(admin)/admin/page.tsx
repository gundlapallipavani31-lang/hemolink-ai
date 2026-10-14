import { AdminDashboardOverview } from "@/components/admin/AdminOperations";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function Page() {
  return <AdminRouteGuard><AdminDashboardOverview /></AdminRouteGuard>;
}
