import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureProfile, getRole } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { AssignmentManager } from "@/components/AssignmentManager";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureProfile();
  const role = await getRole();
  if (role !== "teacher") {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-disp text-2xl text-ink mb-2">Acceso restringido</h1>
        <Link href="/exams" className={buttonVariants({ variant: "secondary" })}>← Volver</Link>
      </main>
    );
  }

  const { id } = await params;
  const sb = await getSupabaseServer();

  const { data: exam } = await sb.from("exams").select("id, title").eq("id", id).maybeSingle();
  if (!exam) notFound();

  const [studentsRes, assignsRes, attemptsRes] = await Promise.all([
    sb.from("profiles").select("id, full_name, group_name").eq("role", "student").order("full_name"),
    sb.from("exam_assignments").select("user_id, attempts_allowed").eq("exam_id", id),
    sb.from("attempts").select("user_id, score, total, submitted_at").eq("exam_id", id).not("submitted_at", "is", null),
  ]);

  const assignMap = new Map((assignsRes.data ?? []).map((a) => [a.user_id, a.attempts_allowed]));
  const statMap = new Map<string, { count: number; bestPct: number }>();
  for (const a of attemptsRes.data ?? []) {
    const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
    const cur = statMap.get(a.user_id) ?? { count: 0, bestPct: 0 };
    statMap.set(a.user_id, { count: cur.count + 1, bestPct: Math.max(cur.bestPct, pct) });
  }

  const list = (studentsRes.data ?? []).map((s) => {
    const stat = statMap.get(s.id);
    return {
      id: s.id,
      name: s.full_name ?? "Alumno/a",
      group: s.group_name ?? null,
      assigned: assignMap.has(s.id),
      attemptsAllowed: assignMap.get(s.id) ?? 1,
      submittedCount: stat?.count ?? 0,
      bestPct: stat ? stat.bestPct : null,
    };
  });

  return <AssignmentManager examId={id} examTitle={exam.title} students={list} />;
}
