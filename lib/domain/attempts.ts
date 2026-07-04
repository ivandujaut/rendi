import type { getSupabaseServer } from "@/lib/supabaseServer";
import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ApiError, dbError } from "@/lib/api/errors";

// Capa de dominio de "intentos": la lógica de negocio que antes vivía inline en
// los route handlers. Las rutas quedan finas (guard → validar → dominio →
// responder). Los errores de regla de negocio se expresan como ApiError (mapea
// 1:1 a la respuesta HTTP); es un acoplamiento chico y pragmático para este
// tamaño de proyecto — si hiciera falta, se cambia por errores de dominio propios.

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;
type AdminClient = ReturnType<typeof getSupabaseAdmin>;

const VALID_CHOICES = ["A", "B", "C", "D", "E"] as const;
export type Choice = (typeof VALID_CHOICES)[number];

/**
 * Inicia un intento (o reanuda el en curso) para un alumno en un examen.
 * Reglas: el examen debe estar publicado y asignado al alumno; si ya hay un
 * intento sin entregar se reanuda (no se reinicia el reloj); si no, se crea uno
 * nuevo salvo que ya haya agotado los intentos habilitados.
 */
export async function startOrResumeAttempt(
  sb: ServerClient,
  examId: string,
  userId: string,
  mode: "exam" | "practice" = "exam",
) {
  const { data: exam } = await sb
    .from("exams")
    .select("id, duration_min")
    .eq("id", examId)
    .eq("is_published", true)
    .maybeSingle();
  if (!exam) throw new ApiError(404, "examen no disponible");

  const { data: assignment } = await sb
    .from("exam_assignments")
    .select("attempts_allowed")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!assignment) throw new ApiError(403, "Este examen no está habilitado para vos.");

  // Reanudar un intento en curso si existe (evita reiniciar el reloj).
  const { data: existing } = await sb
    .from("attempts")
    .select("id, started_at")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .eq("mode", mode)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let attemptId = existing?.id;
  let startedAt = existing?.started_at;

  if (!existing) {
    // La práctica es ilimitada; el límite de intentos solo aplica al examen con nota.
    if (mode === "exam") {
      const { count } = await sb
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", examId)
        .eq("user_id", userId)
        .eq("mode", "exam")
        .not("submitted_at", "is", null);
      if ((count ?? 0) >= assignment.attempts_allowed) {
        throw new ApiError(403, "Ya rendiste este examen.");
      }
    }

    const { data: created, error } = await sb
      .from("attempts")
      .insert({ exam_id: examId, user_id: userId, mode })
      .select("id, started_at")
      .single();
    if (error) dbError("crear intento", error, "No se pudo iniciar el examen");
    attemptId = created!.id;
    startedAt = created!.started_at;
  }

  // Invariante: a esta altura siempre hay un intento (existente o recién creado).
  if (!attemptId || !startedAt) throw new ApiError(500, "no se pudo crear el intento");

  const { data: responses } = await sb
    .from("responses")
    .select("question_id, choice")
    .eq("attempt_id", attemptId);

  // Respuestas de desarrollo ya autoguardadas (para restaurar el textarea al reanudar).
  const { data: openResponses } = await sb
    .from("open_responses")
    .select("question_id, answer_text")
    .eq("attempt_id", attemptId);

  return {
    attemptId,
    startedAt,
    durationMin: exam.duration_min,
    responses: responses ?? [],
    openResponses: openResponses ?? [],
  };
}

/**
 * Modo Práctica: registra la PRIMERA respuesta del alumno a una pregunta (sin
 * pisar si ya respondió, para una señal honesta) y devuelve la correcta +
 * explicación para el feedback inmediato. Corre con service-role: la clave nunca
 * viaja al cliente y se valida que el intento sea del alumno y de práctica.
 */
export async function answerPractice(
  admin: AdminClient,
  userId: string,
  attemptId: string,
  questionId: string,
  choice: Choice,
) {
  const { data: attempt } = await admin
    .from("attempts")
    .select("user_id, exam_id, mode, submitted_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) throw new ApiError(404, "intento inexistente");
  if (attempt.mode !== "practice") throw new ApiError(400, "solo disponible en modo práctica");
  if (attempt.submitted_at) throw new ApiError(409, "práctica ya cerrada");

  // La pregunta debe ser del examen del intento (no filtrar claves de otros exámenes).
  const { data: q } = await admin
    .from("questions")
    .select("exam_id, explanation")
    .eq("id", questionId)
    .maybeSingle();
  if (!q || q.exam_id !== attempt.exam_id) throw new ApiError(404, "pregunta inexistente");

  // Primera respuesta: no pisa si ya existe (señal honesta para el docente).
  const { error: insErr } = await admin
    .from("responses")
    .upsert(
      { attempt_id: attemptId, question_id: questionId, choice },
      { onConflict: "attempt_id,question_id", ignoreDuplicates: true },
    );
  if (insErr) dbError("registrar respuesta de práctica", insErr);

  const { data: key } = await admin
    .from("answer_keys")
    .select("correct")
    .eq("question_id", questionId)
    .maybeSingle();
  const correct = key?.correct ?? null;
  return { correct, is_correct: correct != null && choice === correct, explanation: q.explanation ?? null };
}

/** Auto-guardado de una respuesta (el choice ya viene validado por la ruta). */
export async function saveResponse(sb: ServerClient, attemptId: string, questionId: string, choice: Choice) {
  const { error } = await sb
    .from("responses")
    .upsert({ attempt_id: attemptId, question_id: questionId, choice }, { onConflict: "attempt_id,question_id" });
  if (error) dbError("auto-guardar respuesta", error);
}

/**
 * Auto-guardado de una respuesta de desarrollo mientras el intento está abierto. Texto
 * vacío borra la fila (no persiste un desarrollo en blanco, que si no la IA "corregiría").
 */
export async function saveOpenResponse(sb: ServerClient, attemptId: string, questionId: string, answerText: string) {
  const text = answerText.trim();
  if (text === "") {
    const { error } = await sb
      .from("open_responses")
      .delete()
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId);
    if (error) dbError("borrar respuesta de desarrollo", error);
    return;
  }
  const { error } = await sb.from("open_responses").upsert(
    { attempt_id: attemptId, question_id: questionId, answer_text: text, updated_at: new Date().toISOString() },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) dbError("auto-guardar respuesta de desarrollo", error);
}

/**
 * Entrega y corrige un intento. Aplica el reloj autoritativo (marca `auto` si se
 * pasó del tiempo), guarda las respuestas válidas (filtrando choices inválidos en
 * vez de confiar en el body) y corre la corrección server-side. Devuelve el
 * puntaje/desglose de `grade_attempt`.
 */
export async function submitAttempt(
  sb: ServerClient,
  attempt: { id: string; started_at: string; exam_id: string },
  responses: { question_id: string; choice: string }[] | undefined,
  auto: boolean | undefined,
  openResponses?: { question_id: string; answer_text: string }[],
) {
  const { data: exam } = await sb.from("exams").select("duration_min").eq("id", attempt.exam_id).single();
  const elapsedSec = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
  const overtime = elapsedSec > (exam?.duration_min ?? 40) * 60 + 5; // 5s de gracia

  const rows = (responses ?? [])
    .filter(
      (r): r is { question_id: string; choice: Choice } =>
        !!r?.question_id && (VALID_CHOICES as readonly string[]).includes(r?.choice),
    )
    .map((r) => ({ attempt_id: attempt.id, question_id: r.question_id, choice: r.choice }));

  if (rows.length > 0) {
    const { error } = await sb.from("responses").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) dbError("guardar respuestas al entregar", error);
  }

  // Respuestas de desarrollo (kind='open'): van a su propia tabla (no a `responses`,
  // char(1) MCQ-only). Se filtran las vacías para no encolar correcciones de IA en balde.
  // La corrección con IA la hace el cron async (no bloquea la entrega).
  const openRows = (openResponses ?? [])
    .filter((r) => !!r?.question_id && typeof r?.answer_text === "string" && r.answer_text.trim() !== "")
    .map((r) => ({
      attempt_id: attempt.id,
      question_id: r.question_id,
      answer_text: r.answer_text.trim(),
      updated_at: new Date().toISOString(),
    }));

  if (openRows.length > 0) {
    const { error } = await sb.from("open_responses").upsert(openRows, { onConflict: "attempt_id,question_id" });
    if (error) dbError("guardar respuestas de desarrollo al entregar", error);
  }

  // Marcar entrega automática si corresponde.
  await sb.from("attempts").update({ auto: !!auto || overtime }).eq("id", attempt.id);

  // Corrección server-side (la función lee la clave sin devolverla).
  const { data: graded, error } = await sb.rpc("grade_attempt", { p_attempt: attempt.id });
  if (error) dbError("corregir intento", error, "No se pudo corregir el examen");

  return Array.isArray(graded) ? graded[0] : graded;
}
