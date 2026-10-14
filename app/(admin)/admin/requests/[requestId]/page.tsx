import { AdminRequestDetail } from "@/components/admin/requests/AdminRequests";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function Page() {
  return <AdminRouteGuard><AdminRequestDetail /></AdminRouteGuard>;
}
