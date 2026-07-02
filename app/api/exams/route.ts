import { NextResponse } from "next/server";
import { z } from "zod";
import { route, dbError } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";
import type { Json } from "@/lib/db.types";

// El cliente (ExamBuilder) valida la forma completa; acá solo el envelope.
const bodySchema = z.object({ title: z.string().min(1), questions: z.array(z.unknown()).min(1) }).passthrough();

export const POST = route(async (req) => {
  const { sb } = await requireTeacher();
  const payload = await parseBody(req, bodySchema);

  const { data, error } = await sb.rpc("create_exam", { p: payload as Json });
  if (error) dbError("create_exam", error, "No se pudo guardar el simulacro");

  return NextResponse.json({ examId: data });
});
