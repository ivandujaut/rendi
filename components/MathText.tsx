"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renderiza texto con matemática embebida. La prosa va tal cual; los fragmentos
 * entre `$…$` (inline) o `$$…$$` (display) se renderizan como ecuaciones con
 * KaTeX. Ej: "El empuje es $E = \rho\, V g$" → "El empuje es 𝐸 = ρ V g".
 *
 * La prosa se escapa (no inyectamos HTML del contenido) y KaTeX corre con
 * `throwOnError:false`: si un fragmento LaTeX está mal, se muestra en rojo en vez
 * de romper la página.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(src: string): string {
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
      return escapeHtml(p);
    })
    .join("");
}

export function MathText({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => toHtml(children ?? ""), [children]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
