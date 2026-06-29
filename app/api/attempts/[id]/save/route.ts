import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

const LETTERS = ["A", "B", "C", "D", "E"];

/** Auto-guardado de una respuesta mientras el intento está abierto. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id: attemptId } = await params;
  const { question_id, choice } = await req.json();
  if (!question_id || !LETTERS.includes(choice)) {
    return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  }

  const sb = await getSupabaseServer();

  // El intento debe ser del usuario y seguir abierto.
  const { data: attempt } = await sb
    .from("attempts")
    .select("id, user_id, submitted_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) {
    return NextResponse.json({ error: "intento no encontrado" }, { status: 404 });
  }
  if (attempt.submitted_at) {
    return NextResponse.json({ error: "intento ya entregado" }, { status: 409 });
  }

  const { error } = await sb
    .from("responses")
    .upsert({ attempt_id: attemptId, question_id, choice }, { onConflict: "attempt_id,question_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
