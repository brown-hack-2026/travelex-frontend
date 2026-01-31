import AuthGate from "@/components/AuthGate";
import MapScreen from "@/components/MapScreen";

export default function Page() {
  return (
    <AuthGate>
      <MapScreen />
    </AuthGate>
  );
}
