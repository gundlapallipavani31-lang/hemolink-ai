import { HospitalPlaceholder } from "@/components/hospital/HospitalWorkspace";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><HospitalPlaceholder title="Hospital team" description="Organization members and invitations will be managed through a trusted membership workflow in a later phase." /></HospitalRouteGuard>;
}
