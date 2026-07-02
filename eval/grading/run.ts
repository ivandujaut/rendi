import dotenv from "dotenv";

// Carga AI_GATEWAY_API_KEY desde .env.local (mismo patrón que playwright.config.ts). El
// cliente de IA lee la key al momento de llamar, así que basta con que esté cargada antes
// de correr las correcciones.
dotenv.config({ path: ".env.local" });

import { gradeOpenAnswer } from "@/lib/domain/grading";
import { fixtures, type Fixture } from "./fixtures";

// Harness de de-riesgo del corrector: corre gradeOpenAnswer sobre respuestas reales-ish y
// mide, de forma automática y floja, si el borrador va en la dirección correcta. La señal
// dura sigue siendo humana (leer los borradores, como hizo el docente) — por eso imprime el
// feedback completo de cada caso. El objetivo es responder "¿el modelo corrige bien lo
// determinístico y sabe frenar ante una figura?" ANTES de escribir schema/UI.
//
// Criterios automáticos por tipo de fixture:
// - correcta            → temas_flojos vacío (no inventa temas donde no hay error).
// - con-error           → temas_flojos intersecta los temas esperados (match por substring).
// - fuera-de-alcance    → el feedback avisa que no puede corregir la figura / falta el dato.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // saca tildes (diacríticos combinantes) para comparar

const FIGURE_HINTS = [
  "no puedo corregir",
  "no puedo evaluar",
  "sin el dato",
  "sin la figura",
  "no esta transcript",
  "dibuj",
  "a mano",
  "figura",
  "queda para el docente",
  "corrige el docente",
];

type Row = { fixture: Fixture; ok: boolean; detail: string; temas: string[]; feedback: string };

function scoreCorrecta(temas: string[]): { ok: boolean; detail: string } {
  return temas.length === 0
    ? { ok: true, detail: "sin temas flojos (correcto)" }
    : { ok: false, detail: `inventó temas en una respuesta correcta: [${temas.join(", ")}]` };
}

function scoreConError(temas: string[], esperados: string[]): { ok: boolean; detail: string } {
  const t = temas.map(norm);
  const hit = esperados.find((e) => t.some((x) => x.includes(norm(e)) || norm(e).includes(x)));
  return hit
    ? { ok: true, detail: `detectó el tema "${hit}"` }
    : { ok: false, detail: `no detectó ninguno de: [${esperados.join(", ")}]` };
}

function scoreFigura(feedback: string): { ok: boolean; detail: string } {
  const f = norm(feedback);
  return FIGURE_HINTS.some((h) => f.includes(norm(h)))
    ? { ok: true, detail: "avisó que no puede corregir la figura" }
    : { ok: false, detail: "no marcó que la respuesta depende de una figura no transcripta" };
}

async function runOne(fx: Fixture): Promise<Row> {
  const res = await gradeOpenAnswer({ enunciado: fx.enunciado, rubrica: fx.rubrica, respuesta: fx.respuesta });
  if (res.status === "failed") {
    return { fixture: fx, ok: false, detail: `IA falló: ${res.error}`, temas: [], feedback: "" };
  }
  const { feedback_borrador, temas_flojos } = res.grading;
  const scored =
    fx.expected.kind === "correcta"
      ? scoreCorrecta(temas_flojos)
      : fx.expected.kind === "con-error"
        ? scoreConError(temas_flojos, fx.expected.temas)
        : scoreFigura(feedback_borrador);
  return { fixture: fx, ...scored, temas: temas_flojos, feedback: feedback_borrador };
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error(
      "\n  ✗ Falta AI_GATEWAY_API_KEY en .env.local.\n" +
        "    Creá una key en el AI Gateway de Vercel (Dashboard → AI Gateway → API Keys) y agregala\n" +
        "    como AI_GATEWAY_API_KEY=... — no hace falta deployar la app para eso.\n",
    );
    process.exit(1);
  }

  console.log(`\n  Corriendo ${fixtures.length} fixtures del corrector (modelo vía AI Gateway)…\n`);

  // Secuencial a propósito: son pocas y así el output se lee ordenado.
  const rows: Row[] = [];
  for (const fx of fixtures) rows.push(await runOne(fx));

  for (const r of rows) {
    console.log(`  ${r.ok ? "✓" : "✗"}  ${r.fixture.id} — ${r.fixture.label}`);
    console.log(`      ${r.detail}`);
    if (r.temas.length) console.log(`      temas_flojos: [${r.temas.join(", ")}]`);
    if (r.feedback) console.log(`      feedback: ${r.feedback.replace(/\s+/g, " ").trim()}`);
    console.log();
  }

  const passed = rows.filter((r) => r.ok).length;
  console.log(`  ${passed}/${rows.length} pasaron el chequeo automático.`);
  console.log(
    "  (La señal fuerte es humana: leé cada 'feedback' como lo haría el docente — el criterio\n" +
      "   de éxito del diseño es ≥80% de borradores aprobables con edición menor o nula.)\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
