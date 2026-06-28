import Link from "next/link";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Exam } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  await ensureProfile();
  const sb = await getSupabaseServer();
  const { data: exams } = await sb
    .from("exams")
    .select("id, title, year, duration_min, shuffle, student_review, pass_mark")
    .eq("is_published", true)
    .order("year", { ascending: false });

  const list = (exams ?? []) as Exam[];

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">
        Simulacros disponibles
      </div>
      <h1 className="font-disp text-3xl text-ink mb-1">Elegí un examen para practicar</h1>
      <p className="text-[#5C6B7E] mb-8">
        Cada intento queda registrado para que tu profe siga tu progreso.
      </p>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-[#5C6B7E]">
          Todavía no hay simulacros publicados.
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((e) => (
            <Link key={e.id} href={`/exam/${e.id}`} className="card p-5 flex items-center justify-between hover:border-brand transition">
              <div>
                <div className="font-disp font-semibold text-lg text-ink">{e.title}</div>
                <div className="text-sm text-[#5C6B7E] font-mono mt-1">
                  {e.duration_min} min · opción múltiple A–E{e.year ? ` · ${e.year}` : ""}
                </div>
              </div>
              <span className="btn btn-primary">Rendir →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
