import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id: attemptId } = await params;
  const { responses, auto } = await req.json();

  const sb = await getSupabaseServer();

  // El intento debe ser del usuario y no estar entregado.
  const { data: attempt } = await sb
    .from("attempts")
    .select("id, user_id, started_at, submitted_at, exam_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.user_id !== userId) {
    return NextResponse.json({ error: "intento no encontrado" }, { status: 404 });
  }
  if (attempt.submitted_at) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  // Reloj autoritativo: si se agotó el tiempo, igual se corrige lo que haya.
  const { data: exam } = await sb
    .from("exams")
    .select("duration_min")
    .eq("id", attempt.exam_id)
    .single();
  const elapsedSec = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
  const overtime = elapsedSec > (exam?.duration_min ?? 40) * 60 + 5; // 5s de gracia

  // Guardar respuestas (upsert por si reenvía).
  const rows = (responses as { question_id: string; choice: string }[])
    .filter((r) => r && r.question_id && r.choice)
    .map((r) => ({ attempt_id: attemptId, question_id: r.question_id, choice: r.choice }));

  if (rows.length > 0) {
    const { error: insErr } = await sb
      .from("responses")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // Marcar entrega automática si corresponde.
  await sb.from("attempts").update({ auto: !!auto || overtime }).eq("id", attemptId);

  // Corrección server-side (la función lee la clave sin devolverla).
  const { data: graded, error: gradeErr } = await sb.rpc("grade_attempt", {
    p_attempt: attemptId,
  });
  if (gradeErr) return NextResponse.json({ error: gradeErr.message }, { status: 400 });

  const result = Array.isArray(graded) ? graded[0] : graded;
  return NextResponse.json({ ok: true, ...result });
}
