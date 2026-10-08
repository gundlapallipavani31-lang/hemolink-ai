import { BloodFinder } from "@/components/blood/BloodFinder";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function FindBloodPage() {
  return (
    <AuthProvider>
      <BloodFinder />
    </AuthProvider>
  );
}
