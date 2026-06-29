import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field";

/** Input de texto (h-48, px-16) — réplica del "text input" de Figma. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldBase, "h-12 px-4 py-3", className)} {...props} />
  )
);
Input.displayName = "Input";
