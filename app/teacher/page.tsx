import Link from "next/link";
import { ensureProfile, getRole } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import TeacherDashboard from "@/components/TeacherDashboard";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  await ensureProfile();
  const role = await getRole();

  if (role !== "teacher") {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-disp text-2xl text-ink mb-2">Acceso restringido</h1>
        <p className="text-[#5C6B7E] mb-6">
          Esta sección es para docentes. Si sos el profe, marcá tu perfil como
          <code className="font-mono"> role=&apos;teacher&apos; </code> en la base (ver SETUP.md).
        </p>
        <Link href="/exams" className={buttonVariants({ variant: "secondary", className: "inline-block" })}>← Volver</Link>
      </main>
    );
  }

  const sb = await getSupabaseServer();
  const { data: exams } = await sb
    .from("exams")
    .select("id, title, year")
    .order("year", { ascending: false });
  const examList = exams ?? [];
  const sp = await searchParams;
  const examId = sp.exam || examList[0]?.id;

  let attempts: any[] = [];
  let questionStats: any[] = [];
  let topicStats: any[] = [];

  if (examId) {
    const [aRes, qRes, tRes] = await Promise.all([
      sb
        .from("attempts")
        .select("id, score, total, started_at, submitted_at, auto, user_id, profiles(full_name, group_name)")
        .eq("exam_id", examId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
      sb.rpc("exam_question_stats", { p_exam: examId }),
      sb.rpc("exam_topic_stats", { p_exam: examId }),
    ]);

    attempts = (aRes.data ?? []).map((a: any) => {
      const dur =
        a.submitted_at && a.started_at
          ? Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)
          : 0;
      return {
        id: a.id,
        student: a.profiles?.full_name ?? "—",
        group: a.profiles?.group_name ?? "—",
        score: a.score,
        total: a.total,
        pct: a.total ? Math.round((a.score / a.total) * 100) : 0,
        durationSec: dur,
        auto: a.auto,
        date: a.submitted_at,
      };
    });
    questionStats = qRes.data ?? [];
    topicStats = tRes.data ?? [];
  }

  return (
    <TeacherDashboard
      examList={examList}
      examId={examId ?? null}
      attempts={attempts}
      questionStats={questionStats}
      topicStats={topicStats}
    />
  );
}
