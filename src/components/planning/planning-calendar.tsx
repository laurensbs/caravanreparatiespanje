"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, Globe, Filter, Plus, MapPin, User, Wrench, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS, PRIORITY_COLORS, STATUS_LABELS } from "@/types";
import type { RepairStatus, Priority } from "@/types";
import { type PlanningLang, getLocaleStrings, formatWeekRange } from "@/lib/planning-locale";
import { getPlannedRepairs, scheduleRepair, type PlannedRepair } from "@/actions/planning";
import { AddRepairDialog } from "./add-repair-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";

// Location → dot color mapping
const LOCATION_COLORS: Record<string, string> = {};
const LOCATION_DOT_PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-purple-500", "bg-rose-500", "bg-cyan-500",
  "bg-lime-500", "bg-orange-500",
];
function getLocationDot(locationId: string | null): string {
  if (!locationId) return "bg-gray-400";
  if (!LOCATION_COLORS[locationId]) {
    const idx = Object.keys(LOCATION_COLORS).length % LOCATION_DOT_PALETTE.length;
    LOCATION_COLORS[locationId] = LOCATION_DOT_PALETTE[idx];
  }
  return LOCATION_COLORS[locationId];
}

function repairStatusLabel(status: string): string {
  const s = status as RepairStatus;
  return STATUS_LABELS[s] ?? status.replace(/_/g, " ");
}

interface Props {
  initialRepairs: PlannedRepair[];
  initialWeekStart: string;
  initialWeekEnd: string;
  staff: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function PlanningCalendar({ initialRepairs, initialWeekStart, initialWeekEnd, staff, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [repairs, setRepairs] = useState(initialRepairs);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekEnd, setWeekEnd] = useState(initialWeekEnd);
  const [lang, setLang] = useState<PlanningLang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("planning-lang") as PlanningLang) || "en";
    }
    return "en";
  });
  const [filterUser, setFilterUser] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date | null>(null);
  const [dragRepairId, setDragRepairId] = useState<string | null>(null);

  const t = getLocaleStrings(lang);
  const monday = new Date(weekStart);
  const ariaPrevWeek = lang === "nl" ? "Vorige week" : lang === "es" ? "Semana anterior" : "Previous week";
  const ariaNextWeek = lang === "nl" ? "Volgende week" : lang === "es" ? "Siguiente semana" : "Next week";

  function changeLang(newLang: PlanningLang) {
    setLang(newLang);
    if (typeof window !== "undefined") localStorage.setItem("planning-lang", newLang);
  }

  function navigateWeek(offset: number) {
    const newMonday = new Date(monday);
    newMonday.setDate(newMonday.getDate() + offset * 7);
    newMonday.setHours(0, 0, 0, 0);
    const newSunday = new Date(newMonday);
    newSunday.setDate(newMonday.getDate() + 6);
    newSunday.setHours(23, 59, 59, 999);
    const start = newMonday.toISOString();
    const end = newSunday.toISOString();
    setWeekStart(start);
    setWeekEnd(end);
    startTransition(async () => {
      const data = await getPlannedRepairs(start, end);
      setRepairs(data);
    });
  }

  function goToThisWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    const start = mon.toISOString();
    const end = sun.toISOString();
    setWeekStart(start);
    setWeekEnd(end);
    startTransition(async () => {
      const data = await getPlannedRepairs(start, end);
      setRepairs(data);
    });
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const todayStr = new Date().toDateString();

  const filteredRepairs = filterUser === "all"
    ? repairs
    : repairs.filter((r) => r.assignedUserId === filterUser);

  function repairsForDay(dayIndex: number) {
    const dayDate = days[dayIndex];
    return filteredRepairs
      .filter((r) => {
        const d = new Date(r.dueDate);
        return d.getDate() === dayDate.getDate()
          && d.getMonth() === dayDate.getMonth()
          && d.getFullYear() === dayDate.getFullYear();
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  function handleDragStart(e: React.DragEvent, repairId: string) {
    e.dataTransfer.setData("text/plain", repairId);
    e.dataTransfer.effectAllowed = "move";
    setDragRepairId(repairId);
  }

  function handleDragEnd() { setDragRepairId(null); }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const handleDrop = useCallback((e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    const repairId = e.dataTransfer.getData("text/plain");
    if (!repairId) return;
    setDragRepairId(null);
    const targetDate = new Date(days[dayIndex]);
    targetDate.setHours(8, 0, 0, 0);
    const iso = targetDate.toISOString();
    setRepairs((prev) => prev.map((r) => (r.id === repairId ? { ...r, dueDate: targetDate } : r)));
    startTransition(async () => {
      try {
        await scheduleRepair(repairId, iso);
      } catch {
        toast.error("Failed to reschedule");
        const data = await getPlannedRepairs(weekStart, weekEnd);
        setRepairs(data);
      }
    });
  }, [days, weekStart, weekEnd]);

  const usedLocationIds = [...new Set(filteredRepairs.map((r) => r.locationId).filter(Boolean))] as string[];
  const locationLegend = usedLocationIds.map((id) => ({
    id,
    name: locations.find((l) => l.id === id)?.name ?? "?",
    dot: getLocationDot(id),
  }));

  function openAddDialog(dayIndex: number) {
    const d = new Date(days[dayIndex]);
    d.setHours(8, 0, 0, 0);
    setAddDialogDate(d);
    setAddDialogOpen(true);
  }

  async function onRepairAdded() {
    setAddDialogOpen(false);
    const data = await getPlannedRepairs(weekStart, weekEnd);
    setRepairs(data);
  }

  const totalCount = filteredRepairs.length;

  return (
    <DashboardPageCanvas>
      <div className="space-y-6 print:space-y-2 sm:space-y-8">
        {/* Title + subtitle + controls (mobile-first) */}
        <div className="space-y-4 print:hidden sm:space-y-5">
          <DashboardPageHeader
            eyebrow="Schedule"
            title={t.planning}
            metadata={
              <>
                <span className="tabular-nums">{formatWeekRange(new Date(weekStart), new Date(weekEnd), lang)}</span>
                {totalCount > 0 ? (
                  <span>
                    <span className="tabular-nums text-gray-700 dark:text-gray-200">{totalCount}</span> scheduled
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">empty week</span>
                )}
                {isPending ? (
                  <span className="animate-pulse text-gray-400 dark:text-gray-500">{t.searching}</span>
                ) : null}
              </>
            }
            description={t.pageSubtitle}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-0 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-l-xl rounded-r-none text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                onClick={() => navigateWeek(-1)}
                aria-label={ariaPrevWeek}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="border-x border-gray-100 dark:border-gray-800 px-3 h-10 inline-flex items-center text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer" onClick={goToThisWeek}>
                {t.thisWeek}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-r-xl rounded-l-none text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                onClick={() => navigateWeek(1)}
                aria-label={ariaNextWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-10 w-full min-[400px]:w-[min(100%,11rem)] rounded-xl border-gray-100 bg-white text-sm shadow-sm touch-manipulation dark:border-gray-800 dark:bg-white/[0.03]">
                  <Filter className="mr-1 h-3.5 w-3.5 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allStaff}</SelectItem>
                  {staff.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={lang} onValueChange={(v) => changeLang(v as PlanningLang)}>
                <SelectTrigger className="h-10 w-full min-[400px]:w-24 rounded-xl border-gray-100 bg-white text-sm shadow-sm touch-manipulation dark:border-gray-800 dark:bg-white/[0.03]">
                  <Globe className="mr-1 h-3.5 w-3.5 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="nl">NL</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full gap-2 rounded-xl border-gray-100 bg-white text-sm shadow-sm touch-manipulation min-[400px]:w-auto dark:border-gray-800 dark:bg-white/[0.03]"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 shrink-0" />
                {t.print}
              </Button>

              <Link
                href="/repairs"
                className="hidden sm:inline-flex h-10 items-center rounded-xl px-3 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                {t.browseWorkOrders} →
              </Link>
            </div>
          </div>

          <p className="hidden text-xs text-gray-500 md:block dark:text-gray-400">{t.dragHint}</p>
        </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-center mb-1">{t.planning}</h1>
        <p className="text-center text-sm text-gray-600 mb-4">
          {formatWeekRange(new Date(weekStart), new Date(weekEnd), lang)}
          {filterUser !== "all" && ` — ${staff.find(u => u.id === filterUser)?.name}`}
        </p>
      </div>

      {/* Location legend */}
      {locationLegend.length > 0 && (
        <div className={cn(dashboardPanelClass, "px-4 py-3 print:hidden")}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t.location}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
            {locationLegend.map((l) => (
              <span key={l.id} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
                {l.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day list */}
      <div className="space-y-3 print:space-y-4 sm:space-y-4">
        {days.map((day, dayIdx) => {
          const dayRepairs = repairsForDay(dayIdx);
          const isToday = day.toDateString() === todayStr;
          const isEmpty = dayRepairs.length === 0;

          return (
            <div
              key={dayIdx}
              className={cn(
                dashboardPanelClass,
                "group/day animate-slide-up overflow-hidden transition-all duration-200 print:break-inside-avoid print:border-gray-300",
                isToday &&
                  "ring-2 ring-sky-500/20 dark:ring-sky-400/25",
                dragRepairId && "hover:border-gray-300 dark:hover:border-gray-600",
                isEmpty && "print:hidden",
              )}
              style={{ animationDelay: `${Math.min(dayIdx * 30, 180)}ms`, animationFillMode: "backwards" }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dayIdx)}
            >
              {/* Day header */}
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-3 transition-colors print:border-gray-300",
                  !isEmpty && "border-b border-gray-100 dark:border-gray-800",
                  isToday
                    ? "bg-sky-50/40 dark:bg-sky-500/[0.06]"
                    : isEmpty
                      ? "bg-transparent"
                      : "bg-gray-50/50 dark:bg-white/[0.02]",
                )}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t.days[dayIdx]}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100",
                    )}
                  >
                    {day.getDate()} {t.months[day.getMonth()]}
                  </span>
                  {isToday ? (
                    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      Today
                    </span>
                  ) : null}
                  {dayRepairs.length > 0 ? (
                    <Badge
                      variant="secondary"
                      className="h-5 rounded-full px-2 text-[10px] font-semibold print:hidden dark:bg-gray-800 dark:text-gray-200"
                    >
                      {dayRepairs.length}
                    </Badge>
                  ) : (
                    <span className="text-[12px] text-gray-400 dark:text-gray-500">
                      {t.noRepairsScheduled}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-2.5 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 touch-manipulation print:hidden dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100",
                    isEmpty && "opacity-60 group-hover/day:opacity-100",
                  )}
                  onClick={() => openAddDialog(dayIdx)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t.addRepair}
                </Button>
              </div>

              {/* Repairs */}
              {!isEmpty && (
                <div className="divide-y divide-gray-100 print:divide-gray-200 dark:divide-gray-800">
                  {dayRepairs.map((r) => (
                    <RepairRow
                      key={r.id}
                      repair={r}
                      lang={lang}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={dragRepairId === r.id}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddRepairDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        targetDate={addDialogDate}
        lang={lang}
        onAdded={onRepairAdded}
      />
      </div>
    </DashboardPageCanvas>
  );
}

// ─── Compact Repair Row ───

function RepairRow({
  repair,
  lang,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  repair: PlannedRepair;
  lang: PlanningLang;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const t = getLocaleStrings(lang);
  const locDot = getLocationDot(repair.locationId);
  const time = new Date(repair.dueDate);
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
  const priorityDot = PRIORITY_COLORS[repair.priority as Priority]?.split(" ")[0] ?? "bg-gray-300";

  return (
    <Link
      href={`/repairs/${repair.id}`}
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(e, repair.id); }}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex min-h-[3.25rem] cursor-grab touch-manipulation items-start gap-3 px-4 py-3.5 transition-all duration-150 active:cursor-grabbing print:min-h-0 print:cursor-default print:py-2",
        "hover:bg-gray-50/90 active:bg-gray-100/80 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]",
        isDragging && "opacity-40",
      )}
    >
      {/* Drag handle + time */}
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 print:hidden" />
        <span className="text-xs font-mono text-muted-foreground w-10 print:font-bold print:text-black">{timeStr}</span>
      </div>

      {/* Location dot + priority */}
      <div className="flex items-center gap-1 shrink-0 pt-1 print:hidden">
        <span className={`h-2 w-2 rounded-full ${locDot}`} />
        <span className={`h-2 w-2 rounded-full ${priorityDot}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {repair.title ?? repair.publicCode ?? "—"}
          </span>
          {repair.publicCode && (
            <span className="hidden shrink-0 font-mono text-[10px] text-gray-400 tabular-nums sm:inline dark:text-gray-500">
              #{repair.publicCode}
            </span>
          )}
          <Badge className={`${STATUS_COLORS[repair.status as RepairStatus] ?? "bg-muted text-muted-foreground"} rounded-full text-[9px] px-1.5 py-0 shrink-0 print:hidden`}>
            {repairStatusLabel(repair.status)}
          </Badge>
        </div>

        {/* Meta: customer, unit, location */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 print:text-gray-600 dark:text-gray-400">
          {repair.customerName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 print:hidden" />
              {repair.customerName}
            </span>
          )}
          {repair.unitInfo && (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3 print:hidden" />
              {repair.unitInfo}
            </span>
          )}
          {repair.locationName && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 print:hidden" />
              {repair.locationName}
            </span>
          )}
          {repair.assignedUserName && (
            <span className="print:hidden">→ {repair.assignedUserName}</span>
          )}
        </div>

        {/* Description: truncated on screen, full on print */}
        {repair.descriptionRaw && (
          <>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 print:hidden">
              {repair.descriptionRaw}
            </p>
            <p className="hidden print:block text-xs text-gray-700 mt-1 whitespace-pre-line">
              {repair.descriptionRaw}
            </p>
          </>
        )}

        {/* Print-only extra info */}
        <div className="hidden print:flex items-center gap-3 text-xs text-gray-500 mt-0.5">
          {repair.locationName && <span>📍 {repair.locationName}</span>}
          {repair.assignedUserName && <span>👤 {repair.assignedUserName}</span>}
          {repair.estimatedHours && <span>⏱ {repair.estimatedHours}h</span>}
        </div>
      </div>
    </Link>
  );
}
