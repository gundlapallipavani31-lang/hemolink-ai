import { AdminProfilePage } from "@/components/admin/AdminProfilePage";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function Page() {
  return (
    <AdminRouteGuard>
      <AdminProfilePage />
    </AdminRouteGuard>
  );
}
