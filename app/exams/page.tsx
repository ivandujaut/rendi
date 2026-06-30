import Link from "next/link";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Exam } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

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

  const list = (exams ?? []) as Exam[];
  const examIds = list.map((e) => e.id);

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
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const allowedMap = new Map((assignsRes.data ?? []).map((a: any) => [a.exam_id, a.attempts_allowed]));
  const doneMap = new Map<string, { count: number; lastId: string }>();
  for (const a of attemptsRes.data ?? []) {
    const cur = doneMap.get(a.exam_id);
    if (cur) cur.count++;
    else doneMap.set(a.exam_id, { count: 1, lastId: a.id }); // primero = más reciente (orden desc)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">
        Simulacros disponibles
      </div>
      <h1 className="font-disp text-3xl text-ink mb-1">Elegí un examen para practicar</h1>
      <p className="text-[#656565] mb-8">
        Tu profe habilita los simulacros. Tenés un intento por examen.
      </p>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-[#656565]">
          Todavía no tenés simulacros asignados. Tu profe los habilita desde su panel.
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((e) => {
            const done = doneMap.get(e.id);
            const allowed = allowedMap.get(e.id) ?? 1;
            const completed = !!done && done.count >= allowed;
            return (
              <Link
                key={e.id}
                href={completed ? `/result/${done!.lastId}` : `/exam/${e.id}`}
                className="card p-5 flex items-center justify-between hover:border-brand transition"
              >
                <div>
                  <div className="font-disp font-semibold text-lg text-ink">{e.title}</div>
                  <div className="text-sm text-[#656565] font-mono mt-1">
                    {e.duration_min} min · opción múltiple A–E{e.year ? ` · ${e.year}` : ""}
                  </div>
                </div>
                {completed ? (
                  <span className={buttonVariants({ variant: "secondary" })}>Completado · ver resultado</span>
                ) : (
                  <span className={buttonVariants({ variant: "primary" })}>Rendir<HugeiconsIcon icon={ArrowRight01Icon} /></span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
