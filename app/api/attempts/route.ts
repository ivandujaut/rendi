import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { examId } = await req.json();
  if (!examId) return NextResponse.json({ error: "examId requerido" }, { status: 400 });

  const sb = await getSupabaseServer();

  // Verificar examen publicado.
  const { data: exam } = await sb
    .from("exams")
    .select("id, duration_min")
    .eq("id", examId)
    .eq("is_published", true)
    .maybeSingle();
  if (!exam) return NextResponse.json({ error: "examen no disponible" }, { status: 404 });

  // Debe estar asignado a este alumno (el docente lo habilita).
  const { data: assignment } = await sb
    .from("exam_assignments")
    .select("attempts_allowed")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!assignment) {
    return NextResponse.json({ error: "Este examen no está habilitado para vos." }, { status: 403 });
  }

  // Reanudar un intento en curso si existe (evita reiniciar el reloj).
  const { data: existing } = await sb
    .from("attempts")
    .select("id, started_at")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let attemptId = existing?.id;
  let startedAt = existing?.started_at;

  if (!existing) {
    // Un intento por asignación: bloquear si ya usó los intentos habilitados.
    const { count } = await sb
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .eq("user_id", userId)
      .not("submitted_at", "is", null);
    if ((count ?? 0) >= assignment.attempts_allowed) {
      return NextResponse.json({ error: "Ya rendiste este examen." }, { status: 403 });
    }

    const { data: created, error } = await sb
      .from("attempts")
      .insert({ exam_id: examId, user_id: userId })
      .select("id, started_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    attemptId = created.id;
    startedAt = created.started_at;
  }

  // Invariante: a esta altura siempre hay un intento (existente o recién creado).
  if (!attemptId || !startedAt) {
    return NextResponse.json({ error: "no se pudo crear el intento" }, { status: 500 });
  }

  // Respuestas ya guardadas (para restaurar al reanudar un intento en curso).
  const { data: responses } = await sb
    .from("responses")
    .select("question_id, choice")
    .eq("attempt_id", attemptId);

  return NextResponse.json({
    attemptId,
    startedAt,
    durationMin: exam.duration_min,
    responses: responses ?? [],
  });
}
