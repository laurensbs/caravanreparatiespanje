"use client";

import { format, isThisYear, isToday, isYesterday } from "date-fns";

interface SmartDateProps {
  date: Date | string;
  className?: string;
}

function formatSmart(d: Date): string {
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "HH:mm")}`;
  if (isThisYear(d)) return format(d, "d MMM");
  return format(d, "d MMM yyyy");
}

export function SmartDate({ date, className }: SmartDateProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const full = format(d, "d MMMM yyyy, HH:mm");

  return (
    <time dateTime={d.toISOString()} title={full} className={className}>
      {formatSmart(d)}
    </time>
  );
}
