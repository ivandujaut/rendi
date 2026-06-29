import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field";

/** Textarea (Description de Figma) — multilínea con resize vertical. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(fieldBase, "min-h-20 resize-y px-4 py-3", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";
