import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const payload = await req.json();
  if (!payload?.title || !Array.isArray(payload?.questions) || payload.questions.length === 0) {
    return NextResponse.json({ error: "Falta título o preguntas." }, { status: 400 });
  }

  const sb = await getSupabaseServer();
  const { data, error } = await sb.rpc("create_exam", { p: payload });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ examId: data });
}
