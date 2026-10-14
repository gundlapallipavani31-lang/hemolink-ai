import { HospitalRequestDetail } from "@/components/hospital/requests/HospitalRequests";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><HospitalRequestDetail /></HospitalRouteGuard>;
}
