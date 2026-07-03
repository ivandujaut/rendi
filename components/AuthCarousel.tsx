"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, Tick02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";

const SLIDES = [
  {
    icon: StarIcon,
    title: "Simulacros de verdad",
    body: "Practicá con exámenes al estilo de la competencia OATec, con su mismo formato y tiempos.",
  },
  {
    icon: Tick02Icon,
    title: "Corrección al instante",
    body: "Cronómetro, autoguardado y tu puntaje apenas entregás. Sin esperar a nadie.",
  },
  {
    icon: UserGroupIcon,
    title: "Hecho con tu profe",
    body: "Tu docente habilita los simulacros de tu comisión y sigue tu progreso de cerca.",
  },
];

const INTERVAL = 5000;

/** Panel de marca con un carrusel de propuesta de valor (auto-rotación + dots). */
export function AuthCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[i];

  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] p-8 lg:p-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Marca de agua: la p firma en blanco, translúcida */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-p-white.svg"
        alt=""
        className="pointer-events-none absolute -right-10 -top-14 h-[19rem] w-auto select-none opacity-25 lg:-right-12 lg:-top-20 lg:h-[26rem]"
      />

      {/* Panel amarillo: variante tinta. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-ink.svg" alt="parcialito" className="h-5 w-auto opacity-80" />

      <div className="relative">
        <div className="mb-6 grid size-12 place-items-center rounded-xl bg-ink/10 text-ink">
          <HugeiconsIcon icon={slide.icon} size={26} />
        </div>
        {/* key fuerza el re-fade en cada cambio de slide */}
        <div key={i} className="animate-[fadeIn_.5s_ease]">
          <h2 className="font-disp text-3xl leading-tight text-ink mb-3 max-w-sm">{slide.title}</h2>
          <p className="text-ink/80 max-w-sm leading-relaxed">{slide.body}</p>
        </div>
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label="Propuesta de valor">
        {SLIDES.map((s, idx) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={idx === i}
            aria-label={s.title}
            onClick={() => setI(idx)}
            className={
              "h-1.5 rounded-full transition-all " +
              (idx === i ? "w-7 bg-ink/80" : "w-1.5 bg-ink/25 hover:bg-ink/40")
            }
          />
        ))}
      </div>
    </div>
  );
}
