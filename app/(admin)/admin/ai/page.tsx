import { AICommandCenter } from "@/components/admin/AICommandCenter";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";

export default function Page() {
  return <AdminRouteGuard><AICommandCenter /></AdminRouteGuard>;
}
