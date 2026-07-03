# Benchmark UX — experiencia del alumno al rendir (Parcialito)

> Investigación 2026-07-03. Objetivo: mejorar la experiencia del alumno al rendir
> (UX/UI, claridad, ansiedad, feedback). Se relevaron tres familias de productos y
> se cruzaron sus patrones contra el flujo real de Parcialito (runner + resultados
> + plan de repaso).

## Método
- **Test-prep / CBT serios:** SAT digital (Bluebook), UWorld, GMAT/GRE, Prometric, Pearson VUE, Magoosh, Khan (SAT oficial).
- **Quiz / engagement:** Duolingo, Brilliant, Quizlet, Khan Academy, Quizizz/Wayground, Kahoot.
- **Feedback / repaso:** Photomath/Symbolab (paso a paso), Anki (repetición espaciada).
- **Evidencia UX:** Cherif et al. *"Stress by Design?"* (Mensch und Computer 2025), WCAG 2.2, Nielsen Norman Group, guías de plataformas (Canvas/Moodle/ExamOnline), MathJax.

## Estado actual de Parcialito (baseline)
**Ya fuerte (validado por la evidencia):** autosave + reanudar intento, confirm de entrega que avisa las sin-responder, auto-entrega al vencer con reintento si falla, **desempeño por tema** (el feature de mayor impacto: >90% de alumnos lo valora, sube notas 10–20%), **revisión con respuesta correcta + explicación** (opt-in del docente), **corrección IA de desarrollo revisada por docente**, **plan de repaso**, indicador de progreso, modo lineal ya limpio.

**Gaps principales:** herramientas *durante* el examen, modo práctica, render de matemática, accesibilidad, y cerrar el loop error→repaso.

## Matriz: patrón → referencia → estado → movida

| Patrón | Referencia | Parcialito | Movida |
|---|---|---|---|
| Tachar opciones (strikethrough) | Bluebook, UWorld, Prometric | ❌ | Toggle reversible por opción A–E |
| Revisión antes de entregar (answered/unanswered/flagged) | Bluebook, Pearson VUE, GMAT | ~ (navegador + confirm sueltos) | Fusionar en pantalla de triage |
| Timer ocultable + avisos 10/1 min | Bluebook, Prometric | ~ (color, no ocultable, sin aviso) | Colapsar + toast/ARIA |
| Render de matemática (LaTeX) | Todos los STEM | ❌ (HTML crudo) | KaTeX — **crítico para física** |
| Hoja de fórmulas/constantes | Bluebook, GRE/GMAT | ~ (solo "g=10" en intro) | Panel plegable por examen |
| Modo Práctica vs Examen | UWorld, Magoosh, Quizizz | ❌ | Práctica = feedback + explicación por pregunta |
| Por qué cada opción incorrecta está mal | UWorld (su #1) | ~ (explicación general) | Rationale por distractor |
| Heat-map por tema clickeable → revisión | UWorld, Magoosh | ~ (barras no clickeables) | Tocar tema flojo → revisión filtrada |
| "Reintentar las que fallé / marqué" | UWorld, Magoosh, Quizizz | ❌ | Botón en resultados |
| Mapa de dominio por tema (Familiar→Dominado) | Khan | ~ (por intento) | Readiness acumulada entre intentos |
| Repetición espaciada de errores | Anki, Quizizz, Magoosh | ❌ | Alimentar el plan de repaso |
| Progreso en el tiempo / vs pares | UWorld, Magoosh | ❌ | Tendencia entre intentos |

## Roadmap priorizado

### 🟢 Quick wins (bajo esfuerzo, alto valor)
1. Tachar opciones en MCQ.
2. Revisión antes de entregar (triage answered/unanswered/flagged).
3. Timer ocultable + avisos a 10 y 1 min (texto+icono, no solo color).
4. Barras por tema clickeables → revisión filtrada.
5. "Reintentar las que fallé/marqué" desde resultados.
6. Examen demo/práctica sin nota (familiarización — reductor de ansiedad #1).

### 🟡 Transversal (calidad/confianza)
7. **KaTeX/MathJax** para matemática (zoom, overflow, sin layout shift, nunca imagen plana).
8. **Accesibilidad + mobile sweep:** no señalar solo por color; `aria-live` en avisos de tiempo; teclado + foco; contraste 4.5:1 en todos los estados; tipografía dislexia-friendly (≥16px, interlineado ≥1.5, alineado izq., 50–75 car.); targets A–E ≥44–48px; navegador como drawer en mobile.

### 🔴 Apuestas grandes
9. **Modo Práctica vs Examen** (feedback inmediato + explicación por pregunta en Práctica).
10. **Rationale por distractor** (por qué cada opción está mal — driver #1 de UWorld).
11. **Mapa de dominio acumulado + repetición espaciada** que alimente el plan de repaso (Anki/Khan/Magoosh).
12. **Paso a paso con revelado progresivo** para las de desarrollo (Photomath/Brilliant), enganchado a la corrección IA.

### ✨ Capa de engagement (antes/después, nunca durante el cronómetro)
13. Puntos de esfuerzo desacoplados del puntaje, objetivo diario indulgente, racha con "freeze" (Khan/Duolingo), ghost mode (superá tu intento anterior, Kahoot). Consenso: **no meter velocidad/ranking en lo de alto riesgo**.

## Si se hacen solo 5
Tachar opciones · Revisión-antes-de-entregar · KaTeX · Barras por tema clickeables → revisión · Modo Práctica.

## Notas de evidencia (anti-ansiedad)
- Cherif 2025: 1/3 de alumnos sienten ansiedad de examen; **30% dijo que la interfaz misma bajó su rendimiento**. El clutter correlaciona con impacto negativo; el examen demo previo es de los mayores reductores de ansiedad; la falta de "volver atrás" fue un estresor citado (avisarlo antes).
- WCAG 2.2.2: contenido que se auto-actualiza >5s debe poder pausarse/ocultarse (→ timer ocultable). SC 2.2.1: tiempo ajustable (accommodations 1.5×/2×).
- Nunca un auto-submit "sorpresa": avisar a intervalos.
- Resultados: encabezado claro + desglose por tema + revisión de errores con rationale + próximos pasos accionables; tono constructivo; percentil vs cohorte etiquetado como relativo.

## Fuentes
- Cherif et al., "Stress by Design?" (Mensch und Computer 2025): https://dl.acm.org/doi/10.1145/3743049.3748538
- WCAG SC 2.2.1: https://www.w3.org/TR/UNDERSTANDING-WCAG20/time-limits-required-behaviors.html
- NN/g Touch Targets: https://www.nngroup.com/articles/touch-target-size/
- Bluebook (College Board): https://bluebook.collegeboard.org/students
- UWorld features: https://medical.uworld.com/usmle/features/
- Quizizz/Wayground game settings: https://forbusiness-help.wayground.com/support/solutions/articles/158000411033-game-settings-for-quizzes
- Kahoot Accuracy/Ghost mode: https://support.kahoot.com/hc/en-us/articles/39818967108627-Accuracy-experience-How-to-host-a-kahoot
- Khan Mastery: https://support.khanacademy.org/hc/en-us/articles/5548760867853
- Anki/FSRS: https://faqs.ankiweb.net/what-spaced-repetition-algorithm
- MathJax a11y: https://docs.mathjax.org/en/latest/basic/accessibility.html
