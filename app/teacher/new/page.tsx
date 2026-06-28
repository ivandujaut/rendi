import Link from "next/link";
import { ensureProfile, getRole } from "@/lib/profile";
import ExamBuilder from "@/components/ExamBuilder";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewExamPage() {
  await ensureProfile();
  const role = await getRole();
  if (role !== "teacher") {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-disp text-2xl text-ink mb-2">Acceso restringido</h1>
        <Link href="/exams" className={buttonVariants({ variant: "secondary", className: "inline-block" })}>← Volver</Link>
      </main>
    );
  }
  return <ExamBuilder />;
}
