import { DonorOpportunities } from "@/components/donor/DonorOpportunities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function Page() {
  return <RoleGuard allowedRoles={["donor"]}><DonorOpportunities /></RoleGuard>;
}
