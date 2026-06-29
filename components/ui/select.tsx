import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field";

/** Select nativo estilizado (dropdown de Figma) con chevron a la derecha. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select ref={ref} className={cn(fieldBase, "h-12 appearance-none pl-4 pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-grey-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
);
Select.displayName = "Select";
