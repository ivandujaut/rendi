export type Question = {
  id: string;
  number: number;
  topic: string | null;
  prompt: string;
  figure_url: string | null;
  options: string[];
  kind: "mcq" | "open";
};

export type Exam = {
  id: string;
  title: string;
  year: number | null;
  duration_min: number;
  shuffle: boolean;
  student_review: boolean;
  allow_back: boolean;
  pass_mark: number;
};

export type PerTopic = Record<string, { ok: number; tot: number }>;

export const LETTERS = ["A", "B", "C", "D", "E"] as const;

export function fmtClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function publicFigureUrl(path: string | null): string | null {
  if (!path) return null;
  // NEXT_PUBLIC_SUPABASE_URL directo (no vía lib/env.ts): este módulo lo importan
  // client components (ExamClient, ExamBuilder, TeacherDashboard), y lib/env.ts
  // valida SUPABASE_SERVICE_ROLE_KEY (secreto) al cargar — llevarlo al bundle del
  // navegador rompería esos componentes ahí (la var no existe en el cliente).
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${path}`;
}

export function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
