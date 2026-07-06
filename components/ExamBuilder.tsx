"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LETTERS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Cancel01Icon, Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons";

type Q = {
  topic: string;
  prompt: string;
  options: string[]; // hasta 5
  correct: string; // 'A'..'E'
  explanation: string; // justificación opcional (se muestra en la revisión)
  nature: "conceptual" | "numeric"; // conceptual (definición/razonamiento) vs numérica (cálculo)
  figure_url: string | null;
  figureName: string | null;
  uploading?: boolean;
};

const emptyQ = (): Q => ({ topic: "", prompt: "", options: ["", "", "", "", ""], correct: "A", explanation: "", nature: "conceptual", figure_url: null, figureName: null });

export type ExamBuilderInitial = {
  title: string; year: string; durationMin: string; shuffle: boolean;
  studentReview: boolean; allowBack: boolean; isPublished: boolean; passMark: string; questions: Q[];
};

export default function ExamBuilder({ examId, initial, hasAttempts = false }: {
  examId?: string; initial?: ExamBuilderInitial; hasAttempts?: boolean;
} = {}) {
  const router = useRouter();
  const editing = !!examId;
  const questionsLocked = editing && hasAttempts; // no se pueden cambiar preguntas con intentos
  const [title, setTitle] = useState(initial?.title ?? "");
  const [year, setYear] = useState<string>(initial?.year ?? String(new Date().getFullYear()));
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? "40");
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? true);
  const [studentReview, setStudentReview] = useState(initial?.studentReview ?? false);
  const [allowBack, setAllowBack] = useState(initial?.allowBack ?? true);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [passMark, setPassMark] = useState(initial?.passMark ?? "60");
  const [questions, setQuestions] = useState<Q[]>(initial?.questions ?? [emptyQ()]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i: number, k: number, val: string) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? val : o)) } : q)));

  const addQ = () => setQuestions((qs) => [...qs, emptyQ()]);
  const delQ = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));

  async function uploadFigure(i: number, file: File) {
    setQ(i, { uploading: true });
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-figure", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir");
      setQ(i, { figure_url: data.path, figureName: file.name, uploading: false });
    } catch (e) {
      setQ(i, { uploading: false });
      setError(`Figura pregunta ${i + 1}: ${e instanceof Error ? e.message : "Error"}`);
    }
  }

  function importJson() {
    setError("");
    try {
      const raw = JSON.parse(importText);
      const arr = Array.isArray(raw) ? raw : raw.questions;
      if (!Array.isArray(arr)) throw new Error("El JSON debe ser un arreglo de preguntas o {questions:[...]}.");
      // El JSON pegado a mano viene con forma libre y alias de campo (prompt/text,
      // correct/ans); tipar esto de verdad es la validación con Zod que queda
      // pendiente (ver docs/PLAN.md, ST1) — acá solo normalizamos.
      const mapped: Q[] = arr.map((q: any) => {
        const opts = (q.options || q.opts || []).map((s: any) => String(s));
        while (opts.length < 5) opts.push("");
        return {
          topic: q.topic || "",
          prompt: q.prompt || q.text || "",
          options: opts.slice(0, 5),
          correct: String(q.correct || q.ans || "A").toUpperCase(),
          explanation: q.explanation || q.justification || "",
          nature: q.nature === "numeric" ? "numeric" : "conceptual",
          figure_url: q.figure_url || null,
          figureName: q.figure_url ? "(referenciada)" : null,
        };
      });
      if (mapped.length === 0) throw new Error("No se encontraron preguntas.");
      setQuestions(mapped);
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      setError("Import: " + (e instanceof Error ? e.message : "Error"));
    }
  }

  function buildPayload() {
    const qs = questions.map((q, i) => {
      const trimmed = q.options.map((o) => o.trim());
      let last = -1;
      trimmed.forEach((o, k) => { if (o) last = k; });
      // sin huecos antes de la ultima opcion
      for (let k = 0; k <= last; k++) if (!trimmed[k]) throw new Error(`Pregunta ${i + 1}: hay una opción vacía entre las demás.`);
      const options = trimmed.slice(0, last + 1);
      if (options.length < 2) throw new Error(`Pregunta ${i + 1}: cargá al menos 2 opciones.`);
      if (!q.prompt.trim()) throw new Error(`Pregunta ${i + 1}: falta el enunciado.`);
      const ci = (LETTERS as readonly string[]).indexOf(q.correct);
      if (ci < 0 || ci >= options.length) throw new Error(`Pregunta ${i + 1}: la respuesta correcta (${q.correct}) no corresponde a una opción cargada.`);
      return { number: i + 1, topic: q.topic.trim() || null, prompt: q.prompt.trim(), explanation: q.explanation.trim() || null, nature: q.nature, figure_url: q.figure_url, options, correct: q.correct };
    });
    return {
      title: title.trim(),
      year: year ? Number(year) : null,
      duration_min: Number(durationMin) || 40,
      shuffle, student_review: studentReview, allow_back: allowBack, is_published: isPublished,
      pass_mark: Number(passMark) || 60,
      questions: qs,
    };
  }

  async function save() {
    setError("");
    if (!title.trim()) { setError("Poné un título al simulacro."); return; }
    let payload: ReturnType<typeof buildPayload>;
    try { payload = buildPayload(); } catch (e) { setError(e instanceof Error ? e.message : "Error"); return; }
    // Con preguntas bloqueadas (examen con intentos) no se envían: no se pueden cambiar.
    const { questions, ...withoutQuestions } = payload;
    void questions; // extraída solo para omitirla del body cuando corresponde
    const body = questionsLocked ? withoutQuestions : payload;
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/exams/${examId}` : "/api/exams", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      router.push(`/teacher?exam=${editing ? examId : data.examId}`);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 flex-1">{editing ? "Editar simulacro" : "Nuevo simulacro"}</div>
        {!questionsLocked && (
          <Button variant="secondary" onClick={() => setImportOpen((v) => !v)}><HugeiconsIcon icon={Upload01Icon} />Importar JSON</Button>
        )}
      </div>
      <h1 className="font-disp text-2xl text-ink mb-5">{editing ? "Editar simulacro" : "Cargar un simulacro"}</h1>

      {questionsLocked && (
        <div className="card p-4 mb-5 border-l-4 border-l-[#ffbb00] text-sm text-grey-600">
          Este simulacro ya tiene intentos registrados, así que <b className="text-ink">no se pueden modificar las preguntas</b> (cambiarlas alteraría la corrección de quienes ya rindieron). Sí podés editar los datos generales de abajo.
        </div>
      )}

      {importOpen && (
        <div className="card p-4 mb-5">
          <p className="text-sm text-[#656565] mb-2">
            Pegá un arreglo de preguntas. Acepta los campos <code className="font-mono">topic, prompt/text, options/opts, correct/ans, figure_url</code>.
          </p>
          <Textarea className="font-mono h-40" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{"topic":"Química","prompt":"...","options":["...","..."],"correct":"C"}]' />
          <div className="mt-2"><Button variant="primary" onClick={importJson}>Cargar preguntas</Button></div>
        </div>
      )}

      {/* Metadatos */}
      <div className="card p-5 mb-5 grid md:grid-cols-2 gap-4">
        <Field label="Título" className="md:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Simulacro 2 de Mecánica y energía" />
        </Field>
        <Field label="Año"><Input value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        <Field label="Duración (min)"><Input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></Field>
        <Field label="Nota de aprobación (%)"><Input value={passMark} onChange={(e) => setPassMark(e.target.value)} /></Field>
        <div className="flex flex-col gap-2.5 justify-end text-sm">
          <button type="button" onClick={() => setShuffle(!shuffle)} className="flex items-center gap-2 text-left cursor-pointer">
            <Checkbox checked={shuffle} /> Barajar preguntas
          </button>
          <button type="button" onClick={() => setStudentReview(!studentReview)} className="flex items-center gap-2 text-left cursor-pointer">
            <Checkbox checked={studentReview} /> Mostrar revisión al alumno
          </button>
          <button type="button" onClick={() => setAllowBack(!allowBack)} className="flex items-center gap-2 text-left cursor-pointer">
            <Checkbox checked={allowBack} /> Permitir volver a preguntas anteriores
          </button>
          <button type="button" onClick={() => setIsPublished(!isPublished)} className="flex items-center gap-2 text-left cursor-pointer">
            <Checkbox checked={isPublished} /> Publicar (visible para alumnos)
          </button>
        </div>
      </div>

      {/* Preguntas */}
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono font-bold text-cyan2">N.º {String(i + 1).padStart(2, "0")}</span>
              <Input value={q.topic} onChange={(e) => setQ(i, { topic: e.target.value })} placeholder="Tema (ej. Física: Fluidos)" className="ml-auto h-9 w-44 px-3 text-xs" disabled={questionsLocked} />
              {!questionsLocked && questions.length > 1 && <button className="text-red2 text-sm px-2" onClick={() => delQ(i)} title="Eliminar"><HugeiconsIcon icon={Cancel01Icon} size={16} /></button>}
            </div>
            <Textarea className="h-20 mb-3" value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Enunciado (admite HTML simple: <sub>, <sup>)" disabled={questionsLocked} />
            <div className="grid gap-2 mb-3">
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="font-mono text-xs w-6 text-center text-[#656565]">{LETTERS[k]}</span>
                  <Input value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Opción ${LETTERS[k]}${k >= 2 ? " (opcional)" : ""}`} disabled={questionsLocked} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2">Correcta:
                <div className="w-20">
                  <Select className="h-9 text-sm" value={q.correct} onChange={(e) => setQ(i, { correct: e.target.value })} disabled={questionsLocked}>
                    {LETTERS.map((L) => <option key={L} value={L}>{L}</option>)}
                  </Select>
                </div>
              </label>
              <label className="flex items-center gap-2">
                Tipo:
                <div className="w-36">
                  <Select
                    className="h-9 text-sm"
                    value={q.nature}
                    onChange={(e) => setQ(i, { nature: e.target.value as "conceptual" | "numeric" })}
                    disabled={questionsLocked}
                  >
                    <option value="conceptual">Conceptual</option>
                    <option value="numeric">Numérica</option>
                  </Select>
                </div>
              </label>
              {!questionsLocked ? (
                <label className="flex items-center gap-2 cursor-pointer text-grey-600 hover:text-ink">
                  {q.uploading ? "Subiendo…" : q.figureName ? <><HugeiconsIcon icon={Image01Icon} size={16} />{q.figureName}</> : <><HugeiconsIcon icon={PlusSignIcon} size={16} />Figura (opcional)</>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFigure(i, e.target.files[0])} />
                </label>
              ) : q.figureName ? (
                <span className="flex items-center gap-2 text-grey-600"><HugeiconsIcon icon={Image01Icon} size={16} />{q.figureName}</span>
              ) : null}
              {!questionsLocked && q.figure_url && <button className="text-xs text-[#656565] underline" onClick={() => setQ(i, { figure_url: null, figureName: null })}>quitar</button>}
            </div>
            <Textarea
              className="mt-3 h-16 text-[13px]"
              value={q.explanation}
              onChange={(e) => setQ(i, { explanation: e.target.value })}
              placeholder="Explicación / justificación (opcional, se muestra al alumno en la revisión)"
              disabled={questionsLocked}
            />
          </div>
        ))}
      </div>

      {!questionsLocked && (
        <Button variant="secondary" className="w-full my-4" onClick={addQ}><HugeiconsIcon icon={PlusSignIcon} />Agregar pregunta</Button>
      )}

      {error && <p className="text-red2 text-sm mb-3">{error}</p>}
      <div className="flex gap-3 pb-10 mt-4">
        <Button variant="secondary" onClick={() => router.push("/teacher")}>Cancelar</Button>
        <Button variant="primary" className="flex-1" onClick={save} loading={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : `Guardar simulacro (${questions.length} preguntas)`}
        </Button>
      </div>
    </main>
  );
}
