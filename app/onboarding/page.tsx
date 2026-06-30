import { redirect } from "next/navigation";
import { ensureProfile, getProfile } from "@/lib/profile";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await ensureProfile();
  const profile = await getProfile();

  // Si ya completó el onboarding, no tiene nada que hacer acá.
  if (profile?.onboarded) {
    redirect(profile.role === "teacher" ? "/teacher" : "/exams");
  }

  return (
    <OnboardingWizard
      defaultName={profile?.full_name ?? ""}
      defaultGroup={profile?.group_name ?? ""}
    />
  );
}
