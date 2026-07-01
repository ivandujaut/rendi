import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — design-system primitive (replica del set "Buttons" de Figma).
 * Variantes: primary (gradiente amarillo), secondary (blanco + borde),
 * ghost (text button). Estado disabled compartido. 4 tamaños.
 * Para usar como link: <Link className={buttonVariants({ variant })}>.
 */
const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center whitespace-nowrap font-sans font-semibold leading-[1.6] transition-[filter,background-color,border-color,color] outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:bg-none disabled:bg-grey-200 disabled:text-grey-600 disabled:border-transparent disabled:shadow-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "text-ink bg-[linear-gradient(195deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] hover:brightness-[0.97] active:brightness-95",
        accent:
          "text-white bg-[linear-gradient(195deg,#2f6fe0_0%,#2257d9_100%)] hover:brightness-[0.97] active:brightness-95",
        secondary:
          "text-ink bg-white border border-grey-100 shadow-[0_0_7.5px_rgba(0,0,0,0.05)] hover:bg-[#fafafa]",
        ghost: "text-grey-600 hover:text-ink hover:bg-grey-100",
      },
      size: {
        xs: "h-[30px] gap-1.5 rounded-lg px-2.5 text-xs [&_svg]:size-4",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px] [&_svg]:size-4",
        md: "h-10 gap-2 rounded-xl px-4 text-sm [&_svg]:size-5",
        lg: "h-12 gap-3 rounded-xl px-6 text-sm [&_svg]:size-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };
