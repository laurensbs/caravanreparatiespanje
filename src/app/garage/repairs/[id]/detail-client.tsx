"use client";

import {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  ChevronDown,
  Play,
  Pause,
  AlertTriangle,
  MessageSquare,
  Plus,
  CheckCircle2,
  OctagonX,
  MapPin,
  Phone,
  Camera,
  ClipboardList,
  Info,
  Flag,
  Sparkles,
  HandHelping,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useLanguage, LanguageToggle, type Language } from "@/components/garage/language-toggle";
import { GarageThemeToggle } from "@/components/garage/theme-provider";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { FindingDialog } from "@/components/garage/finding-dialog";
import { HandNeededSheet } from "@/components/garage/hand-needed-sheet";
import { GarageChatSheet } from "@/components/garage/chat-sheet";
import { GaragePhotoUpload } from "@/components/garage/photo-upload";
import { WorkerPicker, type WorkerOption } from "@/components/garage/worker-picker";
import { uploadVoiceNote } from "@/lib/upload-voice-note";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  // addGarageComment blijft bestaan voor legacy; de comment-button gebruikt
  // nu garageReplyToAdmin zodat alles in de berichten-thread landt.
  suggestExtraTask,
  garageMarkDone,
  resolveBlocker as resolveBlockerAction,
  deleteFinding,
  updateFinding,
} from "@/actions/garage";
import { deleteRepairPhoto } from "@/actions/photos";
import { markAdminMessageRead } from "@/actions/garage-sync";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { GARAGE_TIMER_NO_TASKS } from "@/lib/garage-timer-errors";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  FINDING_CATEGORY_LABELS,
  FINDING_CATEGORY_EMOJI,
  FINDING_SEVERITY_LABELS,
  BLOCKER_REASON_LABELS,
} from "@/types";
import type {
  RepairTask,
  RepairPhoto,
  RepairStatus,
  Priority,
  FindingCategory,
  FindingSeverity,
  BlockerReason,
} from "@/types";
import { canStartGarageTimerOnRepair } from "@/lib/garage-timer-policy";

/* ───────────────────────────────────────────────────────────────────── */
/* Types                                                                  */
/* ───────────────────────────────────────────────────────────────────── */

type RepairDetail = {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  descriptionRaw: string | null;
  notesRaw: string | null;
  internalComments: string | null;
  customerName: string | null;
  customerId: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerMobile: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  unitId: string | null;
  unitYear: number | null;
  unitLength: string | null;
  unitChassisId: string | null;
  unitStorageLocation: string | null;
  unitCurrentPosition: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  finalCheckStatus: string | null;
  finalCheckNotes: string | null;
  waterDamageRiskFlag: boolean;
  safetyFlag: boolean;
  tyresFlag: boolean;
  lightsFlag: boolean;
  brakesFlag: boolean;
  windowsFlag: boolean;
  sealsFlag: boolean;
  partsRequiredFlag: boolean;
  followUpRequiredFlag: boolean;
  customFlags: string[] | null;
  tasks: RepairTask[];
  photos: RepairPhoto[];
  partRequests: {
    id: string;
    repairTaskId: string | null;
    taskTitle: string | null;
    partName: string;
    quantity: number;
    status: string;
    expectedDelivery: Date | string | null;
    receivedDate: Date | string | null;
    notes: string | null;
    supplierName: string | null;
  }[];
  workers: {
    id: string;
    userId: string;
    userName: string;
    note: string | null;
    createdAt: Date | string;
  }[];
  findings: {
    id: string;
    category: string;
    description: string;
    severity: string;
    requiresFollowUp: boolean;
    requiresCustomerApproval: boolean;
    resolvedAt: Date | string | null;
    createdAt: Date | string;
    createdByName: string | null;
  }[];
  blockers: {
    id: string;
    reason: string;
    description: string | null;
    active: boolean;
    createdAt: Date | string;
    resolvedAt: Date | string | null;
    createdByName: string | null;
  }[];
  garageAdminMessage: string | null;
  garageAdminMessageAt: Date | string | null;
  garageAdminMessageReadAt: Date | string | null;
};

interface Props {
  repair: RepairDetail;
  currentUserId: string;
  currentUserName: string;
  partCategories: {
    id: string;
    key: string;
    label: string;
    icon: string;
    color: string;
    sortOrder: number;
    active: boolean;
  }[];
  activeTimers: {
    id: string;
    userId: string;
    userName: string | null;
    startedAt: Date | string;
  }[];
  allUsers: {
    id: string;
    name: string | null;
    role: string | null;
    preferredLanguage?: Language | null;
  }[];
  /** Som van alle afgeronde time-entries op deze repair (in minuten).
   *  Gebruikt om "gepauzeerd — 1u 23m tot nu" te laten zien zodat tijd
   *  nooit onzichtbaar is, zelfs niet als er op dit moment geen timer
   *  loopt. */
  recordedMinutes: number;
}

/* ───────────────────────────────────────────────────────────────────── */
/* Helpers                                                                */
/* ───────────────────────────────────────────────────────────────────── */

/** Compacte "HH:MM" of "MMm"-weergave voor de gepauzeerde hero-state.
 *  Bewust niet seconden — gepauzeerde tijd staat stil, dus geen SS. */
function formatPausedDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}:00` : `${h}:${String(rest).padStart(2, "0")}`;
}

function elapsedString(start: Date | string | number): string {
  const t =
    typeof start === "number"
      ? start
      : typeof start === "string"
        ? new Date(start).getTime()
        : start.getTime();
  const diff = Math.max(0, Date.now() - t);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_TONE: Record<string, string> = {
  in_progress: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  ready_for_check: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  waiting_parts: "bg-orange-500/15 text-orange-300 ring-orange-400/20",
  waiting_customer: "bg-orange-500/15 text-orange-300 ring-orange-400/20",
  blocked: "bg-rose-500/15 text-rose-300 ring-rose-400/20",
  completed: "bg-stone-500/15 text-stone-300 ring-stone-400/20",
  invoiced: "bg-stone-500/15 text-stone-300 ring-stone-400/20",
  todo: "bg-sky-500/15 text-sky-300 ring-sky-400/20",
  new: "bg-sky-500/15 text-sky-300 ring-sky-400/20",
};

/* ───────────────────────────────────────────────────────────────────── */
/* Live elapsed badge                                                     */
/* ───────────────────────────────────────────────────────────────────── */

function LiveElapsed({ start }: { start: Date | string }) {
  const [label, setLabel] = useState(() => elapsedString(start));
  useEffect(() => {
    const id = setInterval(() => setLabel(elapsedString(start)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return <span className="font-mono text-base tabular-nums text-emerald-200">{label}</span>;
}

/** Groot HH:MM:SS bovenin het detail-scherm. Toont cumulatieve tijd:
 *  eerder opgebouwde minuten + lopende sessie van de langst-lopende
 *  timer. Zo reset de klok niet na een pauze+hervat, wat verwarring
 *  voorkomt ("waar is m'n tijd gebleven?"). */
function HeroLiveClock({
  start,
  baselineMinutes = 0,
}: {
  start: number | Date | string;
  baselineMinutes?: number;
}) {
  const startMs =
    typeof start === "number"
      ? start
      : typeof start === "string"
        ? new Date(start).getTime()
        : start.getTime();
  const render = () => {
    const ongoingSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    return fmtClockSeconds(baselineMinutes * 60 + ongoingSec);
  };
  const [label, setLabel] = useState(render);
  useEffect(() => {
    const id = setInterval(() => setLabel(render()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, baselineMinutes]);
  return (
    <span className="font-mono text-2xl font-bold leading-none tabular-nums text-emerald-100">
      {label}
    </span>
  );
}

/** Format een aantal seconden als HH:MM:SS of M:SS. */
function fmtClockSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/* ───────────────────────────────────────────────────────────────────── */
/* Section primitive                                                      */
/* ───────────────────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  badge,
  defaultOpen = true,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: number | string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.05]">
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            setOpen((v) => !v);
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
            {icon}
          </span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide text-white/80">
            {title}
          </h2>
          {badge !== undefined && badge !== 0 && badge !== "" ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[11px] font-bold text-white/70">
              {badge}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {action}
      </header>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/* Main                                                                   */
/* ───────────────────────────────────────────────────────────────────── */

export function GarageRepairDetailClient({
  repair,
  currentUserId,
  currentUserName,
  partCategories,
  activeTimers,
  allUsers,
  recordedMinutes,
}: Props) {
  const router = useRouter();
  const { t, deviceLang, tFor } = useLanguage();

  /* ── State ─────────────────────────────────────────────────────── */
  const [problemTaskId, setProblemTaskId] = useState<string | null>(null);
  const [showFinalCheck, setShowFinalCheck] = useState(false);
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const [showSuggestSheet, setShowSuggestSheet] = useState(false);
  const [showFinding, setShowFinding] = useState(false);
  const [showHandNeeded, setShowHandNeeded] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  /* Worker picker state — every action that needs an actor opens this. */
  const [picker, setPicker] = useState<{
    purpose: "startTimer" | "taskStart";
    onPick: (worker: WorkerOption) => void;
    onCancel?: () => void;
    title?: string;
  } | null>(null);

  /* ── Derived ───────────────────────────────────────────────────── */
  const allDone = repair.tasks.length > 0 && repair.tasks.every((t) => t.status === "done");
  const doneCount = repair.tasks.filter((t) => t.status === "done").length;
  const hasTasks = repair.tasks.length > 0;
  const isActive = ["new", "todo", "scheduled", "in_progress", "in_inspection", "blocked"].includes(repair.status);
  const activeBlockers = repair.blockers.filter((b) => b.active);

  /* Lokale overlay voor zojuist toegevoegde findings zodat ze meteen
     zichtbaar zijn zonder een server-refresh af te wachten. Zodra het
     volgende `router.refresh` binnenkomt vervangt `repair.findings`
     (vanuit props) effectief deze entries — dedupe op id. */
  const [optimisticFindings, setOptimisticFindings] = useState<typeof repair.findings>([]);
  const findings = useMemo(() => {
    const seen = new Set(repair.findings.map((f) => f.id));
    const extras = optimisticFindings.filter((f) => !seen.has(f.id));
    return [...extras, ...repair.findings];
  }, [repair.findings, optimisticFindings]);
  useEffect(() => {
    // Als alle optimistische entries binnen zijn gekomen via props,
    // ruim ze op zodat we geen achtergelaten state blijven meezeulen.
    setOptimisticFindings((prev) =>
      prev.filter((f) => !repair.findings.some((r) => r.id === f.id)),
    );
  }, [repair.findings]);

  const unresolvedFindings = findings.filter((f) => !f.resolvedAt);
  // "Mag een werker hier een timer starten?" — de server ondersteunt
  // auto-promote van `new|todo|scheduled|in_inspection` → `in_progress`
  // bij start, dus we tonen de knop ook in die statussen. Wachtstatus-
  // sen (waiting_customer/waiting_parts/blocked) en done-states blijven
  // verborgen.
  const canTimer =
    canStartGarageTimerOnRepair(repair.status) ||
    ["new", "todo", "scheduled", "in_inspection"].includes(repair.status);
  const progress = repair.tasks.length > 0 ? Math.round((doneCount / repair.tasks.length) * 100) : 0;

  /* ── Side effects ──────────────────────────────────────────────── */
  useGaragePoll(repair.id);

  useEffect(() => {
    if (repair.garageAdminMessage && !repair.garageAdminMessageReadAt) {
      markAdminMessageRead(repair.id);
    }
  }, [repair.id, repair.garageAdminMessage, repair.garageAdminMessageReadAt]);

  /* ── Worker-picker promise helper ──────────────────────────────── */
  const askWorker = useCallback(
    (title?: string) =>
      new Promise<WorkerOption | null>((resolve) => {
        // Één resolver die we zowel vanuit onPick als onClose/cancel
        // veilig kunnen aanroepen — zo blijft de aanroeper (TaskCard)
        // nooit hangen in een pending-state als de werker de picker
        // wegklikt zonder iemand te kiezen.
        let settled = false;
        const done = (worker: WorkerOption | null) => {
          if (settled) return;
          settled = true;
          setPicker(null);
          resolve(worker);
        };
        setPicker({
          purpose: "taskStart",
          title,
          onPick: (worker) => done(worker),
          onCancel: () => done(null),
        });
      }),
    [],
  );

  /* ── Actions ───────────────────────────────────────────────────── */
  const handleRefresh = () => router.refresh();

  async function handleStartTimer(worker: WorkerOption) {
    hapticTap();
    const lang = (worker.preferredLanguage ?? "en") as Language;
    startTransition(async () => {
      try {
        await startTimer(repair.id, worker.id);
        hapticSuccess();
        toast.success(
          tFor(
            lang,
            `Timer started — ${worker.name}`,
            `Temporizador iniciado — ${worker.name}`,
            `Timer gestart — ${worker.name}`,
          ),
        );
        router.refresh();
      } catch (err) {
        const msg = (err as Error)?.message ?? "Could not start timer";
        if (msg === GARAGE_TIMER_NO_TASKS) {
          toast.error(
            tFor(
              lang,
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

  async function handleStopTimer(timer: Props["activeTimers"][number]) {
    // Direct pauzeren zonder bevestiging — de actie is triviaal
    // terug te draaien (één tap op Hervatten) en tijd blijft altijd
    // bewaard, dus een extra modal is hier alleen maar in de weg.
    const worker = allUsers.find((u) => u.id === timer.userId);
    const lang = (worker?.preferredLanguage ?? "en") as Language;
    hapticTap();
    startTransition(async () => {
      await stopTimer(repair.id, timer.userId);
      hapticSuccess();
      toast.success(
        tFor(
          lang,
          `Timer paused — ${timer.userName}`,
          `Pausado — ${timer.userName}`,
          `Gepauzeerd — ${timer.userName}`,
        ),
      );
      router.refresh();
    });
  }

  async function handleMarkDone() {
    // Bevestigingsdialoog — "klaar melden" is onomkeerbaar voor de
    // werker (status gaat naar ready_for_check, admin pakt 't over),
    // dus een per-ongeluk tap mag niet meteen door. We geven ook
    // context mee: hoeveel taken nog open staan, of er een actieve
    // blokkade is, of de timer nog tikt. Dat laat de werker meteen
    // zien of het terecht is.
    const openTasks = repair.tasks.length - doneCount;
    const runningTimers = activeTimers.length;
    const blockerActive = activeBlockers.length;
    const warnings: string[] = [];
    if (openTasks > 0) {
      warnings.push(
        t(
          `${openTasks} task${openTasks > 1 ? "s" : ""} still open`,
          `${openTasks} tarea${openTasks > 1 ? "s" : ""} sin completar`,
          `${openTasks} ta${openTasks > 1 ? "ken nog" : "ak nog"} open`,
        ),
      );
    }
    if (runningTimers > 0) {
      warnings.push(
        t(
          "Timer is still running — it will be paused",
          "Temporizador activo — se pausará",
          "Timer loopt nog — wordt automatisch gepauzeerd",
        ),
      );
    }
    if (blockerActive > 0) {
      warnings.push(
        t("There's an active blocker", "Hay un bloqueo activo", "Er is een actieve blokkade"),
      );
    }

    const description =
      warnings.length > 0
        ? `${t(
            "This sends the job to the office for review. You can't undo this from the garage.",
            "Esto envía el trabajo a la oficina para revisión. No se puede deshacer desde el taller.",
            "Hiermee stuur je de klus naar kantoor voor controle. Dit kun je vanuit de werkplaats niet meer terugdraaien.",
          )}\n\n⚠️ ${warnings.join(" · ")}`
        : t(
            "This sends the job to the office for review. You can't undo this from the garage.",
            "Esto envía el trabajo a la oficina para revisión. No se puede deshacer desde el taller.",
            "Hiermee stuur je de klus naar kantoor voor controle. Dit kun je vanuit de werkplaats niet meer terugdraaien.",
          );

    const ok = await confirmDialog({
      title: t("Mark this job ready for check?", "¿Marcar como listo para revisión?", "Klus klaar melden voor controle?"),
      description,
      confirmLabel: t("Yes, send to office", "Sí, enviar a oficina", "Ja, naar kantoor"),
      cancelLabel: t("Not yet", "Todavía no", "Nog niet"),
    });
    if (!ok) return;
    hapticSuccess();
    startTransition(async () => {
      await garageMarkDone(repair.id);
      toast.success(t("Sent for review", "Enviado para revisión", "Klaar gemeld voor controle"));
      // Terug naar overview — de klus is klaar voor kantoor, hier
      // hoeft de werker verder niets meer te doen. Scheelt een
      // extra tap en voorkomt per ongeluk nog iets aanpassen.
      router.push("/garage");
    });
  }

  // handleAddComment is vervangen door <GarageChatSheet/>; de chat doet
  // zijn eigen send via garageReplyToAdmin. Voice-notes zijn (voorlopig)
  // niet meer onderdeel van de chat; als we ze terugwillen voegen we
  // ownerId-round-trip toe aan garageReplyToAdmin.

  async function handleSuggestTask() {
    if (!suggestTitle.trim()) return;
    startTransition(async () => {
      await suggestExtraTask(repair.id, suggestTitle, suggestDesc || undefined);
      setSuggestTitle("");
      setSuggestDesc("");
      setShowSuggestSheet(false);
      toast.success(t("Task suggested", "Tarea sugerida", "Taak voorgesteld"));
      router.refresh();
    });
  }

  function handleResolveBlocker(blockerId: string) {
    startTransition(async () => {
      await resolveBlockerAction(blockerId);
      toast.success(t("Blocker resolved", "Bloqueo resuelto", "Blokkade opgelost"));
      router.refresh();
    });
  }

  /* ── Flags row ─────────────────────────────────────────────────── */
  const flagItems: { key: string; label: string; tone: string }[] = [];
  if (repair.waterDamageRiskFlag) flagItems.push({ key: "water", label: t("Water Damage", "Daño Agua", "Waterschade"), tone: "bg-blue-500/15 text-blue-300 ring-blue-400/20" });
  if (repair.safetyFlag) flagItems.push({ key: "safety", label: t("Safety", "Seguridad", "Veiligheid"), tone: "bg-rose-500/15 text-rose-300 ring-rose-400/20" });
  if (repair.tyresFlag) flagItems.push({ key: "tyres", label: t("Tyres", "Neumáticos", "Banden"), tone: "bg-white/[0.06] text-white/70 ring-white/10" });
  if (repair.lightsFlag) flagItems.push({ key: "lights", label: t("Lights", "Luces", "Verlichting"), tone: "bg-amber-500/15 text-amber-300 ring-amber-400/20" });
  if (repair.brakesFlag) flagItems.push({ key: "brakes", label: t("Brakes", "Frenos", "Remmen"), tone: "bg-rose-500/15 text-rose-300 ring-rose-400/20" });
  if (repair.windowsFlag) flagItems.push({ key: "windows", label: t("Windows", "Ventanas", "Ramen"), tone: "bg-teal-500/15 text-teal-300 ring-teal-400/20" });
  if (repair.sealsFlag) flagItems.push({ key: "seals", label: t("Seals", "Sellados", "Afdichtingen"), tone: "bg-teal-500/15 text-teal-300 ring-teal-400/20" });
  if (repair.partsRequiredFlag) flagItems.push({ key: "parts", label: t("Parts Needed", "Piezas", "Onderdelen Nodig"), tone: "bg-orange-500/15 text-orange-300 ring-orange-400/20" });
  if (repair.followUpRequiredFlag) flagItems.push({ key: "followup", label: t("Follow-up", "Seguimiento", "Follow-up"), tone: "bg-violet-500/15 text-violet-300 ring-violet-400/20" });
  if (repair.customFlags) {
    for (const cf of repair.customFlags) flagItems.push({ key: `custom-${cf}`, label: cf, tone: "bg-violet-500/15 text-violet-300 ring-violet-400/20" });
  }

  /* ── Photos by task lookup ─────────────────────────────────────── */
  const photosByTask = useMemo(() => {
    const m = new Map<string, RepairPhoto[]>();
    for (const p of repair.photos) {
      const k = p.repairTaskId ?? "__unassigned__";
      const list = m.get(k) ?? [];
      list.push(p);
      m.set(k, list);
    }
    return m;
  }, [repair.photos]);

  const partsByTask = useMemo(() => {
    const m = new Map<string, RepairDetail["partRequests"]>();
    for (const pr of repair.partRequests) {
      if (!pr.repairTaskId) continue;
      const list = m.get(pr.repairTaskId) ?? [];
      list.push(pr);
      m.set(pr.repairTaskId, list);
    }
    return m;
  }, [repair.partRequests]);

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-stone-950 text-white">
      {/* ─── Sticky header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-white/[0.06] bg-stone-950/90 backdrop-blur-xl"
        style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => router.push("/garage")}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 text-sm font-semibold text-white ring-1 ring-white/[0.08] hover:bg-white/[0.12] active:scale-[0.97]"
          >
            <ChevronLeft className="h-5 w-5" />
            {t("Back", "Atrás", "Terug")}
          </button>
          <div className="flex-1" />
          <LanguageToggle />
          <GarageThemeToggle />
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 ring-1 ring-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97]"
            aria-label={t("Refresh", "Actualizar", "Vernieuwen")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ─── Content ───────────────────────────────────────────── */}
      <main className="flex-1 pb-44">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 py-4 sm:px-5">

          {/* ── Hero ─────────────────────────────────────────────────
               Op mobiel stapelen we kolommen (info boven, timer eronder),
               op sm+ zetten we de timer expliciet NAAST de klantdetails:
               zo zie je in één oogopslag voor wie + wagen + hoe lang er
               al aan gewerkt wordt, zonder scrollen. */}
          <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 ring-1 ring-white/[0.05] sm:flex-row sm:items-stretch sm:gap-4">
            {/* Linker kolom — klant, wagen, status, voortgang, flags. */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-2xl font-bold tracking-tight text-white">
                  {repair.unitRegistration ?? repair.publicCode ?? "—"}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ${STATUS_TONE[repair.status] ?? "bg-white/[0.06] text-white/60 ring-white/10"}`}
                >
                  {STATUS_LABELS[repair.status as RepairStatus]}
                </span>
                {(repair.priority === "urgent" || repair.priority === "high") ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ${
                      repair.priority === "urgent"
                        ? "bg-rose-500/15 text-rose-300 ring-rose-400/20"
                        : "bg-amber-500/15 text-amber-300 ring-amber-400/20"
                    }`}
                  >
                    {PRIORITY_LABELS[repair.priority as Priority]}
                  </span>
                ) : null}
              </div>

              {repair.title ? (
                <p className="text-base text-white/85">{repair.title}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/55">
                {repair.customerName ? <span>{repair.customerName}</span> : null}
                {repair.unitBrand ? <span>{repair.unitBrand} {repair.unitModel ?? ""}</span> : null}
                {repair.unitCurrentPosition || repair.unitStorageLocation ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {repair.unitCurrentPosition ?? repair.unitStorageLocation}
                  </span>
                ) : null}
              </div>

              {hasTasks ? (
                <div className="flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${progress === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-teal-400 to-teal-500"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-white/60">
                    {doneCount}/{repair.tasks.length}
                  </span>
                </div>
              ) : null}

              {flagItems.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {flagItems.map((f) => (
                    <span
                      key={f.key}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${f.tone}`}
                    >
                      <Flag className="h-3 w-3" />
                      {f.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Rechter kolom — de werkelijke "klok van de klus".
                Mobiel: onderaan de hero. Tablet+: 280px strip naast
                de klant/wagen info. Een werker kan hier altijd zien
                of er iets loopt, hoe lang, en wie — en pauzeren of
                starten zonder te scrollen. Weggaan via Back is altijd
                veilig: de timer blijft server-side doortikken. */}
            {(activeTimers.length > 0 || canTimer) ? (
              <div className="flex shrink-0 flex-col gap-2 sm:w-[280px] sm:border-l sm:border-white/[0.05] sm:pl-4">
                {activeTimers.length > 0 ? (
                  <div className="flex h-full flex-col gap-2 rounded-2xl bg-emerald-500/[0.08] p-3 ring-1 ring-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      </span>
                      <HeroLiveClock
                        start={activeTimers.reduce((min, tm) => {
                          const ts = typeof tm.startedAt === "string"
                            ? new Date(tm.startedAt).getTime()
                            : tm.startedAt.getTime();
                          return ts < min ? ts : min;
                        }, Date.now())}
                        baselineMinutes={recordedMinutes}
                      />
                      <span className="ml-auto truncate text-[10px] font-medium uppercase tracking-wider text-emerald-300/70">
                        {activeTimers.length === 1
                          ? t("running", "en curso", "loopt")
                          : `${activeTimers.length} ${t("working", "trabajando", "bezig")}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {activeTimers.map((tm) => (
                        <div
                          key={tm.id}
                          className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.08] px-2.5 py-1.5 ring-1 ring-emerald-400/10"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-emerald-100">
                            {tm.userName ?? "—"}
                          </span>
                          <LiveElapsed start={tm.startedAt} />
                          <button
                            type="button"
                            onClick={() => handleStopTimer(tm)}
                            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[12px] font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.97]"
                            aria-label={t("Pause", "Pausa", "Pauze")}
                          >
                            <Pause className="h-3.5 w-3.5" />
                            {t("Pause", "Pausa", "Pauze")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : recordedMinutes > 0 ? (
                  /* Er staat al tijd op deze repair maar er loopt nu niks
                     — dus "gepauzeerd". Toon de opgebouwde tijd groot in
                     beeld zodat je nooit het gevoel hebt dat je tijd
                     kwijt is, met een duidelijke Hervat-knop ernaast. */
                  <div className="flex h-full flex-col gap-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-white/30" aria-hidden />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {t("Paused", "En pausa", "Gepauzeerd")}
                      </p>
                    </div>
                    <p className="font-mono text-3xl font-bold leading-none tabular-nums text-white/90">
                      {formatPausedDuration(recordedMinutes)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        hapticTap();
                        setPicker({
                          purpose: "startTimer",
                          onPick: (w) => {
                            setPicker(null);
                            handleStartTimer(w);
                          },
                          title: t("Who's resuming?", "¿Quién sigue?", "Wie gaat verder?"),
                        });
                      }}
                      className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-[14px] font-bold text-stone-950 shadow-md transition-all hover:bg-white/95 active:scale-[0.98]"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      {t("Resume", "Seguir", "Hervatten")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setPicker({
                        purpose: "startTimer",
                        onPick: (w) => {
                          setPicker(null);
                          handleStartTimer(w);
                        },
                        title: t("Who's starting?", "¿Quién empieza?", "Wie begint?"),
                      });
                    }}
                    className="flex h-full min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-4 text-stone-950 shadow-md transition-all hover:bg-white/95 active:scale-[0.98]"
                  >
                    <Play className="h-6 w-6 fill-current" />
                    <span className="text-[15px] font-bold">
                      {t("Start timer", "Iniciar timer", "Start timer")}
                    </span>
                  </button>
                )}
              </div>
            ) : null}
          </section>

          {/* NB: de oorspronkelijke "Start my timer"-knop hier is verhuisd
              naar de hero-kaart bovenin (zichtbaar zonder scrollen). */}

          {/* ── Office message ──────────────────────────────── */}
          {repair.garageAdminMessage ? (
            <section className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/[0.08] to-sky-400/[0.04] p-4">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/80">
                    {t("From the office", "De oficina", "Van kantoor")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">
                    {repair.garageAdminMessage}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Active blockers ─────────────────────────────── */}
          {activeBlockers.length > 0 ? (
            <Section
              icon={<OctagonX className="h-4 w-4 text-rose-300" />}
              title={t("Blocked", "Bloqueado", "Geblokkeerd")}
              badge={activeBlockers.length}
            >
              <div className="flex flex-col gap-2">
                {activeBlockers.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-start gap-3 rounded-xl bg-rose-500/[0.08] p-3 ring-1 ring-rose-400/20"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-rose-200">
                        {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                      </p>
                      {b.description ? (
                        <p className="mt-0.5 text-sm text-white/70">{b.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolveBlocker(b.id)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/15 active:scale-[0.97]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("Resolve", "Resolver", "Oplossen")}
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* ── Tasks ───────────────────────────────────────── */}
          <Section
            icon={<ClipboardList className="h-4 w-4" />}
            title={t("Tasks", "Tareas", "Taken")}
            badge={hasTasks ? `${doneCount}/${repair.tasks.length}` : 0}
            action={
              <button
                type="button"
                onClick={() => setShowSuggestSheet(true)}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-semibold text-white/70 hover:bg-white/[0.1] active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("Suggest", "Sugerir", "Voorstel")}
              </button>
            }
          >
            {hasTasks ? (
              <div className="flex flex-col gap-2">
                {repair.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    repairJobId={repair.id}
                    repairJobStatus={repair.status}
                    hasActiveTimer={activeTimers.length > 0}
                    onUpdate={handleRefresh}
                    onProblem={(taskId) => setProblemTaskId(taskId)}
                    onBeforeStart={async () => {
                      // Als er al iemand aan deze reparatie werkt, hoeven
                      // we de werker-picker niet opnieuw te tonen: de taak
                      // valt gewoon onder de al lopende timer. We geven
                      // `true` (legacy) terug zodat TaskCard alléén de
                      // status op in_progress zet en geen nieuwe timer
                      // start (dat zou de lopende timer auto-stoppen en
                      // herstarten — tijd kwijt).
                      if (activeTimers.length > 0) {
                        return true;
                      }
                      const w = await askWorker(
                        t("Who's starting this task?", "¿Quién empieza?", "Wie begint deze taak?"),
                      );
                      return w ? w.id : null;
                    }}
                    photos={photosByTask.get(task.id) ?? []}
                    taskLinkedParts={partsByTask.get(task.id) ?? []}
                    partCategories={partCategories}
                    deviceLang={deviceLang}
                  />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-white/40">
                {t("No tasks yet.", "Sin tareas aún.", "Nog geen taken.")}
              </p>
            )}
          </Section>

          {/* ── Photos ──────────────────────────────────────── */}
          <Section
            icon={<Camera className="h-4 w-4" />}
            title={t("Photos", "Fotos", "Foto's")}
            badge={repair.photos.length}
            defaultOpen={false}
            action={
              <GaragePhotoUpload
                repairJobId={repair.id}
                photos={photosByTask.get("__unassigned__") ?? []}
                onUpdate={handleRefresh}
                t={t}
                compact
              />
            }
          >
            {repair.photos.length === 0 ? (
              <div className="py-2">
                <GaragePhotoUpload
                  repairJobId={repair.id}
                  photos={photosByTask.get("__unassigned__") ?? []}
                  onUpdate={handleRefresh}
                  t={t}
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {repair.photos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]"
                  >
                    <button
                      type="button"
                      onClick={() => setViewPhoto(p.url)}
                      className="block h-full w-full active:scale-[0.97]"
                      aria-label={t("View photo", "Ver foto", "Foto bekijken")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption ?? "photo"} className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        hapticTap();
                        const ok = await confirmDialog({
                          title: t("Delete photo?", "¿Eliminar foto?", "Foto verwijderen?"),
                          description: t(
                            "The file stays in cloud storage, but is removed from this repair.",
                            "El archivo queda en la nube, pero se elimina de esta reparación.",
                            "Het bestand blijft in cloud-opslag, maar wordt uit deze reparatie verwijderd.",
                          ),
                          confirmLabel: t("Delete", "Eliminar", "Verwijderen"),
                          cancelLabel: t("Cancel", "Cancelar", "Annuleren"),
                          tone: "destructive",
                        });
                        if (!ok) return;
                        try {
                          await deleteRepairPhoto(p.id);
                          toast.success(t("Photo deleted", "Foto eliminada", "Foto verwijderd"));
                          handleRefresh();
                        } catch (err) {
                          toast.error((err as Error)?.message ?? "Could not delete photo");
                        }
                      }}
                      aria-label={t("Delete photo", "Eliminar foto", "Foto verwijderen")}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-rose-500 active:scale-90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Findings ──────────────────────────────────────
               De "Bevinding toevoegen"-trigger zit nu in de bottom
               action bar (✨ knop) naast 💬 en Hulp nodig. De lijst
               hieronder toont alleen al-aangemaakte findings; als er
               niks is, rendert er niks — de werker gebruikt de knop
               onderaan om een nieuwe aan te maken. */}
          {(unresolvedFindings.length > 0 || findings.length > 0) ? (
            <Section
              icon={<Sparkles className="h-4 w-4" />}
              title={t("Findings", "Hallazgos", "Bevindingen")}
              badge={unresolvedFindings.length || findings.length}
              defaultOpen={unresolvedFindings.length > 0}
            >
              <div className="flex flex-col gap-2">
                {findings.map((f) => (
                  <FindingRow
                    key={f.id}
                    finding={f}
                    t={t}
                    onSaved={(next) => {
                      setOptimisticFindings((prev) =>
                        prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)),
                      );
                      handleRefresh();
                    }}
                    onDeleted={(id) => {
                      setOptimisticFindings((prev) => prev.filter((x) => x.id !== id));
                      handleRefresh();
                    }}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* ── Conversation thread verwijderd ───────────────────────
               Berichten lopen nu via de "Opmerking" (💬) knop onderaan.
               De thread wordt in het admin-paneel pas zichtbaar als de
               reparatie is afgerond (status=completed).
             ────────────────────────────────────────────────────────── */}

          {/* ── Info ────────────────────────────────────────── */}
          <Section
            icon={<Info className="h-4 w-4" />}
            title={t("Info", "Información", "Info")}
            defaultOpen={false}
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {repair.publicCode ? (
                <>
                  <dt className="text-white/40">{t("Code", "Código", "Code")}</dt>
                  <dd className="font-mono text-white/85">{repair.publicCode}</dd>
                </>
              ) : null}
              {repair.unitChassisId ? (
                <>
                  <dt className="text-white/40">{t("Chassis", "Chasis", "Chassis")}</dt>
                  <dd className="font-mono text-white/85">{repair.unitChassisId}</dd>
                </>
              ) : null}
              {repair.unitYear ? (
                <>
                  <dt className="text-white/40">{t("Year", "Año", "Bouwjaar")}</dt>
                  <dd className="text-white/85">{repair.unitYear}</dd>
                </>
              ) : null}
              {repair.unitLength ? (
                <>
                  <dt className="text-white/40">{t("Length", "Longitud", "Lengte")}</dt>
                  <dd className="text-white/85">{repair.unitLength}</dd>
                </>
              ) : null}
              {repair.dueDate ? (
                <>
                  <dt className="text-white/40">{t("Due", "Fecha", "Inleverdatum")}</dt>
                  <dd className="text-white/85">
                    {new Date(repair.dueDate).toLocaleDateString(
                      deviceLang === "nl" ? "nl-NL" : deviceLang === "es" ? "es-ES" : "en-GB",
                    )}
                  </dd>
                </>
              ) : null}
              {repair.customerPhone ?? repair.customerMobile ? (
                <>
                  <dt className="text-white/40">{t("Phone", "Teléfono", "Telefoon")}</dt>
                  <dd>
                    <a
                      href={`tel:${repair.customerMobile ?? repair.customerPhone}`}
                      className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {repair.customerMobile ?? repair.customerPhone}
                    </a>
                  </dd>
                </>
              ) : null}
            </dl>

            {repair.descriptionRaw || repair.notesRaw ? (
              <div className="mt-4 space-y-3">
                {repair.descriptionRaw ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      {t("Description", "Descripción", "Beschrijving")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">
                      {repair.descriptionRaw}
                    </p>
                  </div>
                ) : null}
                {repair.notesRaw ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      {t("Notes", "Notas", "Notities")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">
                      {repair.notesRaw}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>
        </div>
      </main>

      {/* ─── Sticky bottom action bar ─────────────────────── */}
      {isActive ? (
        <div
          className="sticky bottom-0 z-30 border-t border-white/[0.06] bg-stone-950/95 backdrop-blur-xl"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-5">
            {allDone || repair.status === "ready_for_check" ? (
              <button
                type="button"
                onClick={() => setShowFinalCheck(true)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 text-sm font-bold text-white shadow-md hover:bg-violet-500/90 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("Final check", "Control final", "Eindcontrole")}
              </button>
            ) : (
              /* Alleen "Klaar voor controle" houden als hoofdactie.
                 De oude "Niet klaar / Why isn't it done?"-sheet voelt
                 dubbel met Blokkeer — als er een reden is dat het niet
                 af is, is dat ofwel een blocker, ofwel een opmerking.
                 Eén duidelijke groene actie scheelt twijfel. */
              <button
                type="button"
                onClick={handleMarkDone}
                disabled={isPending || repair.status === "completed"}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-md hover:bg-emerald-500/90 active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("Ready for check", "Listo para revisión", "Klaar voor controle")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (activeTimers.length === 0) {
                  toast.error(
                    t(
                      "Start your timer first so office knows who's writing.",
                      "Primero inicia tu temporizador para identificarte.",
                      "Start eerst je timer — dan weet kantoor wie er schrijft.",
                    ),
                  );
                  return;
                }
                setShowCommentSheet(true);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all active:scale-[0.97] ${
                activeTimers.length === 0
                  ? "bg-white/[0.03] text-white/30 ring-1 ring-white/[0.05]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
              }`}
              aria-label={t("Message", "Mensaje", "Bericht")}
              title={
                activeTimers.length === 0
                  ? t("Start timer first", "Inicia el temporizador primero", "Start eerst de timer")
                  : t("Send message to office", "Enviar mensaje a oficina", "Stuur bericht naar kantoor")
              }
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowFinding(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:scale-[0.97]"
              aria-label={t("Finding", "Hallazgo", "Bevinding")}
              title={t("Add a finding", "Añadir hallazgo", "Bevinding toevoegen")}
            >
              <Sparkles className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowHandNeeded(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 active:scale-[0.97]"
              aria-label={t("Hand needed", "Necesito ayuda", "Hulp nodig")}
              title={t("Hand needed", "Necesito ayuda", "Hulp nodig")}
            >
              <HandHelping className="h-5 w-5" />
            </button>
            {/* Blokkade-knop verwijderd — gebruik "Bevinding" (📋) en
                vink daar "Onderdeel nodig" of "Klantgoedkeuring nodig"
                aan. Dat zet de repair automatisch op waiting_parts /
                waiting_customer, hetzelfde gedrag als oude Blokkade. */}
          </div>
        </div>
      ) : null}

      {/* ─── Worker picker (overlay) ─────────────────────── */}
      <WorkerPicker
        open={!!picker}
        onClose={() => {
          picker?.onCancel?.();
          setPicker(null);
        }}
        onPick={(worker) => picker?.onPick(worker)}
        workers={allUsers}
        title={picker?.title}
        subtitle={repair.title ?? repair.publicCode ?? undefined}
      />

      {/* ─── Dialogs ─────────────────────────────────────── */}
      {problemTaskId ? (
        <ProblemDialog
          taskId={problemTaskId}
          open={!!problemTaskId}
          onClose={() => setProblemTaskId(null)}
          onComplete={handleRefresh}
        />
      ) : null}

      {showFinalCheck ? (
        <FinalCheckDialog
          repairJobId={repair.id}
          open={showFinalCheck}
          onClose={() => setShowFinalCheck(false)}
          onComplete={handleRefresh}
        />
      ) : null}

      {showFinding ? (
        <FindingDialog
          repairJobId={repair.id}
          open={showFinding}
          onClose={() => setShowFinding(false)}
          onComplete={(newFinding) => {
            // Meteen zichtbaar tonen in "Findings" zodat de werker
            // directe feedback krijgt dat z'n bevinding is genoteerd
            // — zonder te moeten wachten op de server-roundtrip die
            // `repair.findings` vernieuwt.
            if (newFinding) {
              setOptimisticFindings((prev) => [
                {
                  id: newFinding.id,
                  category: newFinding.category,
                  description: newFinding.description,
                  severity: newFinding.severity,
                  requiresFollowUp: newFinding.requiresFollowUp,
                  requiresCustomerApproval: newFinding.requiresCustomerApproval,
                  resolvedAt: null,
                  createdAt: new Date(),
                  createdByName: newFinding.createdByName ?? currentUserName,
                },
                ...prev,
              ]);
            }
            handleRefresh();
          }}
        />
      ) : null}

      <HandNeededSheet
        open={showHandNeeded}
        onClose={() => setShowHandNeeded(false)}
        onSent={handleRefresh}
        repairJobId={repair.id}
        repairLabel={repair.title ?? repair.publicCode ?? undefined}
      />

      {/* BlockerDialog is verwijderd — zie FindingDialog "Onderdeel nodig". */}

      {/* Volledige chat-sheet met office. Afzender = actieve timer-werker.
          De caller (💬-knop) blokkeert dit sheet al als er geen timer loopt. */}
      {showCommentSheet && activeTimers.length > 0 ? (
        <GarageChatSheet
          repairJobId={repair.id}
          repairTitle={repair.title ?? null}
          repairCode={repair.publicCode ?? null}
          authorName={activeTimers[0]!.userName ?? "Garage"}
          t={t}
          lang={deviceLang}
          onClose={() => setShowCommentSheet(false)}
        />
      ) : null}

      {/* Suggest task sheet */}
      {showSuggestSheet ? (
        <BottomSheet onClose={() => setShowSuggestSheet(false)}>
          <h3 className="text-base font-semibold text-white">
            {t("Suggest a task", "Sugerir tarea", "Taak voorstellen")}
          </h3>
          <input
            type="text"
            value={suggestTitle}
            onChange={(e) => setSuggestTitle(e.target.value)}
            placeholder={t("Short title…", "Título corto…", "Korte titel…")}
            className="h-12 w-full rounded-xl bg-white/[0.06] px-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <textarea
            value={suggestDesc}
            onChange={(e) => setSuggestDesc(e.target.value)}
            rows={3}
            placeholder={t("Optional details…", "Detalles…", "Toelichting…")}
            className="w-full rounded-xl bg-white/[0.06] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSuggestSheet(false)}
              className="h-12 flex-1 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/70 hover:bg-white/[0.1]"
            >
              {t("Cancel", "Cancelar", "Annuleer")}
            </button>
            <button
              type="button"
              onClick={handleSuggestTask}
              disabled={isPending || !suggestTitle.trim()}
              className="h-12 flex-1 rounded-xl bg-white text-sm font-bold text-stone-950 hover:bg-white/95 disabled:opacity-50"
            >
              {t("Suggest", "Sugerir", "Voorstellen")}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {/* Photo lightbox */}
      {viewPhoto ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewPhoto}
            alt="photo"
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/* BottomSheet primitive                                                  */
/* ───────────────────────────────────────────────────────────────────── */

/* ───────────────────────────────────────────────────────────────────── */
/* FindingRow — één kaart in de Findings-lijst                             */
/*                                                                         */
/* Inline edit en delete. Bewust géén categorie/severity-switcher hier:    */
/* de oorspronkelijke keuze gaat via de FindingDialog en dwingt de werker  */
/* na te denken over ernst. Alleen de omschrijving kan achteraf getypt     */
/* bijgewerkt worden — de meest voorkomende reden om terug te komen is    */
/* een typo of een extra detail.                                           */
/* ───────────────────────────────────────────────────────────────────── */

type FindingRowData = {
  id: string;
  category: string;
  description: string;
  severity: string;
  requiresFollowUp: boolean;
  requiresCustomerApproval: boolean;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  createdByName: string | null;
};

function FindingRow({
  finding: f,
  t,
  onSaved,
  onDeleted,
}: {
  finding: FindingRowData;
  t: (en: string, es: string, nl: string) => string;
  onSaved: (next: FindingRowData) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.description);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const next = draft.trim();
    if (!next || next === f.description) {
      setEditing(false);
      setDraft(f.description);
      return;
    }
    startTransition(async () => {
      try {
        await updateFinding(f.id, { description: next });
        onSaved({ ...f, description: next });
        setEditing(false);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not update finding");
      }
    });
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: t("Delete finding?", "¿Eliminar hallazgo?", "Bevinding verwijderen?"),
      description: t(
        "This cannot be undone.",
        "Esto no se puede deshacer.",
        "Dit kan niet ongedaan gemaakt worden.",
      ),
      confirmLabel: t("Delete", "Eliminar", "Verwijderen"),
      cancelLabel: t("Cancel", "Cancelar", "Annuleren"),
      tone: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteFinding(f.id);
        onDeleted(f.id);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not delete finding");
      }
    });
  }

  return (
    <div
      className={`group flex items-start gap-2.5 rounded-xl p-3 ring-1 ${f.resolvedAt ? "bg-white/[0.03] ring-white/[0.06] opacity-60" : "bg-amber-500/[0.06] ring-amber-400/15"}`}
    >
      <span className="text-base">
        {FINDING_CATEGORY_EMOJI[f.category as FindingCategory] ?? "🔧"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white/90">
            {FINDING_CATEGORY_LABELS[f.category as FindingCategory]}{" "}
            <span className="text-white/40">·</span>{" "}
            <span className="text-amber-300">
              {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
            </span>
          </p>
          {!editing && !f.resolvedAt ? (
            <div className="-mt-1 flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => { hapticTap(); setEditing(true); setDraft(f.description); }}
                disabled={isPending}
                aria-label={t("Edit", "Editar", "Bewerken")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-all hover:bg-white/[0.06] hover:text-white/80 active:scale-90 disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                aria-label={t("Delete", "Eliminar", "Verwijderen")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-300/70 transition-all hover:bg-rose-500/10 hover:text-rose-300 active:scale-90 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={2}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft(f.description); }}
                disabled={isPending}
                className="h-8 rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-white/70 hover:bg-white/[0.1] disabled:opacity-40"
              >
                {t("Cancel", "Cancelar", "Annuleer")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !draft.trim() || draft.trim() === f.description}
                className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-500/90 disabled:opacity-40"
              >
                {isPending
                  ? t("Saving…", "Guardando…", "Opslaan…")
                  : t("Save", "Guardar", "Opslaan")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-white/70">{f.description}</p>
            {f.createdByName ? (
              <p className="mt-0.5 text-[11px] text-white/40">— {f.createdByName}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function BottomSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-stone-900 p-5 shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  );
}
