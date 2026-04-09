"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, Globe, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/types";
import type { RepairStatus, Priority } from "@/types";
import { type PlanningLang, getLocaleStrings, formatWeekRange } from "@/lib/planning-locale";
import { getPlannedRepairs, scheduleRepair, type PlannedRepair } from "@/actions/planning";
import { AddRepairDialog } from "./add-repair-dialog";
import { toast } from "sonner";

// Location → color mapping for visual coding
const LOCATION_COLORS: Record<string, string> = {};
const LOCATION_PALETTE = [
  "border-l-blue-500", "border-l-emerald-500", "border-l-amber-500",
  "border-l-purple-500", "border-l-rose-500", "border-l-cyan-500",
  "border-l-lime-500", "border-l-orange-500",
];
const LOCATION_DOT_PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-purple-500", "bg-rose-500", "bg-cyan-500",
  "bg-lime-500", "bg-orange-500",
];
function getLocationColor(locationId: string | null): string {
  if (!locationId) return "border-l-gray-300";
  if (!LOCATION_COLORS[locationId]) {
    const idx = Object.keys(LOCATION_COLORS).length % LOCATION_PALETTE.length;
    LOCATION_COLORS[locationId] = LOCATION_PALETTE[idx];
  }
  return LOCATION_COLORS[locationId];
}
function getLocationDot(locationId: string | null): string {
  if (!locationId) return "bg-gray-400";
  if (!LOCATION_COLORS[locationId]) getLocationColor(locationId);
  const idx = Object.keys(LOCATION_COLORS).indexOf(locationId);
  return LOCATION_DOT_PALETTE[idx >= 0 ? idx % LOCATION_DOT_PALETTE.length : 0];
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

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
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(0); // 0=Mon for day view
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date | null>(null);
  const [dragRepairId, setDragRepairId] = useState<string | null>(null);

  const t = getLocaleStrings(lang);
  const monday = new Date(weekStart);

  function changeLang(newLang: PlanningLang) {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("planning-lang", newLang);
    }
  }

  // Week navigation
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

  // Get day columns (Mon–Sun)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Is today?
  const todayStr = new Date().toDateString();

  // Filter repairs
  const filteredRepairs = filterUser === "all"
    ? repairs
    : repairs.filter((r) => r.assignedUserId === filterUser);

  // Get repairs for a specific day + hour
  function repairsForSlot(dayIndex: number, hour: number) {
    const dayDate = days[dayIndex];
    return filteredRepairs.filter((r) => {
      const d = new Date(r.dueDate);
      return d.getDate() === dayDate.getDate()
        && d.getMonth() === dayDate.getMonth()
        && d.getFullYear() === dayDate.getFullYear()
        && d.getHours() === hour;
    });
  }

  // Get all repairs for a day (for day view, grouped by hour)
  function repairsForDay(dayIndex: number) {
    const dayDate = days[dayIndex];
    return filteredRepairs.filter((r) => {
      const d = new Date(r.dueDate);
      return d.getDate() === dayDate.getDate()
        && d.getMonth() === dayDate.getMonth()
        && d.getFullYear() === dayDate.getFullYear();
    });
  }

  // Drag & drop
  function handleDragStart(e: React.DragEvent, repairId: string) {
    e.dataTransfer.setData("text/plain", repairId);
    e.dataTransfer.effectAllowed = "move";
    setDragRepairId(repairId);
  }

  function handleDragEnd() {
    setDragRepairId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const handleDrop = useCallback((e: React.DragEvent, dayIndex: number, hour: number) => {
    e.preventDefault();
    const repairId = e.dataTransfer.getData("text/plain");
    if (!repairId) return;
    setDragRepairId(null);

    const targetDate = new Date(days[dayIndex]);
    targetDate.setHours(hour, 0, 0, 0);
    const iso = targetDate.toISOString();

    // Optimistic update
    setRepairs((prev) =>
      prev.map((r) => (r.id === repairId ? { ...r, dueDate: targetDate } : r))
    );

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

  // Add repair via dialog
  function openAddDialog(dayIndex: number, hour: number) {
    const d = new Date(days[dayIndex]);
    d.setHours(hour, 0, 0, 0);
    setAddDialogDate(d);
    setAddDialogOpen(true);
  }

  async function onRepairAdded() {
    setAddDialogOpen(false);
    const data = await getPlannedRepairs(weekStart, weekEnd);
    setRepairs(data);
  }

  // Location legend
  const usedLocationIds = [...new Set(filteredRepairs.map((r) => r.locationId).filter(Boolean))] as string[];
  const locationLegend = usedLocationIds.map((id) => ({
    id,
    name: locations.find((l) => l.id === id)?.name ?? "?",
    dot: getLocationDot(id),
  }));

  return (
    <div className="space-y-3 print:space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:justify-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight print:text-2xl">{t.planning}</h1>
          <div className="flex items-center gap-1 ml-2 print:hidden">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs px-3" onClick={goToThisWeek}>
              {t.thisWeek}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground font-medium ml-1">
            {formatWeekRange(new Date(weekStart), new Date(weekEnd), lang)}
          </span>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {/* View toggle */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView("week")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${view === "week" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.week}
            </button>
            <button
              onClick={() => setView("day")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${view === "day" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.day}
            </button>
          </div>

          {/* User filter */}
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="h-8 w-[140px] text-xs rounded-lg">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStaff}</SelectItem>
              {staff.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Language */}
          <Select value={lang} onValueChange={(v) => changeLang(v as PlanningLang)}>
            <SelectTrigger className="h-8 w-[80px] text-xs rounded-lg">
              <Globe className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="nl">NL</SelectItem>
              <SelectItem value="es">ES</SelectItem>
            </SelectContent>
          </Select>

          {/* Print */}
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            {t.print}
          </Button>
        </div>
      </div>

      {/* Location legend */}
      {locationLegend.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {locationLegend.map((l) => (
            <span key={l.id} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
      )}

      {/* WEEK VIEW */}
      {view === "week" && (
        <div className="border rounded-xl overflow-hidden bg-background print:border-gray-300">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b print:border-gray-300">
            <div className="p-2 text-[10px] text-muted-foreground" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === todayStr;
              return (
                <div
                  key={i}
                  className={`p-2 text-center border-l print:border-gray-300 ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="text-[11px] font-semibold">{t.daysShort[i]}</div>
                  <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 print:border-gray-300">
              <div className="p-1.5 text-[10px] text-muted-foreground text-right pr-2 pt-2">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((_, dayIdx) => {
                const slotRepairs = repairsForSlot(dayIdx, hour);
                const isToday = days[dayIdx].toDateString() === todayStr;
                return (
                  <div
                    key={dayIdx}
                    className={`border-l min-h-[56px] p-0.5 relative group transition-colors print:border-gray-300 print:min-h-[40px] ${
                      isToday ? "bg-primary/[0.02]" : ""
                    } ${dragRepairId ? "hover:bg-primary/5" : ""}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dayIdx, hour)}
                  >
                    {slotRepairs.map((r) => (
                      <RepairCard key={r.id} repair={r} lang={lang} onDragStart={handleDragStart} onDragEnd={handleDragEnd} isDragging={dragRepairId === r.id} />
                    ))}
                    {/* Add button — only visible on hover */}
                    <button
                      onClick={() => openAddDialog(dayIdx, hour)}
                      className="absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* DAY VIEW */}
      {view === "day" && (
        <div>
          {/* Day selector tabs */}
          <div className="flex gap-1 mb-3 print:hidden">
            {days.map((d, i) => {
              const isToday = d.toDateString() === todayStr;
              const hasRepairs = repairsForDay(i).length > 0;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-1 py-2 px-1 rounded-lg text-center text-xs font-medium transition-colors ${
                    selectedDay === i
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isToday
                        ? "bg-primary/10 text-primary"
                        : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <div>{t.daysShort[i]}</div>
                  <div className="text-lg font-bold">{d.getDate()}</div>
                  {hasRepairs && selectedDay !== i && (
                    <div className="h-1 w-1 rounded-full bg-primary mx-auto mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Day header for print */}
          <div className="hidden print:block text-center mb-2">
            <div className="text-lg font-bold">{t.days[selectedDay]} {days[selectedDay].getDate()}</div>
          </div>

          {/* Hour slots for selected day */}
          <div className="border rounded-xl overflow-hidden bg-background print:border-gray-300">
            {HOURS.map((hour) => {
              const slotRepairs = repairsForSlot(selectedDay, hour);
              return (
                <div key={hour} className="flex border-b last:border-b-0 print:border-gray-300">
                  <div className="w-16 shrink-0 p-2 text-sm text-muted-foreground text-right pr-3 pt-3 font-medium">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  <div
                    className={`flex-1 min-h-[64px] p-1 border-l relative group transition-colors print:border-gray-300 ${dragRepairId ? "hover:bg-primary/5" : ""}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, selectedDay, hour)}
                  >
                    <div className="space-y-1">
                      {slotRepairs.map((r) => (
                        <RepairCard key={r.id} repair={r} lang={lang} expanded onDragStart={handleDragStart} onDragEnd={handleDragEnd} isDragging={dragRepairId === r.id} />
                      ))}
                    </div>
                    <button
                      onClick={() => openAddDialog(selectedDay, hour)}
                      className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add repair dialog */}
      <AddRepairDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        targetDate={addDialogDate}
        lang={lang}
        onAdded={onRepairAdded}
      />
    </div>
  );
}

// ─── Repair Card ───

function RepairCard({
  repair,
  lang,
  expanded,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  repair: PlannedRepair;
  lang: PlanningLang;
  expanded?: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const t = getLocaleStrings(lang);
  const locColor = getLocationColor(repair.locationId);

  return (
    <Link
      href={`/repairs/${repair.id}`}
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(e, repair.id); }}
      onDragEnd={onDragEnd}
      className={`block rounded-md border-l-[3px] ${locColor} bg-card px-1.5 py-1 text-[11px] leading-tight shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing print:shadow-none print:border print:border-gray-300 print:break-inside-avoid ${
        isDragging ? "opacity-40" : ""
      } ${expanded ? "py-2 px-2.5" : ""}`}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[repair.priority as Priority]?.split(" ")[0] ?? "bg-gray-300"}`} />
        <span className="font-semibold truncate">{repair.title ?? repair.publicCode ?? "—"}</span>
      </div>
      {repair.customerName && (
        <div className="text-muted-foreground truncate mt-0.5 print:text-gray-600">
          {repair.customerName}
        </div>
      )}
      {expanded && (
        <>
          {repair.locationName && (
            <div className="text-muted-foreground truncate">{t.location}: {repair.locationName}</div>
          )}
          {repair.assignedUserName && (
            <div className="text-muted-foreground truncate">{t.assignedTo}: {repair.assignedUserName}</div>
          )}
          <Badge className={`${STATUS_COLORS[repair.status as RepairStatus]} rounded-full text-[9px] px-1.5 py-0 mt-1`}>
            {repair.status.replace(/_/g, " ")}
          </Badge>
        </>
      )}
    </Link>
  );
}
