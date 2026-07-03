import { buttonVariants } from "@/components/ui/button";
import { WaitlistForm } from "@/components/WaitlistForm";
import { LandingNav } from "@/components/LandingNav";
import { FaqAccordion } from "@/components/FaqAccordion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  AlarmClockIcon,
  Analytics01Icon,
  BulbIcon,
  Tick02Icon,
  Cancel01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

const FEATURES = [
  {
    icon: AlarmClockIcon,
    title: "Recuperás tus horas",
    body: "Diseñás las preguntas una vez, las subís y la corrección la hace Parcialito. El tiempo que perdías corrigiendo, ahora es tuyo.",
  },
  {
    icon: Analytics01Icon,
    title: "Ves todo en tiempo real",
    body: "Sabés qué temas vienen flojos a medida que el curso rinde. Llegás a la próxima clase sabiendo qué reforzar.",
  },
  {
    icon: BulbIcon,
    title: "Cada alumno aprende en el momento",
    body: "Apenas responde, ve si acertó y por qué la correcta era otra. Aprende ahí, no tres días después.",
  },
];

const PROBLEMS = [
  "Fotocopias para cada alumno de cada curso, y el costo sale de tu bolsillo.",
  "Corregís pilas a mano y la nota llega días después.",
  "Te enterás de qué tema falló el curso recién cuando corregís.",
  "Los chicos llegan verdes, sin saber en qué están flojos.",
];

const SOLUTIONS = [
  "Cargás el simulacro una vez y Parcialito corrige solo.",
  "Cada alumno ve al instante si acertó y por qué.",
  "Mirás en tiempo real qué temas hay que reforzar.",
  "Cero papel y cero costo por alumno.",
];

const STEPS = [
  { title: "Cargás tu simulacro", body: "Tus preguntas y tus respuestas, una sola vez." },
  { title: "Lo habilitás a tu curso", body: "Cada alumno entra desde su celular o su notebook." },
  { title: "Mirás las estadísticas", body: "Quién rindió, en qué falló el grupo y qué tema cuesta más." },
];

const FAQS = [
  { q: "¿Cuánto cuesta?", a: "Durante la beta es gratis para docentes." },
  { q: "¿Tengo que aprender algo nuevo?", a: "Si ya armás preguntas, ya sabés usar Parcialito. Las cargás una vez y el sistema corrige solo." },
  { q: "¿Qué pasa con los datos de mis alumnos?", a: "Guardamos solo lo necesario para saber quién rindió y cómo le fue. Nada más." },
  { q: "¿Sirve solo para la OATec?", a: "Nació para la OATec, pero lo podés usar para cualquier evaluación del aula." },
];

export function Landing() {
  return (
    <main className="bg-[#FFFCF5]">
      {/* Header + hero (réplica del frame del Figma: navbar y blob amarillo
          en la misma sección, el círculo sangra arriba-derecha detrás del
          navbar con la R blanca encima) */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute -top-40 -right-24 size-[600px] rounded-full bg-[linear-gradient(160deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)]" />
          {/* p firma gigante en blanco sobre el círculo (como la letra firma del hero de referencia) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-p-white.svg" alt="" className="absolute -top-8 right-16 h-[34rem] w-auto select-none" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4">
          <LandingNav />
          <div className="max-w-xl py-16 lg:py-28">
            <p className="font-mono text-xs tracking-widest uppercase text-[#2257d9] mb-4">
              Para docentes de secundaria
            </p>
            <h1 className="font-disp font-bold text-4xl sm:text-5xl leading-[1.1] text-ink mb-5">
              Tus alumnos viven en la <span className="text-yellow">pantalla</span>. Vos, entre fotocopias y pilas para corregir.
            </h1>
            <p className="text-lg font-semibold text-[#656565] leading-relaxed mb-8 max-w-lg">
              Tus alumnos practican desde el celular y Parcialito corrige solo. Vos ves al instante
              en qué tema está flojo cada uno.
            </p>
            <a href="#waitlist" className={buttonVariants({ variant: "accent", size: "lg" })}>
              Sumate a la lista de espera
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </a>
            <p className="mt-4 text-sm text-grey-600">
              Hecho por un docente que ya lo usa con sus alumnos rumbo a la OATec.
            </p>
          </div>
        </div>
      </section>

      {/* Beneficios — layout editorial (título a la izquierda, lista a la derecha),
          en vez de la grilla simétrica de 3 cards */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-disp font-bold text-3xl sm:text-4xl text-ink mb-3">Cero fotocopias. Cero horas corrigiendo.</h2>
              <p className="text-[#656565] text-lg leading-relaxed">
                Cargás tus preguntas una vez. Parcialito corrige y te muestra en qué falla el curso.
              </p>
            </div>
            <div className="divide-y divide-grey-100">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-5 py-6 first:pt-0 last:pb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-grey-100 text-ink">
                    <HugeiconsIcon icon={f.icon} size={24} />
                  </div>
                  <div>
                    <h3 className="font-disp font-bold text-lg text-ink mb-1">{f.title}</h3>
                    <p className="text-[#656565] leading-relaxed">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diferencial destacado (única pieza resaltada; rompe el patrón) */}
          <div className="mt-12 card flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:p-8">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cyan2/10 text-cyan2">
              <HugeiconsIcon icon={SparklesIcon} size={28} />
            </div>
            <div>
              <h3 className="font-disp font-bold text-lg text-ink mb-1">Y lo más inesperado: quieren volver a rendir</h3>
              <p className="text-[#656565] leading-relaxed">
                Tus alumnos lo viven como un juego, no como un examen. Se animan a equivocarse,
                entienden por qué y piden revancha.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-disp font-bold text-3xl text-ink text-center mb-3">Empezás en tres pasos</h2>
          <p className="text-[#656565] text-center mb-12">
            Sin instalar nada. Si ya armás preguntas, ya sabés usar Parcialito.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[linear-gradient(160deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] font-disp text-lg font-bold text-ink">
                  {i + 1}
                </div>
                <h3 className="font-disp font-bold text-lg text-ink mb-1">{s.title}</h3>
                <p className="text-[#656565]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lista de espera */}
      <section id="waitlist" className="bg-[#eef4fe] py-20 scroll-mt-20">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="font-disp font-bold text-3xl text-ink text-center mb-2">Sumate a la lista de espera</h2>
          <p className="text-[#656565] text-center mb-8">
            Estamos abriendo Parcialito de a poco. Dejanos tus datos y te avisamos apenas te toque.
          </p>
          <WaitlistForm />
          <p className="text-center font-mono text-xs text-grey-600 mt-6">
            Hecho por un docente, para el aula real.
          </p>
        </div>
      </section>

      {/* Por qué */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-disp font-bold text-3xl text-ink text-center mb-12">¿Por qué construimos Parcialito?</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Problema */}
            <div className="card p-7">
              <p className="font-mono text-xs uppercase tracking-widest text-grey-600 mb-5">El problema</p>
              <ul className="grid gap-4">
                {PROBLEMS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-ink">
                    <span className="mt-0.5 shrink-0 text-[#d24b5e]">
                      <HugeiconsIcon icon={Cancel01Icon} size={20} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            {/* Solución */}
            <div className="card p-7">
              <p className="font-mono text-xs uppercase tracking-widest text-grey-600 mb-5">Con Parcialito</p>
              <ul className="grid gap-4">
                {SOLUTIONS.map((s) => (
                  <li key={s} className="flex items-start gap-3 text-ink">
                    <span className="mt-0.5 shrink-0 text-[#23925f]">
                      <HugeiconsIcon icon={Tick02Icon} size={20} />
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Banner de origen (dos columnas, como el Figma: título con palabras
              clave en blanco a la izquierda + relato con frases en negrita a la derecha) */}
          <div className="mt-5 rounded-[1.5rem] bg-[linear-gradient(160deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] p-8 sm:p-12 lg:grid lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-12">
            <h2 className="font-disp font-bold text-3xl sm:text-4xl text-ink mb-4 lg:mb-0">
              Lo construimos para <span className="text-white">cambiar eso</span>.
            </h2>
            <p className="text-ink/80 leading-relaxed">
              Parcialito nació en mi aula: los chicos <b className="font-semibold text-ink">vivían en la pantalla mientras yo evaluaba en papel</b>.
              Cuando llevé la práctica a su mundo, pasó algo que no esperaba: se soltaron, lo vieron
              como un juego y <b className="font-semibold text-ink">querían volver a intentarlo</b>.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-disp font-bold text-3xl text-ink text-center mb-10">Preguntas frecuentes</h2>
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-disp font-bold text-3xl text-ink mb-3">¿Te suena? Probalo con tu curso.</h2>
          <p className="text-[#656565] mb-8">
            Sumate a la lista y entrá entre los primeros docentes.
          </p>
          <a href="#waitlist" className={buttonVariants({ variant: "accent", size: "lg" })}>
            Sumate a la lista de espera
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-[#f2f2f2]">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-disp text-xl font-bold tracking-tight">
            <span className="text-yellow">R</span>endi
          </span>
          <span className="font-mono text-xs text-grey-300">
            © 2026 Parcialito · Práctica para la competencia OATec
          </span>
        </div>
      </footer>
    </main>
  );
}
