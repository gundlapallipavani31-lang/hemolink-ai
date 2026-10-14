import { PatientsPage } from "@/components/hospital/HospitalWorkspace";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><PatientsPage /></HospitalRouteGuard>;
}
