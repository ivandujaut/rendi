"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LETTERS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Cancel01Icon, Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons";

type Q = {
  topic: string;
  prompt: string;
  options: string[]; // hasta 5
  correct: string; // 'A'..'E'
  explanation: string; // justificación opcional (se muestra en la revisión)
  figure_url: string | null;
  figureName: string | null;
  uploading?: boolean;
};

const emptyQ = (): Q => ({ topic: "", prompt: "", options: ["", "", "", "", ""], correct: "A", explanation: "", figure_url: null, figureName: null });

export default function ExamBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [durationMin, setDurationMin] = useState("40");
  const [shuffle, setShuffle] = useState(true);
  const [studentReview, setStudentReview] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [passMark, setPassMark] = useState("60");
  const [questions, setQuestions] = useState<Q[]>([emptyQ()]);
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
    } catch (e: any) {
      setQ(i, { uploading: false });
      setError(`Figura pregunta ${i + 1}: ${e.message}`);
    }
  }

  function importJson() {
    setError("");
    try {
      const raw = JSON.parse(importText);
      const arr = Array.isArray(raw) ? raw : raw.questions;
      if (!Array.isArray(arr)) throw new Error("El JSON debe ser un arreglo de preguntas o {questions:[...]}.");
      const mapped: Q[] = arr.map((q: any) => {
        const opts = (q.options || q.opts || []).map((s: any) => String(s));
        while (opts.length < 5) opts.push("");
        return {
          topic: q.topic || "",
          prompt: q.prompt || q.text || "",
          options: opts.slice(0, 5),
          correct: String(q.correct || q.ans || "A").toUpperCase(),
          explanation: q.explanation || q.justification || "",
          figure_url: q.figure_url || null,
          figureName: q.figure_url ? "(referenciada)" : null,
        };
      });
      if (mapped.length === 0) throw new Error("No se encontraron preguntas.");
      setQuestions(mapped);
      setImportOpen(false);
      setImportText("");
    } catch (e: any) {
      setError("Import: " + e.message);
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
      const ci = LETTERS.indexOf(q.correct as any);
      if (ci < 0 || ci >= options.length) throw new Error(`Pregunta ${i + 1}: la respuesta correcta (${q.correct}) no corresponde a una opción cargada.`);
      return { number: i + 1, topic: q.topic.trim() || null, prompt: q.prompt.trim(), explanation: q.explanation.trim() || null, figure_url: q.figure_url, options, correct: q.correct };
    });
    return {
      title: title.trim(),
      year: year ? Number(year) : null,
      duration_min: Number(durationMin) || 40,
      shuffle, student_review: studentReview, is_published: isPublished,
      pass_mark: Number(passMark) || 60,
      questions: qs,
    };
  }

  async function save() {
    setError("");
    if (!title.trim()) { setError("Poné un título al simulacro."); return; }
    let payload;
    try { payload = buildPayload(); } catch (e: any) { setError(e.message); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      router.push(`/teacher?exam=${data.examId}`);
    } catch (e: any) {
      setSaving(false);
      setError(e.message);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 flex-1">Nuevo simulacro</div>
        <Button variant="secondary" onClick={() => setImportOpen((v) => !v)}><HugeiconsIcon icon={Upload01Icon} />Importar JSON</Button>
      </div>
      <h1 className="font-disp text-2xl text-ink mb-5">Cargar un simulacro</h1>

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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Simulacro 2 — Mecánica y energía" />
        </Field>
        <Field label="Año"><Input value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        <Field label="Duración (min)"><Input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></Field>
        <Field label="Nota de aprobación (%)"><Input value={passMark} onChange={(e) => setPassMark(e.target.value)} /></Field>
        <div className="flex flex-col gap-2 justify-end text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Barajar preguntas</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={studentReview} onChange={(e) => setStudentReview(e.target.checked)} /> Mostrar revisión al alumno</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> Publicar (visible para alumnos)</label>
        </div>
      </div>

      {/* Preguntas */}
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono font-bold text-cyan2">N.º {String(i + 1).padStart(2, "0")}</span>
              <Input value={q.topic} onChange={(e) => setQ(i, { topic: e.target.value })} placeholder="Tema (ej. Física: Fluidos)" className="ml-auto h-9 w-44 px-3 text-xs" />
              {questions.length > 1 && <button className="text-red2 text-sm px-2" onClick={() => delQ(i)} title="Eliminar"><HugeiconsIcon icon={Cancel01Icon} size={16} /></button>}
            </div>
            <Textarea className="h-20 mb-3" value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Enunciado (admite HTML simple: <sub>, <sup>)" />
            <div className="grid gap-2 mb-3">
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="font-mono text-xs w-6 text-center text-[#656565]">{LETTERS[k]}</span>
                  <Input value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Opción ${LETTERS[k]}${k >= 2 ? " (opcional)" : ""}`} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2">Correcta:
                <select className="rounded-lg border border-grey-100 bg-white px-2 py-1 text-sm" value={q.correct} onChange={(e) => setQ(i, { correct: e.target.value })}>
                  {LETTERS.map((L) => <option key={L} value={L}>{L}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-grey-600 hover:text-ink">
                {q.uploading ? "Subiendo…" : q.figureName ? <><HugeiconsIcon icon={Image01Icon} size={16} />{q.figureName}</> : <><HugeiconsIcon icon={PlusSignIcon} size={16} />Figura (opcional)</>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFigure(i, e.target.files[0])} />
              </label>
              {q.figure_url && <button className="text-xs text-[#656565] underline" onClick={() => setQ(i, { figure_url: null, figureName: null })}>quitar</button>}
            </div>
            <Textarea
              className="mt-3 h-16 text-[13px]"
              value={q.explanation}
              onChange={(e) => setQ(i, { explanation: e.target.value })}
              placeholder="Explicación / justificación (opcional, se muestra al alumno en la revisión)"
            />
          </div>
        ))}
      </div>

      <Button variant="secondary" className="w-full my-4" onClick={addQ}><HugeiconsIcon icon={PlusSignIcon} />Agregar pregunta</Button>

      {error && <p className="text-red2 text-sm mb-3">{error}</p>}
      <div className="flex gap-3 pb-10">
        <Button variant="secondary" onClick={() => router.push("/teacher")}>Cancelar</Button>
        <Button variant="primary" className="flex-1" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : `Guardar simulacro (${questions.length} preguntas)`}
        </Button>
      </div>
    </main>
  );
}
