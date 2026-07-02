import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { route, dbError, ApiError } from "@/lib/api/errors";
import { requireTeacher } from "@/lib/api/guards";

const BUCKET = "figs";

export const POST = route(async (req) => {
  // Solo docentes suben figuras.
  await requireTeacher();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "archivo requerido");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const name = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(name, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) dbError("subir figura", error, "No se pudo subir la figura");

  // figure_url se guarda como '<bucket>/<archivo>' (coincide con publicFigureUrl()).
  return NextResponse.json({ path: `${BUCKET}/${name}` });
});
