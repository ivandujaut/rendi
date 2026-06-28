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

  if (existing) {
    return NextResponse.json({
      attemptId: existing.id,
      startedAt: existing.started_at,
      durationMin: exam.duration_min,
    });
  }

  const { data: created, error } = await sb
    .from("attempts")
    .insert({ exam_id: examId, user_id: userId })
    .select("id, started_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    attemptId: created.id,
    startedAt: created.started_at,
    durationMin: exam.duration_min,
  });
}
