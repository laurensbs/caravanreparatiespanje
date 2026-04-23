"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS } from "@/types";

const PRIORITY_DOT_COLORS: Record<string, string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

interface PrioritySelectProps {
  value?: string;
  defaultValue?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  contentClassName?: string;
}

export function PrioritySelect({ value, defaultValue, name, onValueChange, className, contentClassName }: PrioritySelectProps) {
  return (
    <Select value={value} defaultValue={defaultValue} name={name} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
          <SelectItem key={val} value={val}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_COLORS[val] ?? "bg-muted-foreground/40"}`} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
