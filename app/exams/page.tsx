import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Database } from "@/lib/db.types";
import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import ExamsClient, { type StudentExam } from "@/components/ExamsClient";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const { uid } = await requireOnboarded();
  const sb = await getSupabaseServer();

  // RLS ya limita a los exámenes ASIGNADOS al alumno (y publicados).
  const { data: exams } = await sb
    .from("exams")
    .select("id, title, year, duration_min, shuffle, student_review, pass_mark")
    .eq("is_published", true)
    .order("year", { ascending: false });

  const list = exams ?? [];
  const examIds = list.map((e) => e.id);

  type AssignRow = Pick<Database["public"]["Tables"]["exam_assignments"]["Row"], "exam_id" | "attempts_allowed">;
  type AttemptRow = Pick<Database["public"]["Tables"]["attempts"]["Row"], "id" | "exam_id" | "submitted_at">;

  // Intentos habilitados (de la asignación) + intentos ya entregados, por examen.
  const [assignsRes, attemptsRes] = examIds.length
    ? await Promise.all([
        sb.from("exam_assignments").select("exam_id, attempts_allowed").in("exam_id", examIds),
        sb
          .from("attempts")
          .select("id, exam_id, submitted_at")
          .eq("user_id", uid ?? "")
          .not("submitted_at", "is", null)
          .in("exam_id", examIds)
          .order("submitted_at", { ascending: false }),
      ])
    : [{ data: [] as AssignRow[] }, { data: [] as AttemptRow[] }];

  const allowedMap = new Map((assignsRes.data ?? []).map((a) => [a.exam_id, a.attempts_allowed]));
  const doneMap = new Map<string, { count: number; lastId: string }>();
  for (const a of attemptsRes.data ?? []) {
    const cur = doneMap.get(a.exam_id);
    if (cur) cur.count++;
    else doneMap.set(a.exam_id, { count: 1, lastId: a.id }); // primero = más reciente (orden desc)
  }

  const rows: StudentExam[] = list.map((e) => {
    const done = doneMap.get(e.id);
    const allowed = allowedMap.get(e.id) ?? 1;
    return {
      id: e.id,
      title: e.title,
      year: e.year,
      durationMin: e.duration_min,
      completed: !!done && done.count >= allowed,
      lastResultId: done?.lastId ?? null,
    };
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 flex-1">Simulacros disponibles</div>
        <PendingLink href="/plan" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Mi plan de repaso
        </PendingLink>
      </div>
      <h1 className="font-disp text-3xl text-ink mb-6">Tus simulacros</h1>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-[#656565]">
          Todavía no tenés simulacros asignados. Tu profe los habilita desde su panel.
        </div>
      ) : (
        <ExamsClient exams={rows} />
      )}
    </main>
  );
}
