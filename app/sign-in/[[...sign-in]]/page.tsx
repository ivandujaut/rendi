import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export default function Page() {
  return (
    <AuthShell subtitle="Iniciá sesión" tagline="Qué bueno tenerte de vuelta.">
      <SignIn />
    </AuthShell>
  );
}
