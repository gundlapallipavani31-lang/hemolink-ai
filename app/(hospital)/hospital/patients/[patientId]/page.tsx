import { HospitalPlaceholder } from "@/components/hospital/HospitalWorkspace";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><HospitalPlaceholder title="Patient details" description="Patient detail editing will remain minimal and organization-scoped as this workflow matures." /></HospitalRouteGuard>;
}
