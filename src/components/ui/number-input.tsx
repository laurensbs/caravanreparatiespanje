"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Number input with stepper buttons. Wraps a normal `<input type="number">`
 * but with two thin +/− buttons on the right that respect `step`, `min`,
 * `max`, and `disabled`. Behaviour:
 *  - Click ±: parse current value, clamp, fire onChange like a real input.
 *  - Hold ±: after 350ms repeats every 60ms (gets faster after 2s).
 *  - Scroll wheel: only steps when the input is focused (intentional —
 *    accidental scroll-step is the worst UX in spreadsheets).
 */
export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    { value, onChange, step = 1, min, max, className, disabled, ...rest },
    ref,
  ) {
    const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const repeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

    function clamp(n: number) {
      if (typeof min === "number" && n < min) return min;
      if (typeof max === "number" && n > max) return max;
      // Round to step precision to avoid floating-point fuzz.
      const decimals = (step.toString().split(".")[1] ?? "").length;
      return Number(n.toFixed(decimals));
    }

    function bump(direction: 1 | -1) {
      const current = typeof value === "number" ? value : parseFloat(String(value)) || 0;
      onChange(clamp(current + direction * step));
    }

    function startHold(direction: 1 | -1) {
      if (disabled) return;
      bump(direction);
      holdTimer.current = setTimeout(() => {
        let interval = 60;
        let elapsed = 0;
        repeatTimer.current = setInterval(() => {
          bump(direction);
          elapsed += interval;
          if (elapsed > 2000 && interval > 25) {
            // Speed up after 2s of holding.
            interval = 25;
            if (repeatTimer.current) clearInterval(repeatTimer.current);
            repeatTimer.current = setInterval(() => bump(direction), interval);
          }
        }, interval);
      }, 350);
    }

    function endHold() {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (repeatTimer.current) clearInterval(repeatTimer.current);
      holdTimer.current = null;
      repeatTimer.current = null;
    }

    React.useEffect(() => endHold, []);

    return (
      <div className={cn("relative inline-flex w-full items-stretch", className)}>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value === "" ? 0 : parseFloat(e.target.value);
            if (!Number.isNaN(next)) onChange(clamp(next));
          }}
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-card px-3 pr-9 text-[13px] tabular-nums shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-all duration-150",
            "placeholder:text-muted-foreground/70 hover:border-foreground/20",
            "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          {...rest}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (typeof max === "number" && Number(value) >= max)}
            aria-label="Increase"
            onMouseDown={() => startHold(1)}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={() => startHold(1)}
            onTouchEnd={endHold}
            className="pointer-events-auto flex h-1/2 w-8 items-center justify-center rounded-tr-lg border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-30"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (typeof min === "number" && Number(value) <= min)}
            aria-label="Decrease"
            onMouseDown={() => startHold(-1)}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={() => startHold(-1)}
            onTouchEnd={endHold}
            className="pointer-events-auto flex h-1/2 w-8 items-center justify-center rounded-br-lg border-l border-t border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-30"
          >
            <Minus className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  },
);
