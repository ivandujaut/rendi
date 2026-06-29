import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge / chip — estandariza los pills de la app (% por alumno/tema, chip de
 * tema). Variantes semánticas + outline. Base mono, redondeado pill.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-xs",
  {
    variants: {
      variant: {
        muted: "bg-grey-100 text-grey-600",
        success: "bg-[#e7f4ec] text-[#1c7a4d]",
        warning: "bg-[#fbf1dd] text-[#9a6a14]",
        danger: "bg-[#fbe7ea] text-[#a83545]",
        outline: "border border-grey-100 uppercase tracking-wide text-grey-500",
      },
    },
    defaultVariants: { variant: "muted" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Mapea un porcentaje (0-100 | null) a la variante semántica del badge. */
export function pctBadgeVariant(p: number | null): "muted" | "success" | "warning" | "danger" {
  if (p == null) return "muted";
  if (p >= 70) return "success";
  if (p >= 40) return "warning";
  return "danger";
}

export { badgeVariants };
