import { DonorDashboard } from "@/components/donor/DonorWorkspace";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function Page() {
  return <RoleGuard allowedRoles={["donor"]}><DonorDashboard /></RoleGuard>;
}
