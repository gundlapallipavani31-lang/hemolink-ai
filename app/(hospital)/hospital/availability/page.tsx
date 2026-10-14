import { HospitalPlaceholder } from "@/components/hospital/HospitalWorkspace";
import { HospitalRouteGuard } from "@/components/hospital/HospitalRouteGuard";

export default function Page() {
  return <HospitalRouteGuard><HospitalPlaceholder title="Blood availability" description="Select a blood group and component here in the next workflow phase. Live inventory counts are not available yet." /></HospitalRouteGuard>;
}
