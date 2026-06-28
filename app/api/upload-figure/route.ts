import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "figs";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  // Solo docentes pueden subir figuras.
  const sb = await getSupabaseServer();
  const { data: prof } = await sb.from("profiles").select("role").maybeSingle();
  if (prof?.role !== "teacher") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "archivo requerido" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const name = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(name, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // figure_url se guarda como '<bucket>/<archivo>' (coincide con publicFigureUrl()).
  return NextResponse.json({ path: `${BUCKET}/${name}` });
}
