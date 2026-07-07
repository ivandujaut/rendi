"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renderiza texto con matemática embebida. La prosa va tal cual; los fragmentos
 * entre `$…$` (inline) o `$$…$$` (display) se renderizan como ecuaciones con
 * KaTeX. Ej: "El empuje es $E = \rho\, V g$" → "El empuje es 𝐸 = ρ V g".
 *
 * Modo por defecto (explicaciones): la prosa se ESCAPA (no inyectamos HTML del
 * contenido). Modo `html` (enunciados/opciones): la parte no-matemática se trata
 * como HTML confiable (los enunciados ya vienen con <sub>, <br>, etc., autorados
 * por el docente), igual que el `dangerouslySetInnerHTML` que reemplaza.
 *
 * KaTeX corre con `throwOnError:false`: si un fragmento LaTeX está mal, se muestra
 * en rojo en vez de romper la página.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(src: string, html: boolean): string {
  // Segmenta en $$...$$ (display) y $...$ (inline); el delimitador queda en el
  // resultado del split (grupo capturado) para poder distinguirlo.
  const parts = src.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return parts
    .map((p) => {
      if (p.length > 4 && p.startsWith("$$") && p.endsWith("$$")) {
        return katex.renderToString(p.slice(2, -2), { displayMode: true, throwOnError: false });
      }
      if (p.length > 2 && p.startsWith("$") && p.endsWith("$")) {
        return katex.renderToString(p.slice(1, -1), { displayMode: false, throwOnError: false });
      }
      return html ? p : escapeHtml(p);
    })
    .join("");
}

export function MathText({
  children,
  className,
  html = false,
}: {
  children: string;
  className?: string;
  /** Trata la parte no-matemática como HTML confiable (enunciados/opciones). */
  html?: boolean;
}) {
  const out = useMemo(() => toHtml(children ?? "", html), [children, html]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: out }} />;
}
