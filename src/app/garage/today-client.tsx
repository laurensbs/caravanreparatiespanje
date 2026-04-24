"use client";

import {
  useState,
  useEffect,
  useMemo,
  useTransition,
  useOptimistic,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Play,
  Pause,
  Check,
  Package,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  MapPin,
  X,
  Wrench,
  CalendarDays,
  Sparkles,
  ClipboardList,
  User,
} from "lucide-react";
import { useLanguage, LanguageToggle, type Language } from "@/components/garage/language-toggle";
import { GarageThemeToggle } from "@/components/garage/theme-provider";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { hapticTap, hapticSuccess, primeHaptics } from "@/lib/haptic";
import { usePullToRefresh } from "@/lib/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/garage/pull-to-refresh-indicator";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { GARAGE_TIMER_NO_TASKS } from "@/lib/garage-timer-errors";
import { updateTaskStatus, garageMarkPartReceived, garageMarkDone } from "@/actions/garage";
import { toggleServiceRequestCompleted } from "@/actions/services";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { canStartGarageTimerOnRepair, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { WorkerPicker, type WorkerOption } from "@/components/garage/worker-picker";
import { ToolRequestSheet } from "@/components/garage/tool-request-sheet";
import { useGarageActiveUser, preferredLangForWorker } from "@/lib/use-garage-active-user";
import { launchConfettiBurst } from "@/lib/confetti-burst";

/* ─────────────────────────────────────────────────────────────────────────
   Today screen — shared garage iPad
   ─────────────────────────────────────────────────────────────────────────
   Goals (see chat with Laurens):
   - One filter row, four big tabs. No duplicate stat strip.
   - Cards show running timers inline with technician name + minutes.
   - Starting a timer always opens the worker tile-grid; the result is
     attributed to the chosen technician (no localStorage "me" anymore).
   - Anonymous quick actions (tick task, mark part received) keep their
     one-tap UX — Laurens explicitly accepted anonymous task ticking
     to keep the flow fast.
   - Default language is the iPad's deviceLang. After an action, the
     toast shows in the actor's preferred language so feedback feels
     personal without flipping the UI for the next person.
   ───────────────────────────────────────────────────────────────────── */

type RepairItem = {
  id: string;
  publicCode: string | null;
  title: string | null;
  titleEs?: string | null;
  titleNl?: string | null;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: Date | string | null;
  customerName: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  unitStorageLocation: string | null;
  unitCurrentPosition: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  finalCheckStatus: string | null;
  jobType: string;
  tasks: { total: number; done: number; problem: number };
  parts: { total: number; received: number; pending: number };
  workers: string[];
  totalMinutes: number;
  garageAdminMessage: string | null;
  garageAdminMessageAt: Date | string | null;
  garageAdminMessageReadAt: Date | string | null;
  nextTask: {
    id: string;
    title: string;
    titleEs: string | null;
    titleNl: string | null;
    status: "pending" | "in_progress";
  } | null;
  nextPart: {
    id: string;
    name: string;
    status: "requested" | "ordered" | "shipped";
    expectedDelivery: Date | string | null;
  } | null;
  services: Array<{
    id: string;
    name: string;
    nameEs?: string | null;
    nameNl?: string | null;
    completedAt: Date | string | null;
  }>;
};

interface QuickStats {
  tomorrowCount: number;
  waitingPartsCount: number;
  urgentCount: number;
  unassignedCount: number;
}

type ActiveTimerItem = {
  id: string;
  repairJobId: string;
  userId: string;
  userName: string | null;
  startedAt: Date | string;
};

interface Props {
  repairs: RepairItem[];
  userName: string;
  stats: QuickStats;
  activeTimers?: ActiveTimerItem[];
  allUsers: { id: string; name: string | null; role: string | null; preferredLanguage?: Language | null }[];
}

type FilterTab = "all" | "services" | "repairs";

/** Geldt de klus nog actief (dus hoort hij in de lijst)?
 *  Afgeronde/gefactureerde klussen vallen eruit — die horen bij admin.
 *  Wachtende klussen (waiting_parts, waiting_customer, blocked) óók:
 *  die liggen fysiek in de werkplaats maar er kan niks mee, dus op
 *  de werkvloer-lijst zijn ze alleen ruis. Admin ziet ze in het
 *  back-office panel. Ready_for_check blijft wel zichtbaar want
 *  admin moet nog even goedkeuren en de werker wil dat zien. */
function isStillRelevant(r: RepairItem): boolean {
  if (r.status === "invoiced") return false;
  if (r.status === "completed") return false;
  if (["waiting_parts", "waiting_customer", "blocked"].includes(r.status)) return false;
  // Service-jobs (transport cleaning etc.) need no admin check — hide
  // them once the garage marks them ready_for_check.
  if (r.status === "ready_for_check" && r.jobType === "service") return false;
  return true;
}

function tabFor(r: RepairItem): FilterTab {
  return r.jobType === "service" ? "services" : "repairs";
}

/**
 * Slimme transport-datum label voor service-kaarten. Laat vandaag/
 * morgen direct zien en voor verdere dagen de dag-naam + dag-getal.
 * Werkers kijken naar deze banner om te plannen. Returns { label, tone }
 * waarbij tone de kleur-intensiteit aangeeft: 'today' = emerald, 'tomorrow'
 * = amber, 'later' = sky, 'overdue' = rose.
 */
function transportDateInfo(
  date: Date,
  lang: Language,
): { label: string; tone: "today" | "tomorrow" | "later" | "overdue" } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return {
      label:
        lang === "es" ? "Atrasado" : lang === "nl" ? "Te laat" : "Overdue",
      tone: "overdue",
    };
  }
  if (diffDays === 0) {
    return {
      label: lang === "es" ? "Hoy" : lang === "nl" ? "Vandaag" : "Today",
      tone: "today",
    };
  }
  if (diffDays === 1) {
    return {
      label:
        lang === "es" ? "Mañana" : lang === "nl" ? "Morgen" : "Tomorrow",
      tone: "tomorrow",
    };
  }
  const locale = lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB";
  return {
    label: target.toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    tone: "later",
  };
}

function fmtDuration(min: number, lang: Language): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}u`.replace("u", lang === "es" ? "h" : lang === "nl" ? "u" : "h");
  const unit = lang === "nl" ? "u" : "h";
  return `${h}${unit} ${m}m`;
}

function elapsedMinutesSince(start: Date | string): number {
  const t = typeof start === "string" ? new Date(start).getTime() : start.getTime();
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Live HH:MM:SS string from a start timestamp. Used in the running-timer
 * strip so workers see seconds tick up — that's what makes a timer feel
 * "alive" on a shared iPad. Resolves once per second via the surrounding
 * `now` state.
 */
function fmtLiveClock(start: Date | string, now: Date): string {
  const startMs = typeof start === "string" ? new Date(start).getTime() : start.getTime();
  const totalSec = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
  return fmtClockSeconds(totalSec);
}

/** Format een aantal seconden als live-klok (H:MM:SS of M:SS). */
function fmtClockSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-emerald-400",
  ready_for_check: "bg-amber-400",
  waiting_parts: "bg-orange-400",
  waiting_customer: "bg-orange-400",
  blocked: "bg-rose-400",
  completed: "bg-stone-500",
  invoiced: "bg-stone-500",
  todo: "bg-sky-400",
  new: "bg-sky-400",
};


export function GarageTodayClient({
  repairs: serverRepairs,
  stats,
  activeTimers: serverActiveTimers = [],
  allUsers,
}: Props) {
  const router = useRouter();
  const { t, deviceLang, tFor, setDeviceLang } = useLanguage();

  /* ── Optimistic state for tick-task / mark-part ──────────────────── */
  type OptimisticAction =
    | { type: "tickTask"; repairId: string; taskId: string }
    | { type: "receivePart"; repairId: string; partId: string }
    | { type: "toggleService"; repairId: string; serviceId: string };

  const [repairs, applyOptimistic] = useOptimistic(
    serverRepairs,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "tickTask":
          return state.map((r) =>
            r.id === action.repairId && r.nextTask?.id === action.taskId
              ? { ...r, nextTask: null }
              : r,
          );
        case "receivePart":
          return state.map((r) =>
            r.id === action.repairId && r.nextPart?.id === action.partId
              ? { ...r, nextPart: null }
              : r,
          );
        case "toggleService":
          return state.map((r) =>
            r.id === action.repairId
              ? {
                  ...r,
                  services: r.services.map((s) =>
                    s.id === action.serviceId
                      ? { ...s, completedAt: s.completedAt ? null : new Date() }
                      : s,
                  ),
                }
              : r,
          );
      }
    },
  );

  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Unlock the AudioContext on the first user gesture so haptic clicks are
  // audible right from tap one (iOS Safari requirement).
  useEffect(() => {
    const onFirst = () => {
      primeHaptics();
      window.removeEventListener("pointerdown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

  // Subtle "elevation" of the sticky header once the user starts scrolling.
  // Mirrors iOS large-title → compact-title behaviour.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Wipe any leftover "My day" selection from older builds so a worker
  // doesn't get stuck on a phantom filter from a previous session. The
  // shared-iPad model means anyone can start anything; per-person filtering
  // turned out to be more confusing than helpful and was removed.
  useEffect(() => {
    try {
      window.localStorage.removeItem("garage:mine-user-id");
    } catch {}
  }, []);

  /* Persistent iPad-profile: who's using this device. One localStorage
     entry — switch via header chip. Used as the actor for timer/messages. */
  const { user: activeUser, hydrated: activeUserHydrated, pick: pickActiveUser } = useGarageActiveUser();

  /* Taal volgt automatisch de actieve werker:
     Rolf en Mark = Nederlands, iedereen anders = Spaans. */
  useEffect(() => {
    if (!activeUserHydrated || !activeUser?.name) return;
    setDeviceLang(preferredLangForWorker(activeUser.name));
  }, [activeUserHydrated, activeUser?.name, setDeviceLang]);

  /* Worker picker — one component, three purposes:
       - "bootstrap": first-time setup, cannot be dismissed
       - "switch": tap the header chip to change profiles
       - "startTimer": fallback when activeUser is somehow missing */
  type PickerState =
    | { purpose: "bootstrap" }
    | { purpose: "switch" }
    | { purpose: "startTimer"; repairId: string; repairTitle: string };
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  // Auto-open bootstrap picker the first time we realize there's no profile.
  useEffect(() => {
    if (!activeUserHydrated) return;
    if (!activeUser && !pickerState) {
      setPickerState({ purpose: "bootstrap" });
    }
  }, [activeUserHydrated, activeUser, pickerState]);

  /* Tool request sheet — global "need a tool / part / supply" button. */
  const [toolSheetOpen, setToolSheetOpen] = useState(false);

  const [, startActionTransition] = useTransition();

  /* 1-second heartbeat for the live HH:MM:SS clocks on running timers.
     Cheap (one setState per second) and only triggers re-renders that
     read `now`. Date/greeting derivations only change on the minute, so
     they're stable across these ticks. */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Background polling — refresh server data when something changed. */
  useGaragePoll();

  /* ── Live active timers (poll independently every 15s so the cards
        keep ticking even between bigger router refreshes) ──────────── */
  const [liveTimers, setLiveTimers] = useState<ActiveTimerItem[]>(serverActiveTimers);
  useEffect(() => setLiveTimers(serverActiveTimers), [serverActiveTimers]);

  const timersByRepair = useMemo(() => {
    const m = new Map<string, ActiveTimerItem[]>();
    for (const tm of liveTimers) {
      const list = m.get(tm.repairJobId) ?? [];
      list.push(tm);
      m.set(tm.repairJobId, list);
    }
    return m;
  }, [liveTimers]);

  /* ── Tab counts — zelfde toewijzings-filter als visibleRepairs zodat
        de badges kloppen met wat de werker daadwerkelijk ziet. */
  const counts = useMemo(() => {
    const c = { all: 0, services: 0, repairs: 0 };
    for (const r of repairs) {
      if (!isStillRelevant(r)) continue;
      if (
        activeUser?.id &&
        r.assignedUserId &&
        r.assignedUserId !== activeUser.id
      ) {
        continue;
      }
      c.all++;
      c[tabFor(r)]++;
    }
    return c;
  }, [repairs, activeUser?.id]);

  /* ── Visible repairs ─────────────────────────────────────────────── */
  const visibleRepairs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repairs.filter((r) => {
      if (!isStillRelevant(r)) return false;
      if (tab !== "all" && tabFor(r) !== tab) return false;
      // Toewijzings-filter: als een klus is toegewezen aan iemand
      // en het actieve iPad-profiel is niet die persoon, verbergen.
      // Niet-toegewezen klussen zijn voor iedereen. Als er nog geen
      // profiel is ingesteld tonen we alles (bootstrap-fase).
      if (
        activeUser?.id &&
        r.assignedUserId &&
        r.assignedUserId !== activeUser.id
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        r.publicCode,
        r.title,
        r.customerName,
        r.unitRegistration,
        r.unitBrand,
        r.unitModel,
        r.unitStorageLocation,
        r.unitCurrentPosition,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [repairs, tab, search, activeUser?.id]);

  const totalActiveTimers = liveTimers.length;
  const unreadAdminMessages = repairs.filter(
    (r) => r.garageAdminMessage && !r.garageAdminMessageReadAt,
  ).length;

  /* ── Refresh ─────────────────────────────────────────────────────── */
  async function handleRefresh() {
    if (refreshing) return;
    hapticTap();
    setRefreshing(true);
    try {
      router.refresh();
      // Give Next a moment to flush new server data; the spinner is
      // mostly cosmetic but reassures workers that something happened.
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setRefreshing(false);
    }
  }

  // Native-feeling pull-to-refresh on touch devices. Reuses the same
  // refresh path as the header button so both feel identical.
  const ptr = usePullToRefresh(async () => {
    hapticSuccess();
    router.refresh();
    await new Promise((r) => setTimeout(r, 600));
  });

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function handleStartTimer(repair: RepairItem, worker: WorkerOption) {
    hapticTap();
    const actorLang = (worker.preferredLanguage ?? "en") as Language;

    // Did this worker already have an active timer on a *different*
    // repair? The backend auto-stops it, but we want the worker to know
    // that's what happened (otherwise they'd think two timers ran in
    // parallel for them, which can't happen — only across people).
    const previousElsewhere = liveTimers.find(
      (tm) => tm.userId === worker.id && tm.repairJobId !== repair.id,
    );

    startActionTransition(async () => {
      try {
        await startTimer(repair.id, worker.id);
        hapticSuccess();
        if (previousElsewhere) {
          toast.success(
            tFor(
              actorLang,
              `Switched to this repair — ${worker.name}`,
              `Cambiado a esta reparación — ${worker.name}`,
              `Overgestapt naar deze klus — ${worker.name}`,
            ),
            {
              description: tFor(
                actorLang,
                "Previous timer was paused automatically.",
                "El temporizador anterior se pausó automáticamente.",
                "Vorige timer is automatisch gepauzeerd.",
              ),
            },
          );
        } else {
          toast.success(
            tFor(
              actorLang,
              `Timer started — ${worker.name}`,
              `Temporizador iniciado — ${worker.name}`,
              `Timer gestart — ${worker.name}`,
            ),
          );
        }
        router.refresh();
      } catch (err) {
        const msg = (err as Error)?.message ?? "Could not start timer";
        if (msg === GARAGE_TIMER_NOT_ALLOWED) {
          toast.error(
            tFor(
              actorLang,
              "This repair is not active.",
              "Esta reparación no está activa.",
              "Deze reparatie is niet actief.",
            ),
          );
        } else if (msg === GARAGE_TIMER_NO_TASKS) {
          toast.error(
            tFor(
              actorLang,
              "No tasks on this job yet — add at least one task (office / work order) before starting the timer.",
              "Aún no hay tareas — añade al menos una (oficina / orden) antes de iniciar el temporizador.",
              "Nog geen taken op deze klus — voeg minstens één taak toe (kantoor / werkorder) voordat je de timer start.",
            ),
          );
        } else {
          toast.error(msg);
        }
      }
    });
  }

  async function handleStopTimer(timer: ActiveTimerItem) {
    hapticTap();
    const worker = allUsers.find((u) => u.id === timer.userId);
    const actorLang = (worker?.preferredLanguage ?? "en") as Language;
    startActionTransition(async () => {
      try {
        await stopTimer(timer.repairJobId, timer.userId);
        hapticSuccess();
        toast.success(
          tFor(
            actorLang,
            `Timer paused — ${timer.userName ?? "—"}`,
            `Pausado — ${timer.userName ?? "—"}`,
            `Gepauzeerd — ${timer.userName ?? "—"}`,
          ),
        );
        // Hide the timer immediately; router.refresh fills in authoritative state.
        setLiveTimers((prev) => prev.filter((tm) => tm.id !== timer.id));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not stop timer");
      }
    });
  }

  async function handleTickTask(repair: RepairItem) {
    if (!repair.nextTask) return;
    // Geen timer → niet afvinken. Zo blijft de factuurtijd kloppen en
    // raakt de werker er gewend om eerst te klokken.
    const hasTimerOnRepair = liveTimers.some((tm) => tm.repairJobId === repair.id);
    if (!hasTimerOnRepair) {
      hapticTap();
      toast.error(
        t(
          "Start the timer first — then you can tick off the task.",
          "Primero inicia el temporizador y luego marca la tarea.",
          "Start eerst de timer — dan kun je de taak afvinken.",
        ),
      );
      return;
    }
    const taskId = repair.nextTask.id;
    hapticTap();
    startActionTransition(async () => {
      applyOptimistic({ type: "tickTask", repairId: repair.id, taskId });
      try {
        await updateTaskStatus(taskId, "done");
        hapticSuccess();
        toast.success(t("Task completed", "Tarea completada", "Taak afgerond"));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not update task");
        router.refresh();
      }
    });
  }

  async function handleReceivePart(repair: RepairItem) {
    if (!repair.nextPart) return;
    const partId = repair.nextPart.id;
    hapticTap();
    startActionTransition(async () => {
      applyOptimistic({ type: "receivePart", repairId: repair.id, partId });
      try {
        await garageMarkPartReceived(partId);
        hapticSuccess();
        toast.success(t("Part received", "Pieza recibida", "Onderdeel ontvangen"));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not mark received");
        router.refresh();
      }
    });
  }

  async function handleMarkReady(repair: RepairItem) {
    hapticTap();
    // Per-ongeluk klikken moet kunnen — vooral op de iPad waar een tap
    // zo gedaan is. Confirm-dialog laat de werker nog één keer checken,
    // met context (plate / titel) zodat je ziet welke klus je bevestigt.
    const label =
      repair.unitRegistration ||
      repair.publicCode ||
      repair.title ||
      (repair.customerName ?? "");
    const ok = await confirmDialog({
      title: t(
        "Mark ready for check?",
        "¿Marcar listo para revisión?",
        "Klaarmelden voor controle?",
      ),
      description: t(
        `Send "${label}" to admin for final check? You can't undo this from the iPad.`,
        `¿Enviar "${label}" a la oficina para la revisión final? No se puede deshacer desde el iPad.`,
        `"${label}" naar kantoor sturen voor eindcontrole? Kan niet ongedaan worden op de iPad.`,
      ),
      confirmLabel: t("Yes, send", "Sí, enviar", "Ja, versturen"),
      cancelLabel: t("Cancel", "Cancelar", "Annuleren"),
    });
    if (!ok) return;
    startActionTransition(async () => {
      try {
        await garageMarkDone(repair.id);
        hapticSuccess();
        toast.success(t("Ready for check", "Listo para revisión", "Klaar voor controle"));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not mark ready");
      }
    });
  }

  async function handleToggleService(repair: RepairItem, serviceId: string) {
    hapticTap();
    startActionTransition(async () => {
      applyOptimistic({ type: "toggleService", repairId: repair.id, serviceId });
      try {
        const res = await toggleServiceRequestCompleted(serviceId);
        hapticSuccess();
        if (res?.jobCompleted) {
          launchConfettiBurst();
          toast.success(t("Done!", "¡Listo!", "Klaar!"));
        }
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not update service");
        router.refresh();
      }
    });
  }

  /* ── Greeting / clock ────────────────────────────────────────────── */
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return t("Good night", "Buenas noches", "Goedenacht");
    if (h < 12) return t("Good morning", "Buenos días", "Goedemorgen");
    if (h < 18) return t("Good afternoon", "Buenas tardes", "Goedemiddag");
    return t("Good evening", "Buenas noches", "Goedenavond");
  }, [now, t]);

  const dateLabel = now.toLocaleDateString(
    deviceLang === "nl" ? "nl-NL" : deviceLang === "es" ? "es-ES" : "en-GB",
    { weekday: "long", day: "numeric", month: "long" },
  );

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <PullToRefreshIndicator
        pull={ptr.pull}
        armed={ptr.armed}
        refreshing={ptr.refreshing}
      />
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 border-b bg-stone-950/90 backdrop-blur transition-[box-shadow,background-color] duration-200 ${
          scrolled
            ? "border-white/[0.08] bg-stone-950/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
            : "border-white/[0.06]"
        }`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              {dateLabel}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {greeting}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticTap();
              setToolSheetOpen(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500/15 px-3 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/25 hover:bg-amber-500/25 active:scale-[0.97]"
            aria-label={t(
              "Need a tool or part",
              "Necesito herramienta o pieza",
              "Gereedschap of onderdeel nodig",
            )}
          >
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("Tool / part", "Herramienta / pieza", "Gereedschap / onderdeel")}
            </span>
          </button>

          <LanguageToggle />
          <GarageThemeToggle />

          {activeUser && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setPickerState({ purpose: "switch" });
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.08] hover:bg-white/[0.10] active:scale-[0.97]"
              aria-label={t("Switch profile", "Cambiar perfil", "Profiel wisselen")}
              title={t("Switch profile", "Cambiar perfil", "Profiel wisselen")}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/50 to-sky-500/20 text-[11px] font-bold">
                {activeUser.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="hidden max-w-[8rem] truncate sm:inline">{activeUser.name}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] active:bg-white/[0.15] disabled:opacity-40"
            disabled={refreshing}
            aria-label={t("Refresh", "Actualizar", "Vernieuwen")}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search + summary chips on one row */}
        <div className="flex items-center gap-2 px-4 pb-3 sm:px-6">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/[0.04] focus-within:ring-white/20">
            <Search className="h-4 w-4 text-white/40" />
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={t(
                "Search registration, customer…",
                "Buscar matrícula, cliente…",
                "Zoek kenteken, klant…",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full w-full bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08]"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>

        {/* Tab bar — grote, kleurgecodeerde tabs zodat je op een iPad
            van 2m afstand meteen ziet welk type je bekijkt. Elke tab
            heeft eigen kleur (stone/sky/amber) voor herkenbaarheid
            en een eigen icoon. Actieve tab wordt 'solid' gekleurd. */}
        {(() => {
          const tabs = [
            {
              id: "all" as const,
              label: t("All", "Todos", "Alles"),
              icon: ClipboardList,
              count: counts.all,
              activeClass: "bg-white text-stone-950 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.45)]",
              inactiveClass: "bg-white/[0.04] text-white/70 ring-1 ring-white/[0.06] hover:bg-white/[0.07]",
              badgeActiveClass: "bg-stone-950/10 text-stone-950",
              badgeInactiveClass: "bg-white/[0.08] text-white/80",
            },
            {
              id: "services" as const,
              label: t("Services", "Servicios", "Services"),
              icon: Sparkles,
              count: counts.services,
              activeClass: "bg-sky-500 text-white shadow-[0_6px_18px_-6px_rgba(14,165,233,0.65)]",
              inactiveClass: "bg-sky-500/[0.08] text-sky-200 ring-1 ring-sky-400/20 hover:bg-sky-500/[0.14]",
              badgeActiveClass: "bg-white/20 text-white",
              badgeInactiveClass: "bg-sky-400/25 text-sky-100",
            },
            {
              id: "repairs" as const,
              label: t("Repairs", "Reparaciones", "Reparaties"),
              icon: Wrench,
              count: counts.repairs,
              activeClass: "bg-amber-500 text-stone-950 shadow-[0_6px_18px_-6px_rgba(245,158,11,0.65)]",
              inactiveClass: "bg-amber-500/[0.08] text-amber-200 ring-1 ring-amber-400/20 hover:bg-amber-500/[0.14]",
              badgeActiveClass: "bg-stone-950/20 text-stone-950",
              badgeInactiveClass: "bg-amber-400/25 text-amber-100",
            },
          ];
          return (
            <div className="px-2 pb-2 sm:px-4">
              <div className="grid grid-cols-3 gap-2">
                {tabs.map((it) => {
                  const Icon = it.icon;
                  const isActive = tab === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        hapticTap();
                        setTab(it.id);
                      }}
                      className={`flex h-14 items-center justify-center gap-2 rounded-2xl px-3 text-base font-bold transition-all duration-200 active:scale-[0.97] ${
                        isActive ? it.activeClass : it.inactiveClass
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{it.label}</span>
                      <span
                        className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${
                          isActive ? it.badgeActiveClass : it.badgeInactiveClass
                        }`}
                      >
                        {it.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Live ticker — admin-only signals (urgency, etc) intentionally
            stay on the office dashboard, not here. */}
        {(totalActiveTimers > 0 || unreadAdminMessages > 0) ? (
          <div className="flex items-center gap-2 overflow-x-auto border-t border-white/[0.04] px-4 py-2 text-xs text-white/60 sm:px-6">
            {totalActiveTimers > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {totalActiveTimers}{" "}
                {t(
                  totalActiveTimers === 1 ? "timer running" : "timers running",
                  totalActiveTimers === 1 ? "temporizador" : "temporizadores",
                  totalActiveTimers === 1 ? "timer loopt" : "timers lopen",
                )}
              </span>
            ) : null}
            {unreadAdminMessages > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-300">
                <MessageSquare className="h-3 w-3" />
                {unreadAdminMessages}{" "}
                {t("from office", "de oficina", "van kantoor")}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* ── Cards grid ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {visibleRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] py-20 text-center">
            {/* Logo as the empty-state mark — calmer than an emoji and
                consistent with the login screen branding. The dark
                container + invert keeps it legible on the stone-950 bg. */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <Image
                src="/favicon.png"
                alt="Reparatie Panel"
                width={40}
                height={40}
                className="h-9 w-9 object-contain opacity-80 invert"
                priority={false}
              />
            </div>
            <p className="mt-4 text-base text-white/50">
              {search
                ? t("No repairs match your search.", "Sin resultados.", "Geen resultaten.")
                : t("Nothing here right now.", "Nada aquí ahora.", "Hier staat nu niets.")}
            </p>
          </div>
        ) : (
          (() => {
            // Splits Active-tab in Services (bovenaan) en Repairs. Andere
            // tabs tonen één gemengde lijst; de SERVICE-badge op de kaart
            // blijft het onderscheid maken.
            const renderCard = (r: RepairItem) => (
              <JobCard
                key={r.id}
                repair={r}
                timers={timersByRepair.get(r.id) ?? []}
                now={now}
                onOpen={() => router.push(`/garage/repairs/${r.id}`)}
                onStartTimer={() => {
                  if (activeUser) {
                    handleStartTimer(r, {
                      id: activeUser.id,
                      name: activeUser.name,
                      role: null,
                      preferredLanguage: activeUser.preferredLanguage,
                    });
                    return;
                  }
                  setPickerState({
                    purpose: "startTimer",
                    repairId: r.id,
                    repairTitle: r.title ?? r.publicCode ?? "Repair",
                  });
                }}
                onStopTimer={handleStopTimer}
                onTickTask={() => handleTickTask(r)}
                onReceivePart={() => handleReceivePart(r)}
                onToggleService={(sid) => handleToggleService(r, sid)}
                onMarkReady={() => handleMarkReady(r)}
              />
            );

            // "Voor mij" eerst — klussen die expliciet zijn toegewezen
            // aan de actieve werker krijgen voorrang, ongeacht datum
            // of type. Andere sortering (datum voor services) werkt
            // als tweede tiebreaker.
            const mineFirst = (a: RepairItem, b: RepairItem) => {
              const aMine = a.assignedUserId === activeUser?.id ? 0 : 1;
              const bMine = b.assignedUserId === activeUser?.id ? 0 : 1;
              return aMine - bMine;
            };

            if (tab === "all") {
              // Services: eerst 'voor mij', dan op transport-datum.
              const serviceJobs = visibleRepairs
                .filter((r) => r.jobType === "service")
                .slice()
                .sort((a, b) => {
                  const byMine = mineFirst(a, b);
                  if (byMine !== 0) return byMine;
                  const ta = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                  const tb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                  return ta - tb;
                });
              // Repairs: eerst 'voor mij', rest behoudt originele volgorde.
              const repairJobs = visibleRepairs
                .filter((r) => r.jobType !== "service")
                .slice()
                .sort(mineFirst);
              return (
                <div key={tab} className="flex flex-col gap-6 animate-[fadeInUp_280ms_cubic-bezier(.32,.72,0,1)_both]">
                  {serviceJobs.length > 0 && (
                    <details open className="group/sect">
                      <summary className="mb-3 flex cursor-pointer select-none items-center gap-3 rounded-xl border-l-4 border-sky-400 bg-sky-500/[0.08] px-3 py-2.5 list-none [&::-webkit-details-marker]:hidden hover:bg-sky-500/[0.12] transition-colors">
                        <ChevronRight className="h-4 w-4 text-sky-300 transition-transform group-open/sect:rotate-90" />
                        <Sparkles className="h-4 w-4 text-sky-300" />
                        <h2 className="text-lg font-bold uppercase tracking-wider text-sky-200">
                          {t("Services", "Servicios", "Services")}
                        </h2>
                        <span className="ml-auto rounded-full bg-sky-400/25 px-2.5 py-0.5 text-sm font-bold text-sky-100">
                          {serviceJobs.length}
                        </span>
                      </summary>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {serviceJobs.map(renderCard)}
                      </div>
                    </details>
                  )}
                  {repairJobs.length > 0 && (
                    <details open className="group/sect">
                      <summary className="mb-3 flex cursor-pointer select-none items-center gap-3 rounded-xl border-l-4 border-amber-400/60 bg-white/[0.05] px-3 py-2.5 list-none [&::-webkit-details-marker]:hidden hover:bg-white/[0.08] transition-colors">
                        <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-open/sect:rotate-90" />
                        <Wrench className="h-4 w-4 text-amber-300" />
                        <h2 className="text-lg font-bold uppercase tracking-wider text-white/85">
                          {t("Repairs", "Reparaciones", "Reparaties")}
                        </h2>
                        <span className="ml-auto rounded-full bg-white/[0.12] px-2.5 py-0.5 text-sm font-bold text-white/80">
                          {repairJobs.length}
                        </span>
                      </summary>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {repairJobs.map(renderCard)}
                      </div>
                    </details>
                  )}
                </div>
              );
            }

            // Services-only tab: eerst 'voor mij', dan op transport-datum.
            // Repairs-only tab: eerst 'voor mij', rest originele volgorde.
            const shown =
              tab === "services"
                ? visibleRepairs.slice().sort((a, b) => {
                    const byMine = mineFirst(a, b);
                    if (byMine !== 0) return byMine;
                    const ta = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const tb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    return ta - tb;
                  })
                : visibleRepairs.slice().sort(mineFirst);
            return (
              <div
                key={tab}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 animate-[fadeInUp_280ms_cubic-bezier(.32,.72,0,1)_both]"
              >
                {shown.map(renderCard)}
              </div>
            );
          })()
        )}
      </main>

      {/* ── Worker picker (bootstrap, switch, or timer-start fallback) ── */}
      <WorkerPicker
        open={!!pickerState}
        onClose={() => {
          // Bootstrap must be completed — no closing without picking.
          if (pickerState?.purpose === "bootstrap") return;
          setPickerState(null);
        }}
        onPick={(worker) => {
          if (!pickerState) return;
          // Persist the iPad profile on every pick so the choice sticks.
          pickActiveUser({
            id: worker.id,
            name: worker.name ?? "Garage",
            preferredLanguage: (worker.preferredLanguage ?? "en") as "en" | "es" | "nl",
          });
          if (pickerState.purpose === "startTimer") {
            const repair = repairs.find((r) => r.id === pickerState.repairId);
            if (repair) handleStartTimer(repair, worker);
          }
          setPickerState(null);
        }}
        workers={allUsers}
        title={
          pickerState?.purpose === "bootstrap"
            ? t("Who is using this iPad?", "¿Quién usa este iPad?", "Wie gebruikt deze iPad?")
            : pickerState?.purpose === "switch"
              ? t("Switch profile", "Cambiar perfil", "Profiel wisselen")
              : t("Who's starting?", "¿Quién empieza?", "Wie begint?")
        }
        subtitle={pickerState?.purpose === "startTimer" ? pickerState.repairTitle : undefined}
      />

      {/* ── Tool request sheet (global) ───────────────────────────── */}
      {/* Alleen actieve reparaties — tool-requests aan afgeronde of
          wachtende klussen zijn niet nuttig en alleen maar extra ruis. */}
      <ToolRequestSheet
        open={toolSheetOpen}
        onClose={() => setToolSheetOpen(false)}
        onSent={() => router.refresh()}
        repairOptions={repairs
          .filter((r) =>
            isStillRelevant(r) &&
            ["new", "todo", "scheduled", "in_progress", "in_inspection"].includes(r.status),
          )
          .map((r) => ({
            id: r.id,
            label:
              r.unitRegistration ||
              r.publicCode ||
              r.title ||
              r.customerName ||
              "—",
            sublabel: r.title ?? r.customerName ?? null,
          }))}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Job card
   ───────────────────────────────────────────────────────────────────── */

function JobCard({
  repair,
  timers,
  now,
  onOpen,
  onStartTimer,
  onStopTimer,
  onTickTask,
  onReceivePart,
  onToggleService,
  onMarkReady,
}: {
  repair: RepairItem;
  timers: ActiveTimerItem[];
  now: Date;
  onOpen: () => void;
  onStartTimer: () => void;
  onStopTimer: (t: ActiveTimerItem) => void;
  onTickTask: () => void;
  onReceivePart: () => void;
  onToggleService: (serviceId: string) => void;
  onMarkReady: () => void;
}) {
  const { t, deviceLang } = useLanguage();
  const isService = repair.jobType === "service";
  // Zie detail-client: de server auto-promoot startable statussen naar
  // `in_progress`, dus we tonen de knop ook in new/todo/scheduled/
  // in_inspection. Service-jobs hebben geen timer; afvinken is genoeg.
  const canStartTimer =
    !isService &&
    (canStartGarageTimerOnRepair(repair.status) ||
      ["new", "todo", "scheduled", "in_inspection"].includes(repair.status));
  const someoneIsWorking = !isService && timers.length > 0;
  const totalProblems = repair.tasks.problem;
  const tasksProgress =
    repair.tasks.total > 0
      ? `${repair.tasks.done}/${repair.tasks.total}`
      : null;
  const partsPending = repair.parts.pending;
  const servicesDone = repair.services.filter((s) => s.completedAt != null).length;
  const servicesTotal = repair.services.length;
  const servicesProgress = servicesTotal > 0 ? `${servicesDone}/${servicesTotal}` : null;

  /* Live total minutes for this repair = recorded (already-rounded
     finished entries) + sum of currently-running timers. This number is
     what workers actually want to see on the overview: "this repair has
     burned X minutes so far, and it's still ticking". */
  const liveOngoingMinutes = timers.reduce(
    (acc, tm) => acc + elapsedMinutesSince(tm.startedAt),
    0,
  );
  const liveTotalMinutes = repair.totalMinutes + liveOngoingMinutes;

  // Title for the next-task pill
  const nextTaskTitle = repair.nextTask
    ? deviceLang === "es" && repair.nextTask.titleEs
      ? repair.nextTask.titleEs
      : deviceLang === "nl" && repair.nextTask.titleNl
        ? repair.nextTask.titleNl
        : repair.nextTask.title
    : null;

  const dateInfo = repair.dueDate
    ? transportDateInfo(new Date(repair.dueDate), deviceLang)
    : null;

  return (
    <article
      className="tap-press group flex flex-col gap-3 overflow-hidden rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.05]"
    >
      {/* ── Toewijs-banner — als deze klus expliciet is toegewezen,
           tonen we groot en paars wie 'm moet doen. Door de server-
           filter is dit altijd de huidige iPad-user, dus "Jij" voelt
           meer natuurlijk dan de naam. Niet-toegewezen klussen
           krijgen geen banner. */}
      {repair.assignedUserName ? (
        <div className="-mx-4 -mt-4 mb-1 flex items-center gap-2 bg-violet-500/25 px-4 py-2.5 text-base font-extrabold uppercase tracking-wide text-violet-100">
          <User className="h-5 w-5" />
          <span>
            {t("For", "Para", "Voor")} {repair.assignedUserName}
          </span>
        </div>
      ) : null}

      {/* ── Datum-banner — services labelen 'Transport' (ophaaldatum),
           repairs labelen 'Planned' (werkdatum). Kleur volgt urgentie. */}
      {dateInfo ? (
        <div
          className={`-mx-4 -mt-4 mb-1 flex items-center gap-2 px-4 py-2 text-sm font-bold ${
            dateInfo.tone === "today"
              ? "bg-emerald-500/25 text-emerald-100"
              : dateInfo.tone === "tomorrow"
                ? "bg-amber-500/25 text-amber-100"
                : dateInfo.tone === "overdue"
                  ? "bg-rose-500/25 text-rose-100"
                  : "bg-sky-500/20 text-sky-100"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span className="uppercase tracking-wide">{dateInfo.label}</span>
          <span className="ml-auto text-xs font-medium opacity-75">
            {isService
              ? t("Transport", "Transporte", "Transport")
              : t("Planned", "Planificado", "Gepland")}
          </span>
        </div>
      ) : null}

      {/* ── Header row: status, code, chevron ─────────────────────── */}
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-2.5 text-left"
      >
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[repair.status] ?? "bg-stone-500"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wide text-white">
              {repair.unitRegistration ?? repair.publicCode ?? "—"}
            </span>
            {repair.jobType === "service" ? (
              <span className="inline-flex items-center rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                {t("Service", "Servicio", "Service")}
              </span>
            ) : null}
            {/* Priority badges intentionally hidden for the garage view —
                "urgent / high" is admin-only triage. Workers should treat
                the queue as one shared list and start whatever is next. */}
            {repair.garageAdminMessage && !repair.garageAdminMessageReadAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                <MessageSquare className="h-2.5 w-2.5" /> {t("Note", "Nota", "Bericht")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-white/70 line-clamp-1">
            {repair.customerName ?? "—"}
            {repair.unitBrand ? ` · ${repair.unitBrand}` : ""}
          </p>
          {repair.unitStorageLocation || repair.unitCurrentPosition ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/40">
              <MapPin className="h-3 w-3" />
              {repair.unitCurrentPosition ?? repair.unitStorageLocation}
            </p>
          ) : null}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/30 group-hover:text-white/60" />
      </button>

      {/* ── Job title ─────────────────────────────────────────────── */}
      {repair.title ? (
        <p className="line-clamp-2 text-base font-medium text-white/85">
          {t(repair.title, repair.titleEs ?? null, repair.titleNl ?? null)}
        </p>
      ) : null}

      {/* ── Progress chips ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {servicesProgress ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
            <Check className="h-3 w-3 text-emerald-300" /> {servicesProgress} {t("services", "servicios", "services")}
          </span>
        ) : null}
        {tasksProgress ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-white/70">
            <Check className="h-3 w-3 text-emerald-400" /> {tasksProgress}
          </span>
        ) : null}
        {partsPending > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-orange-300">
            <Package className="h-3 w-3" /> {partsPending} {t("parts", "piezas", "onderdelen")}
          </span>
        ) : null}
        {totalProblems > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-rose-300">
            <AlertTriangle className="h-3 w-3" /> {totalProblems}
          </span>
        ) : null}
      </div>

      {/* ── Services checklist (alleen zichtbaar als er services hangen) ── */}
      {servicesTotal > 0 ? (
        <ul className="flex flex-col gap-1">
          {repair.services.slice(0, 4).map((s) => {
            const done = s.completedAt != null;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleService(s.id);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    done
                      ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                      : "bg-white/[0.03] text-white/80 hover:bg-white/[0.08]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      done
                        ? "border-emerald-400/70 bg-emerald-400/40"
                        : "border-white/25 bg-transparent"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5 text-emerald-50" /> : null}
                  </span>
                  <span className={`line-clamp-1 flex-1 ${done ? "line-through opacity-70" : ""}`}>
                    {t(s.name, s.nameEs ?? null, s.nameNl ?? null)}
                  </span>
                </button>
              </li>
            );
          })}
          {repair.services.length > 4 ? (
            <li className="px-2 pt-0.5 text-[11px] text-white/45">
              + {repair.services.length - 4} {t("more", "más", "meer")}
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* ── Paused state — toon opgebouwde tijd zodat een werker
          nooit denkt "waar is m'n tijd gebleven?" als niemand nu
          aan het werk is. Hervat-knop vervangt "Start timer" op de
          Quick-actions rij hieronder. */}
      {!someoneIsWorking && liveTotalMinutes > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-white/30" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            {t("Paused", "En pausa", "Gepauzeerd")}
          </span>
          <span className="ml-auto font-mono text-sm font-bold tabular-nums text-white/80">
            {fmtDuration(liveTotalMinutes, deviceLang)}
          </span>
        </div>
      ) : null}

      {/* ── Running timers strip (if any) ─────────────────────────── */}
      {someoneIsWorking ? (
        <div className="flex flex-col gap-2 rounded-xl bg-emerald-500/[0.10] p-3 ring-1 ring-emerald-500/25">
          {/* Big live total — the number workers care about most. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                {timers.length === 1
                  ? t("Running", "En curso", "Loopt")
                  : `${timers.length} ${t("working", "trabajando", "bezig")}`}
              </span>
            </div>
            <span className="font-mono text-lg font-bold tabular-nums text-emerald-50">
              {/* Cumulatieve headline-klok = eerder opgebouwde
                  (afgeronde) tijd + lopende sessie van de langst-
                  lopende timer. Blijft daardoor monotoon groeien: bij
                  pauze+hervat springt de klok niet terug naar 0. */}
              {(() => {
                const earliestMs = timers.reduce((earliest, tm) => {
                  const tmMs =
                    typeof tm.startedAt === "string"
                      ? new Date(tm.startedAt).getTime()
                      : tm.startedAt.getTime();
                  return tmMs < earliest ? tmMs : earliest;
                }, Date.now());
                const ongoingSec = Math.max(0, Math.floor((now.getTime() - earliestMs) / 1000));
                return fmtClockSeconds(repair.totalMinutes * 60 + ongoingSec);
              })()}
            </span>
          </div>

          {/* Per-person breakdown with individual pause */}
          <div className="flex flex-col gap-1.5">
            {timers.map((tm) => (
              <div key={tm.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-emerald-100">
                  <span className="font-medium">{tm.userName ?? "—"}</span>
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-emerald-300/80">
                    {fmtLiveClock(tm.startedAt, now)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopTimer(tm);
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/15 active:bg-white/20"
                  aria-label={t(
                    `Pause ${tm.userName ?? "timer"}`,
                    `Pausar ${tm.userName ?? "temporizador"}`,
                    `Pauzeer ${tm.userName ?? "timer"}`,
                  )}
                >
                  <Pause className="h-3.5 w-3.5" />
                  {t("Pause", "Pausa", "Pauze")}
                </button>
              </div>
            ))}
          </div>

          {/* Geen "Totaal tot nu"-regel meer tijdens het werken — de
              grote live-klok boven is het enige dat telt voor de
              werker. Afronden/totalen zie je pas bij facturatie. */}
        </div>
      ) : null}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      {(() => {
        const hasTopRow =
          (canStartTimer && !someoneIsWorking) || nextTaskTitle || repair.nextPart;
        const showReadyButton = [
          "new",
          "todo",
          "scheduled",
          "in_progress",
          "in_inspection",
        ].includes(repair.status);
        const showBeingChecked = repair.status === "ready_for_check";
        if (!hasTopRow && !showReadyButton && !showBeingChecked) return null;
        return (
          <div className="mt-auto flex flex-col gap-2 pt-1">
            {hasTopRow ? (
              <div className="flex flex-wrap items-center gap-2">
                {canStartTimer && !someoneIsWorking ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartTimer();
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-stone-950 shadow-sm hover:bg-white/95 active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {liveTotalMinutes > 0
                      ? t("Resume", "Seguir", "Hervatten")
                      : t("Start timer", "Iniciar timer", "Start timer")}
                  </button>
                ) : null}
                {nextTaskTitle ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTickTask();
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-sm font-medium text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25 active:scale-[0.98]"
                    title={nextTaskTitle}
                  >
                    <Check className="h-4 w-4" />
                    <span className="line-clamp-1">{nextTaskTitle}</span>
                  </button>
                ) : repair.nextPart ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReceivePart();
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500/15 px-3 text-sm font-medium text-orange-200 ring-1 ring-orange-400/20 hover:bg-orange-500/25 active:scale-[0.98]"
                    title={repair.nextPart.name}
                  >
                    <Package className="h-4 w-4" />
                    <span className="line-clamp-1">
                      {t("Got", "Recibido", "Ontvangen")}: {repair.nextPart.name}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* "Klaar voor controle" — altijd zichtbaar voor actieve
                klussen. Eén tap (na confirm) flipt naar ready_for_check. */}
            {showReadyButton ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkReady();
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm hover:bg-emerald-500/90 active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                {t("Ready for check", "Listo para revisión", "Klaar voor controle")}
              </button>
            ) : null}
            {showBeingChecked ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/[0.12] px-3 py-2.5 ring-1 ring-amber-400/25">
                <span className="relative inline-flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <span className="text-sm font-semibold text-amber-200">
                  {t("Being checked by office", "Siendo revisado por la oficina", "Wordt gecontroleerd door kantoor")}
                </span>
              </div>
            ) : null}
          </div>
        );
      })()}
    </article>
  );
}
