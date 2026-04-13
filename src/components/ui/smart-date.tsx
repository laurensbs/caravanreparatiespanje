"use client";

import { format, isThisYear, isToday, isYesterday, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

interface SmartDateProps {
  date: Date | string;
  className?: string;
}

function formatSmart(d: Date): string {
  const now = new Date();
  const mins = differenceInMinutes(now, d);
  const hours = differenceInHours(now, d);
  const days = differenceInDays(now, d);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24 && isToday(d)) return `${hours}h ago`;
  if (isYesterday(d)) return "Yesterday";
  if (days < 7) return `${days}d ago`;
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
