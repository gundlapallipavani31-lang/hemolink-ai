import { DonorManagement } from "@/components/admin/DonorManagement";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function Page() {
  return <AdminRouteGuard><DonorManagement /></AdminRouteGuard>;
}
