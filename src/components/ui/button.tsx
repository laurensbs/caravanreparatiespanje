import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: Mollie-style pill with subtle tactile feedback. Uses `active:scale`
  // so every button feels alive under a click/tap, while `transition-all`
  // picks up both the color and transform tween cleanly. Focus ring uses the
  // brand ring color (cyan) set in globals.css.
  // Note: on hover, any child `<svg>` with `.btn-arrow` slides slightly in the
  // direction of travel. This gives buttons with a trailing arrow / leading
  // chevron that classic "respond to your cursor" feel, without needing every
  // button to opt into a `group` utility (which would clash with cards).
  // Premium tactile pill — Stripe/Linear style. Slightly tighter radius,
  // crisp focus ring in the new amber accent, and a gentle 1px lift on
  // hover so the surface feels carved instead of stamped.
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium tracking-[-0.005em] transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:transition-transform hover:[&_svg.btn-arrow-right]:translate-x-0.5 hover:[&_svg.btn-arrow-left]:-translate-x-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_1px_2px_0_rgba(0,0,0,0.10)] hover:bg-primary/90 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.10)_inset,0_2px_8px_-2px_rgba(0,0,0,0.18)] hover:-translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/15 hover:-translate-y-px",
        outline:
          "border border-input bg-background shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] hover:bg-accent hover:text-accent-foreground hover:border-foreground/20",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] hover:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground underline-offset-4 decoration-foreground/30 hover:decoration-foreground hover:underline active:scale-100",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-9 rounded-lg px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
