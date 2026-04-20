"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, Filter, Plus, MapPin, User, Wrench, GripVertical, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS, PRIORITY_COLORS, STATUS_LABELS } from "@/types";
import type { RepairStatus, Priority } from "@/types";
import { type PlanningLang, getLocaleStrings, formatWeekRange } from "@/lib/planning-locale";
import {
  getPlannedRepairs,
  scheduleRepair,
  SCHEDULE_NEEDS_TASKS,
  type PlannedRepair,
} from "@/actions/planning";
import { AddRepairDialog } from "./add-repair-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

// Location → dot color mapping
const LOCATION_COLORS: Record<string, string> = {};
const LOCATION_DOT_PALETTE = [
  "bg-amber-500", "bg-emerald-500", "bg-rose-500",
  "bg-violet-500", "bg-orange-500", "bg-indigo-500",
  "bg-teal-500", "bg-stone-500",
];
function getLocationDot(locationId: string | null): string {
  if (!locationId) return "bg-muted-foreground/40";
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
  const [isPending, startTransition] = useTransition();
  const [repairs, setRepairs] = useState(initialRepairs);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekEnd, setWeekEnd] = useState(initialWeekEnd);
  // Planning UI is English-only — the language switcher was removed to
  // keep the toolbar tidy and match the rest of the admin panel. The
  // `lang` variable is kept (widened to the full union) so existing
  // locale-dependent branches elsewhere in this file keep compiling
  // without churn, even though only "en" is reachable.
  const lang: PlanningLang = "en" as PlanningLang;
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date | null>(null);
  const [dragRepairId, setDragRepairId] = useState<string | null>(null);

  const t = getLocaleStrings(lang);
  const monday = new Date(weekStart);
  const ariaPrevWeek = lang === "nl" ? "Vorige week" : lang === "es" ? "Semana anterior" : "Previous week";
  const ariaNextWeek = lang === "nl" ? "Volgende week" : lang === "es" ? "Siguiente semana" : "Next week";

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

  const filteredRepairs = repairs
    .filter((r) => filterUser === "all" || r.assignedUserId === filterUser)
    .filter((r) => filterLocation === "all" || r.locationId === filterLocation);

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

  // ── dnd-kit: touch + pointer + keyboard sensors ──
  // Pointer requires 6px activation distance so quick taps (links) don't
  // start a drag. Touch uses a 200ms long-press to keep page scroll
  // natural on mobile. Keyboard enables WCAG-compliant reordering.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleDndStart(event: DragStartEvent) {
    setDragRepairId(String(event.active.id));
  }

  function handleDndEnd(event: DragEndEvent) {
    setDragRepairId(null);
    const { active, over } = event;
    if (!over) return;
    const repairId = String(active.id);
    const overId = String(over.id);
    if (!overId.startsWith("day-")) return;
    const dayIndex = Number(overId.slice(4));
    if (!Number.isFinite(dayIndex) || dayIndex < 0 || dayIndex > 6) return;

    const currentRepair = repairs.find((r) => r.id === repairId);
    if (!currentRepair) return;
    const currentTime = new Date(currentRepair.dueDate);

    const targetDate = new Date(days[dayIndex]);
    // Preserve the time portion of the original dueDate; only the day moves.
    targetDate.setHours(
      currentTime.getHours() || 8,
      currentTime.getMinutes(),
      0,
      0,
    );

    // If the repair already sits on that day, no-op.
    if (
      targetDate.getFullYear() === currentTime.getFullYear() &&
      targetDate.getMonth() === currentTime.getMonth() &&
      targetDate.getDate() === currentTime.getDate()
    ) {
      return;
    }

    const iso = targetDate.toISOString();
    // Optimistic update.
    setRepairs((prev) =>
      prev.map((r) => (r.id === repairId ? { ...r, dueDate: targetDate } : r)),
    );
    startTransition(async () => {
      try {
        await scheduleRepair(repairId, iso);
      } catch (err) {
        const msg = (err as Error)?.message ?? "Failed to reschedule";
        toast.error(msg === SCHEDULE_NEEDS_TASKS ? t.scheduleNeedsTasks : msg);
        const data = await getPlannedRepairs(weekStart, weekEnd);
        setRepairs(data);
      }
    });
  }

  const draggingRepair = dragRepairId
    ? repairs.find((r) => r.id === dragRepairId) ?? null
    : null;

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
                    <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{totalCount}</span> scheduled
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 dark:text-muted-foreground">empty week</span>
                )}
                {isPending ? (
                  <span className="animate-pulse text-muted-foreground/70 dark:text-muted-foreground">{t.searching}</span>
                ) : null}
              </>
            }
            description={t.pageSubtitle}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-0 rounded-xl border border-border bg-card shadow-none dark:border-border dark:bg-card">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-l-xl rounded-r-none text-muted-foreground hover:text-foreground dark:text-muted-foreground/70 dark:hover:text-foreground"
                onClick={() => navigateWeek(-1)}
                aria-label={ariaPrevWeek}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={goToThisWeek}
                className="group/today inline-flex h-10 items-center gap-1.5 border-x border-border/60 dark:border-border px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground dark:text-muted-foreground/50 dark:hover:bg-card/[0.04] dark:hover:text-foreground touch-manipulation"
              >
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70 transition-transform group-hover/today:scale-110 dark:text-muted-foreground" aria-hidden />
                {t.thisWeek}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-r-xl rounded-l-none text-muted-foreground hover:text-foreground dark:text-muted-foreground/70 dark:hover:text-foreground"
                onClick={() => navigateWeek(1)}
                aria-label={ariaNextWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/*
              Toolbar style matches the rest of the admin panel
              (flat border + bg-card, no shadow). On mobile the two main
              filters share a 2-column grid; Print stays as an icon-only
              button so the row never wraps.
            */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="h-10 w-full touch-manipulation rounded-xl border-border bg-card text-sm text-foreground/90 shadow-none sm:w-[160px] dark:border-border dark:bg-card dark:text-foreground/90">
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

                {locations.length > 1 ? (
                  <Select value={filterLocation} onValueChange={setFilterLocation}>
                    <SelectTrigger className="h-10 w-full touch-manipulation rounded-xl border-border bg-card text-sm text-foreground/90 shadow-none sm:w-[170px] dark:border-border dark:bg-card dark:text-foreground/90">
                      <MapPin className="mr-1 h-3.5 w-3.5 shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.print}
                className="h-10 w-10 shrink-0 touch-manipulation rounded-xl border-border bg-card text-muted-foreground shadow-none hover:text-foreground sm:w-auto sm:gap-2 sm:px-3.5 dark:border-border dark:bg-card dark:text-muted-foreground/70 dark:hover:text-foreground"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span className="hidden text-sm font-medium sm:inline">{t.print}</span>
              </Button>

              <Link
                href="/repairs"
                className="hidden h-10 items-center rounded-xl px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex dark:text-muted-foreground/70 dark:hover:text-foreground"
              >
                {t.browseWorkOrders} →
              </Link>
            </div>
          </div>

          {/* Inline location legend + drag hint. The legend used to live in
              its own card below the toolbar, which felt redundant on mobile
              (every repair already shows a colored dot). Rendering the dots
              as a tight chip-row keeps the meaning without the extra slab. */}
          {(locationLegend.length > 0 || t.dragHint) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground dark:text-muted-foreground/70 print:hidden">
              {locationLegend.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80 ring-1 ring-border/50 dark:bg-card/[0.04] dark:text-foreground/80 dark:ring-border/60"
                >
                  <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                  {l.name}
                </span>
              ))}
              <span className="hidden text-xs text-muted-foreground md:inline dark:text-muted-foreground/70">{t.dragHint}</span>
            </div>
          )}
        </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-center mb-1">{t.planning}</h1>
        <p className="text-center text-sm text-muted-foreground mb-4">
          {formatWeekRange(new Date(weekStart), new Date(weekEnd), lang)}
          {filterUser !== "all" && ` — ${staff.find(u => u.id === filterUser)?.name}`}
        </p>
      </div>

      {/* Day list */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDndStart}
        onDragEnd={handleDndEnd}
        onDragCancel={() => setDragRepairId(null)}
      >
        <div className="space-y-3 print:space-y-4 sm:space-y-4">
          {days.map((day, dayIdx) => {
            const dayRepairs = repairsForDay(dayIdx);
            const isToday = day.toDateString() === todayStr;
            const isEmpty = dayRepairs.length === 0;

            return (
              <DayDropZone
                key={dayIdx}
                dayIndex={dayIdx}
                className={cn(
                  "group/day animate-slide-up overflow-hidden transition-all duration-200 print:break-inside-avoid print:border-foreground/20",
                  // Empty days collapse to a thin inline strip; full days
                  // get the same panel chrome as before. This keeps a
                  // light week from filling the screen with placeholders.
                  isEmpty
                    ? "rounded-xl border border-dashed border-border/50 bg-transparent"
                    : cn(dashboardPanelClass),
                  isToday && "ring-2 ring-foreground/30 dark:ring-foreground/40",
                  isEmpty && "print:hidden",
                )}
                style={{ animationDelay: `${Math.min(dayIdx * 30, 180)}ms`, animationFillMode: "backwards" }}
              >
                {/* Day header */}
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 transition-colors print:border-foreground/20",
                    isEmpty ? "px-4 py-2" : "px-4 py-3",
                    !isEmpty && "border-b border-border/60 dark:border-border",
                    isToday
                      ? "bg-muted/40 dark:bg-foreground/[0.06]"
                      : isEmpty
                        ? "bg-transparent"
                        : "bg-muted/40 dark:bg-card/[0.02]",
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      isEmpty ? "text-muted-foreground/50" : "text-muted-foreground/70 dark:text-muted-foreground",
                    )}>
                      {t.days[dayIdx]}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isEmpty ? "text-muted-foreground/70" : "text-foreground dark:text-foreground",
                      )}
                    >
                      {day.getDate()} {t.months[day.getMonth()]}
                    </span>
                    {isToday ? (
                      <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80">
                        Today
                      </span>
                    ) : null}
                    {dayRepairs.length > 0 ? (
                      <Badge
                        variant="secondary"
                        className="h-5 rounded-full px-2 text-[10px] font-semibold print:hidden dark:bg-foreground/[0.08] dark:text-foreground/90"
                      >
                        {dayRepairs.length}
                      </Badge>
                    ) : null}
                  </div>
                  {/* Add button: visible on full days, hover-only on empty
                      days so the empty strip isn't littered with seven
                      identical buttons. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 shrink-0 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground touch-manipulation print:hidden dark:text-muted-foreground/70 dark:hover:bg-card/[0.06] dark:hover:text-foreground",
                      isEmpty && "opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100",
                    )}
                    onClick={() => openAddDialog(dayIdx)}
                    aria-label={`Add repair on ${t.days[dayIdx]} ${day.getDate()}`}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t.addRepair}
                  </Button>
                </div>

                {/* Repairs */}
                {!isEmpty && (
                  <div className="divide-y divide-border/60 print:divide-border dark:divide-border/60">
                    {dayRepairs.map((r) => (
                      <RepairRow
                        key={r.id}
                        repair={r}
                        lang={lang}
                        isDragging={dragRepairId === r.id}
                      />
                    ))}
                  </div>
                )}
              </DayDropZone>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingRepair ? (
            <RepairDragPreview repair={draggingRepair} lang={lang} />
          ) : null}
        </DragOverlay>
      </DndContext>

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

// ─── Day droppable wrapper ───

function DayDropZone({
  dayIndex,
  className,
  style,
  children,
}: {
  dayIndex: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver &&
          "outline outline-2 outline-offset-[-2px] outline-foreground/40 dark:outline-foreground/50",
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Compact Repair Row (draggable) ───

function RepairRow({
  repair,
  lang,
  isDragging,
}: {
  repair: PlannedRepair;
  lang: PlanningLang;
  isDragging: boolean;
}) {
  const t = getLocaleStrings(lang);
  const locDot = getLocationDot(repair.locationId);
  const time = new Date(repair.dueDate);
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
  const priorityDot = PRIORITY_COLORS[repair.priority as Priority]?.split(" ")[0] ?? "bg-foreground/30";

  const { attributes, listeners, setNodeRef, setActivatorNodeRef } =
    useDraggable({ id: repair.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex min-h-[3.25rem] items-start gap-3 px-4 py-3.5 transition-all duration-150 print:min-h-0 print:py-2",
        "hover:bg-muted/50 dark:hover:bg-card/[0.04]",
        isDragging && "opacity-40",
      )}
    >
      {/* Drag handle (explicit so the Link stays clickable) */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t.dragHint ?? "Drag to reschedule"}
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab rounded p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing touch-none print:hidden"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Link wrapping the content area so taps still navigate */}
      <Link
        href={`/repairs/${repair.id}`}
        className="flex flex-1 items-start gap-3 min-w-0"
      >
      {/* time */}
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
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
          <span className="truncate text-sm font-semibold text-foreground dark:text-foreground">
            {repair.title ?? repair.publicCode ?? "—"}
          </span>
          {repair.publicCode && (
            <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/70 tabular-nums sm:inline dark:text-muted-foreground">
              #{repair.publicCode}
            </span>
          )}
          <Badge className={`${STATUS_COLORS[repair.status as RepairStatus] ?? "bg-muted text-muted-foreground"} rounded-full text-[9px] px-1.5 py-0 shrink-0 print:hidden`}>
            {repairStatusLabel(repair.status)}
          </Badge>
        </div>

        {/* Meta: customer, unit, location */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground print:text-muted-foreground dark:text-muted-foreground/70">
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
            <p className="hidden print:block text-xs text-foreground/90 mt-1 whitespace-pre-line">
              {repair.descriptionRaw}
            </p>
          </>
        )}

        {/* Print-only extra info */}
        <div className="hidden print:flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {repair.locationName && <span>📍 {repair.locationName}</span>}
          {repair.assignedUserName && <span>👤 {repair.assignedUserName}</span>}
          {repair.estimatedHours && <span>⏱ {repair.estimatedHours}h</span>}
        </div>
      </div>
      </Link>
    </div>
  );
}

// Compact snapshot that trails the cursor/finger during drag.
function RepairDragPreview({
  repair,
  lang,
}: {
  repair: PlannedRepair;
  lang: PlanningLang;
}) {
  void lang;
  const locDot = getLocationDot(repair.locationId);
  const time = new Date(repair.dueDate);
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(
    time.getMinutes(),
  ).padStart(2, "0")}`;
  return (
    <div className="pointer-events-none inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px] shadow-xl dark:border-border dark:bg-foreground">
      <span className={`h-2 w-2 rounded-full ${locDot}`} />
      <span className="font-mono text-xs text-muted-foreground">{timeStr}</span>
      <span className="max-w-[12rem] truncate font-semibold">
        {repair.title ?? repair.publicCode ?? "—"}
      </span>
    </div>
  );
}
