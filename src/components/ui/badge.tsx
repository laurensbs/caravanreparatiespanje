import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-px text-[11px] font-medium tracking-[-0.005em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:ring-offset-1 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-transparent bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10]",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
        destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline: "border-border text-foreground hover:bg-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
