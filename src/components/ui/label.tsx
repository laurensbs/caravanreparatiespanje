"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-[12px] font-medium leading-none tracking-[-0.005em] text-foreground/90 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  /** Marks the field as required — shows a subtle * after the label. */
  required?: boolean;
  /** Optional inline hint text after the label, e.g. "(min 8)" */
  hint?: React.ReactNode;
}

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, hint, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), "inline-flex items-baseline gap-1", className)}
    {...props}
  >
    <span>{children}</span>
    {required ? (
      <span aria-hidden className="text-destructive/70">
        *
      </span>
    ) : null}
    {hint ? (
      <span className="text-[11px] font-normal text-muted-foreground/80">{hint}</span>
    ) : null}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

/** Field error / hint slot — pairs with Label for sub-input messages. */
export function FieldHint({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "error" | "success";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-1 text-[11px] leading-relaxed transition-colors",
        tone === "muted" && "text-muted-foreground",
        tone === "error" && "text-destructive",
        tone === "success" && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {children}
    </p>
  );
}

export { Label };
