import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[56px] w-full rounded-lg border border-input bg-card px-2.5 py-2 text-[13px] shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
