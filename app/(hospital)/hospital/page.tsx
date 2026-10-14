import { HospitalDashboard } from "@/components/hospital/HospitalWorkspace";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><HospitalDashboard /></HospitalRouteGuard>;
}
