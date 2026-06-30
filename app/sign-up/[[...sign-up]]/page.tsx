import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export default function Page() {
  return (
    <AuthShell subtitle="Creá tu cuenta" tagline="Empezá a practicar en un minuto.">
      <SignUp />
    </AuthShell>
  );
}
