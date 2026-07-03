import type { getSupabaseServer } from "@/lib/supabaseServer";
import type { PerTopic } from "@/lib/types";

// Plan de repaso del alumno ("remediar" del loop). Se COMPUTA al vuelo desde la data que
// ya existe — no hay tabla study_plans ni recompute: el histórico son los intentos, y el
// plan es una vista derivada, siempre al día. Dos fuentes de "temas flojos":
//   · MCQ: attempts.per_topic (ok/tot por tema) → flojo si el acumulado < UMBRAL.
//   · Desarrollo: ai_gradings.temas_flojos de las correcciones APROBADAS (la IA los marcó
//     y el docente los avaló) → se cuenta cuántas veces apareció cada tema.
// Los temas se canonicalizan (minúsculas / sin acentos / espacios) para juntar duplicados
// obvios; se muestra la grafía más frecuente. Sin vocabulario controlado (es el corte MVP).

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

const WEAK_THRESHOLD = 0.6; // < 60% de aciertos en un tema = flojo

export type WeakMcqTopic = { topic: string; ok: number; tot: number; pct: number };
export type WeakOpenTopic = { tema: string; count: number };
export type StudyPlan = { mcqWeak: WeakMcqTopic[]; openWeak: WeakOpenTopic[] };

const canon = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos (diacríticos combinantes)
    .replace(/\s+/g, " ")
    .trim();

// Acumula por clave canónica y recuerda la grafía original más frecuente para mostrar.
class Canonizer<T extends object> {
  private acc = new Map<string, { display: string; spellings: Map<string, number>; data: T }>();
  constructor(private init: () => T) {}
  add(original: string, merge: (data: T) => void) {
    const key = canon(original);
    if (!key) return;
    let e = this.acc.get(key);
    if (!e) {
      e = { display: original, spellings: new Map(), data: this.init() };
      this.acc.set(key, e);
    }
    const n = (e.spellings.get(original) ?? 0) + 1;
    e.spellings.set(original, n);
    if (n > (e.spellings.get(e.display) ?? 0)) e.display = original;
    merge(e.data);
  }
  entries() {
    return [...this.acc.values()].map((e) => ({ display: e.display, ...e.data }));
  }
}

/** Arma el plan de repaso acumulado del alumno a partir de sus intentos entregados. */
export async function getStudyPlan(sb: ServerClient, userId: string): Promise<StudyPlan> {
  // --- MCQ: per_topic de los intentos entregados del alumno ---
  const { data: attempts } = await sb
    .from("attempts")
    .select("per_topic")
    .eq("user_id", userId)
    .not("submitted_at", "is", null);

  const mcq = new Canonizer<{ ok: number; tot: number }>(() => ({ ok: 0, tot: 0 }));
  for (const a of attempts ?? []) {
    const pt = (a.per_topic ?? {}) as PerTopic;
    for (const [topic, v] of Object.entries(pt)) {
      if (!topic || !v?.tot) continue;
      mcq.add(topic, (d) => {
        d.ok += v.ok;
        d.tot += v.tot;
      });
    }
  }
  const mcqWeak: WeakMcqTopic[] = mcq
    .entries()
    .map((e) => ({ topic: e.display, ok: e.ok, tot: e.tot, pct: Math.round((100 * e.ok) / e.tot) }))
    .filter((t) => t.tot > 0 && t.ok / t.tot < WEAK_THRESHOLD)
    .sort((a, b) => a.pct - b.pct || b.tot - a.tot);

  // --- Desarrollo: temas_flojos de las correcciones aprobadas del alumno ---
  const { data: openRows } = await sb
    .from("open_responses")
    .select("attempts!inner(user_id), ai_gradings(temas_flojos, estado)")
    .eq("attempts.user_id", userId);

  const open = new Canonizer<{ count: number }>(() => ({ count: 0 }));
  for (const r of openRows ?? []) {
    const g = Array.isArray(r.ai_gradings) ? r.ai_gradings[0] : r.ai_gradings;
    if (!g || g.estado !== "approved") continue;
    for (const tema of g.temas_flojos ?? []) open.add(tema, (d) => (d.count += 1));
  }
  const openWeak: WeakOpenTopic[] = open
    .entries()
    .map((e) => ({ tema: e.display, count: e.count }))
    .sort((a, b) => b.count - a.count || a.tema.localeCompare(b.tema, "es"));

  return { mcqWeak, openWeak };
}
