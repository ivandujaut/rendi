import Link from "next/link";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getStudyPlan } from "@/lib/domain/study-plan";
import { buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

export const dynamic = "force-dynamic";

const barColor = (pct: number) => (pct >= 40 ? "#D9912A" : "#D24B5E");

export default async function StudyPlanPage() {
  const { uid } = await requireOnboarded();
  const sb = await getSupabaseServer();
  const { mcqWeak, openWeak } = await getStudyPlan(sb, uid ?? "");
  const { data: rq } = await sb.rpc("get_review_queue", { p_limit: 100 });
  const reviewCount = rq?.length ?? 0;
  const nada = mcqWeak.length === 0 && openWeak.length === 0 && reviewCount === 0;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/exams" className="font-mono text-xs text-grey-600 hover:text-ink inline-flex items-center gap-1 mb-3">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
        Volver a los simulacros
      </Link>
      <h1 className="font-disp text-3xl text-ink mb-1">Tu plan de repaso</h1>
      <p className="text-[#656565] mb-8">
        Los temas donde conviene reforzar, juntando todos tus exámenes. Se actualiza solo a medida que rendís.
      </p>

      {reviewCount > 0 && (
        <Link
          href="/repasar"
          className="card p-6 mb-4 flex items-center gap-4 hover:border-brand transition"
        >
          <div className="flex-1">
            <h3 className="font-disp text-base text-ink mb-1">Repasar mis errores</h3>
            <p className="text-sm text-[#656565]">
              {reviewCount} {reviewCount === 1 ? "pregunta conceptual" : "preguntas conceptuales"} que fallaste.
              Re-practicalas hasta dominarlas.
            </p>
          </div>
          <span className={buttonVariants({ variant: "primary" })}>
            Repasar
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </span>
        </Link>
      )}

      {nada ? (
        <div className="card p-14 text-center text-[#656565]">
          <p className="text-ink font-disp text-lg mb-1">¡Vas bien!</p>
          No hay temas flojos por ahora. Rendí más simulacros y acá va a aparecer qué reforzar.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mcqWeak.length > 0 && (
            <div className="card p-6">
              <h3 className="font-disp text-base text-ink mb-1">Opción múltiple</h3>
              <p className="text-sm text-[#656565] mb-3">Temas donde tu porcentaje de aciertos quedó bajo.</p>
              <div>
                {mcqWeak.map((t) => (
                  <div key={t.topic} className="flex items-center gap-3 my-2">
                    <div className="w-48 text-sm text-ink2 shrink-0">{t.topic}</div>
                    <div className="flex-1 h-2.5 bg-[#f2f2f2] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${t.pct}%`, background: barColor(t.pct) }} />
                    </div>
                    <div className="font-mono text-xs text-[#656565] w-16 text-right">
                      {t.pct}% ({t.ok}/{t.tot})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openWeak.length > 0 && (
            <div className="card p-6">
              <h3 className="font-disp text-base text-ink mb-1">Desarrollo</h3>
              <p className="text-sm text-[#656565] mb-3">
                Temas que el docente marcó para repasar en tus respuestas de desarrollo.
              </p>
              <div className="flex flex-wrap gap-2">
                {openWeak.map((t) => (
                  <span
                    key={t.tema}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6C994] bg-[#FBF3E2] px-3 py-1 text-sm text-ink2"
                  >
                    {t.tema}
                    {t.count > 1 && <span className="font-mono text-xs text-amber2">×{t.count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <Link href="/exams" className={buttonVariants({ variant: "primary" })}>
          Ir a practicar
        </Link>
      </div>
    </main>
  );
}
