import Link from "next/link";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import TeacherDashboard, { type Attempt, type QStat, type TStat } from "@/components/TeacherDashboard";
import { buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export const dynamic = "force-dynamic";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  const { role } = await requireOnboarded();

  if (role !== "teacher") {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-disp text-2xl text-ink mb-2">Esta sección es solo para docentes</h1>
        <p className="text-[#656565] mb-6">
          Tu cuenta es de alumno/a. Si sos docente y necesitás acceso al panel,
          escribile al administrador del curso para que te lo habilite.
        </p>
        <Link href="/exams" className={buttonVariants({ variant: "secondary" })}><HugeiconsIcon icon={ArrowLeft01Icon} />Volver</Link>
      </main>
    );
  }

  const sb = await getSupabaseServer();
  const { data: exams } = await sb
    .from("exams")
    .select("id, title, year, is_published")
    .order("year", { ascending: false });
  const examList = exams ?? [];
  const sp = await searchParams;
  const examId = sp.exam || examList[0]?.id;

  let attempts: Attempt[] = [];
  let questionStats: QStat[] = [];
  let topicStats: TStat[] = [];
  let topicStatsPractice: TStat[] = []; // mismo desglose por tema, pero de práctica
  let openCount = 0; // respuestas de desarrollo entregadas de este examen
  let pendingGrading = 0; // de esas, cuántas esperan revisión del docente

  if (examId) {
    const [aRes, qRes, tRes, oRes, pRes] = await Promise.all([
      sb
        .from("attempts")
        .select("id, score, total, started_at, submitted_at, auto, user_id, profiles(full_name, group_name)")
        .eq("exam_id", examId)
        .eq("mode", "exam")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
      sb.rpc("exam_question_stats", { p_exam: examId }),
      sb.rpc("exam_topic_stats", { p_exam: examId }),
      sb
        .from("open_responses")
        .select("id, attempts!inner(exam_id), ai_gradings(estado)")
        .eq("attempts.exam_id", examId),
      sb.rpc("exam_topic_stats", { p_exam: examId, p_mode: "practice" }),
    ]);

    const openRows = oRes.data ?? [];
    openCount = openRows.length;
    pendingGrading = openRows.filter((o) => {
      const g = Array.isArray(o.ai_gradings) ? o.ai_gradings[0] : o.ai_gradings;
      return !g || g.estado === "pending" || g.estado === "failed";
    }).length;

    const TZ = "America/Argentina/Buenos_Aires";
    attempts = (aRes.data ?? []).map((a) => {
      const dur =
        a.submitted_at && a.started_at
          ? Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)
          : 0;
      // Fecha formateada en el server con TZ fija: evita el mismatch de hidratación
      // (server UTC vs client local) en el panel, que es un client component.
      const d = a.submitted_at ? new Date(a.submitted_at) : null;
      const dateLabel = d
        ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: TZ }) +
          " " +
          d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
        : "s/d";
      // score/total/auto/submitted_at nunca son null acá: el query ya filtró por
      // submitted_at not null, y grade_attempt() siempre setea score+total juntos.
      return {
        id: a.id,
        student: a.profiles?.full_name ?? "s/d",
        group: a.profiles?.group_name ?? "s/d",
        score: a.score ?? 0,
        total: a.total ?? 0,
        pct: a.total ? Math.round(((a.score ?? 0) / a.total) * 100) : 0,
        durationSec: dur,
        auto: a.auto ?? false,
        date: a.submitted_at ?? "",
        dateLabel,
      };
    });
    questionStats = (qRes.data ?? []).map((q) => ({ ...q, topic: q.topic ?? "s/d" }));
    topicStats = (tRes.data ?? []).map((t) => ({ ...t, topic: t.topic ?? "s/d" }));
    topicStatsPractice = (pRes.data ?? []).map((t) => ({ ...t, topic: t.topic ?? "s/d" }));
  }

  return (
    <TeacherDashboard
      examList={examList}
      examId={examId ?? null}
      attempts={attempts}
      questionStats={questionStats}
      topicStats={topicStats}
      topicStatsPractice={topicStatsPractice}
      openCount={openCount}
      pendingGrading={pendingGrading}
    />
  );
}
