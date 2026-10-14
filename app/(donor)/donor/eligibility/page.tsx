import { DonorEligibilityPage } from "@/components/donor/DonorWorkspace";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function Page() {
  return <RoleGuard allowedRoles={["donor"]}><DonorEligibilityPage /></RoleGuard>;
}
