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
  XCircle,
  OctagonX,
  MapPin,
  Phone,
  Camera,
  Package,
  ClipboardList,
  Info,
  Flag,
  Sparkles,
  HandHelping,
} from "lucide-react";
import { useLanguage, LanguageToggle, type Language } from "@/components/garage/language-toggle";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { FindingDialog } from "@/components/garage/finding-dialog";
import { BlockerDialog } from "@/components/garage/blocker-dialog";
import { HandNeededSheet } from "@/components/garage/hand-needed-sheet";
import { GaragePhotoUpload } from "@/components/garage/photo-upload";
import { GaragePartsPicker } from "@/components/garage/parts-picker";
import { GarageRepairThread } from "@/components/garage/repair-thread";
import { WorkerPicker, type WorkerOption } from "@/components/garage/worker-picker";
import { VoiceRecorder, type VoiceClip } from "@/components/garage/voice-recorder";
import { uploadVoiceNote } from "@/lib/upload-voice-note";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  addGarageComment,
  suggestExtraTask,
  garageMarkDone,
  garageMarkNotDone,
  resolveBlocker as resolveBlockerAction,
} from "@/actions/garage";
import { markAdminMessageRead } from "@/actions/garage-sync";
import { startTimer, stopTimer } from "@/actions/time-entries";
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
  const [showNotDoneSheet, setShowNotDoneSheet] = useState(false);
  const [showFinding, setShowFinding] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [showHandNeeded, setShowHandNeeded] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentVoice, setCommentVoice] = useState<VoiceClip | null>(null);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [notDoneReason, setNotDoneReason] = useState("");
  const [isPending, startTransition] = useTransition();

  /* Worker picker state — every action that needs an actor opens this. */
  const [picker, setPicker] = useState<{
    purpose: "startTimer" | "taskStart";
    onPick: (worker: WorkerOption) => void;
    title?: string;
  } | null>(null);

  /* ── Derived ───────────────────────────────────────────────────── */
  const allDone = repair.tasks.length > 0 && repair.tasks.every((t) => t.status === "done");
  const doneCount = repair.tasks.filter((t) => t.status === "done").length;
  const hasTasks = repair.tasks.length > 0;
  const isActive = ["new", "todo", "scheduled", "in_progress", "in_inspection", "blocked"].includes(repair.status);
  const activeBlockers = repair.blockers.filter((b) => b.active);
  const unresolvedFindings = repair.findings.filter((f) => !f.resolvedAt);
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
        setPicker({
          purpose: "taskStart",
          title,
          onPick: (worker) => {
            setPicker(null);
            resolve(worker);
          },
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
        toast.error((err as Error)?.message ?? "Could not start timer");
      }
    });
  }

  async function handleStopTimer(timer: Props["activeTimers"][number]) {
    const worker = allUsers.find((u) => u.id === timer.userId);
    const lang = (worker?.preferredLanguage ?? "en") as Language;
    const ok = await confirmDialog({
      title: tFor(
        lang,
        `Pause timer for ${timer.userName ?? "worker"}?`,
        `¿Pausar temporizador de ${timer.userName ?? "trabajador"}?`,
        `Timer pauzeren voor ${timer.userName ?? "werker"}?`,
      ),
      description: tFor(
        lang,
        "Time stays saved on this repair for billing.",
        "El tiempo queda registrado en esta reparación.",
        "Tijd blijft opgeslagen op deze klus voor facturatie.",
      ),
      confirmLabel: tFor(lang, "Pause", "Pausar", "Pauzeren"),
      cancelLabel: tFor(lang, "Keep running", "Seguir", "Laten lopen"),
    });
    if (!ok) return;
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
      router.refresh();
    });
  }

  async function handleMarkNotDone() {
    if (!notDoneReason.trim()) return;
    startTransition(async () => {
      await garageMarkNotDone(repair.id, notDoneReason);
      setNotDoneReason("");
      setShowNotDoneSheet(false);
      toast.success(t("Status updated", "Estado actualizado", "Status bijgewerkt"));
      router.refresh();
    });
  }

  async function handleAddComment() {
    const hasText = commentText.trim().length > 0;
    if (!hasText && !commentVoice) return;
    startTransition(async () => {
      const finalText = hasText
        ? commentText
        : t("(voice note)", "(nota de voz)", "(spraakbericht)");
      const result = await addGarageComment(repair.id, finalText);
      if (commentVoice && result?.id) {
        const ok = await uploadVoiceNote({
          clip: commentVoice,
          ownerType: "comment",
          ownerId: result.id,
          repairJobId: repair.id,
        });
        if (!ok) {
          toast.warning(
            t(
              "Saved without voice — recording failed to upload.",
              "Guardado sin voz — error al subir.",
              "Opgeslagen zonder spraak — uploaden mislukt.",
            ),
          );
        }
      }
      setCommentText("");
      setCommentVoice(null);
      setShowCommentSheet(false);
      toast.success(t("Comment added", "Comentario añadido", "Opmerking toegevoegd"));
      router.refresh();
    });
  }

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

          {/* ── Hero ─────────────────────────────────────────── */}
          <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 ring-1 ring-white/[0.05]">
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

            {/* Hero-timer — direct onder de licentieplaat zodat een werker
                niet hoeft te scrollen om te zien "loopt er iets, hoe lang,
                en hoe pauzeer ik". Toont:
                - grote HH:MM:SS van de langst-lopende timer (de "klok
                  van de klus") + namen van actieve werkers
                - per-werker pauzeknop
                - als niemand bezig is: één duidelijke Start-knop
                  (auto-promoot status naar `in_progress` server-side) */}
            {activeTimers.length > 0 ? (
              <div className="mt-1 flex flex-col gap-2 rounded-2xl bg-emerald-500/[0.08] p-3 ring-1 ring-emerald-500/20">
                <div className="flex items-center gap-3">
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
                  <span className="ml-auto truncate text-[11px] font-medium uppercase tracking-wider text-emerald-300/70">
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
                      <span className="truncate text-[13px] font-semibold text-emerald-100">
                        {tm.userName ?? "—"}
                      </span>
                      <LiveElapsed start={tm.startedAt} />
                      <button
                        type="button"
                        onClick={() => handleStopTimer(tm)}
                        className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[12px] font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.97]"
                        aria-label={t("Pause", "Pausa", "Pauze")}
                      >
                        <Pause className="h-3.5 w-3.5" />
                        {t("Pause", "Pausa", "Pauze")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : canTimer ? (
              recordedMinutes > 0 ? (
                /* Er staat al tijd op deze repair maar er loopt nu niks
                   — dus "gepauzeerd". Toon de opgebouwde tijd groot in
                   beeld zodat je nooit het gevoel hebt dat je tijd
                   kwijt is, met een duidelijke Hervat-knop ernaast. */
                <div className="mt-1 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08]">
                  <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-white/30" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      {t("Paused", "En pausa", "Gepauzeerd")}
                    </p>
                    <p className="font-mono text-2xl font-bold leading-tight tabular-nums text-white/90">
                      {formatPausedDuration(recordedMinutes)}
                    </p>
                  </div>
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
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[14px] font-bold text-stone-950 shadow-md transition-all hover:bg-white/95 active:scale-[0.98]"
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
                  className="mt-1 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-stone-950 shadow-md transition-all hover:bg-white/95 active:scale-[0.98]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {t("Start timer", "Iniciar timer", "Start timer")}
                </button>
              )
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
                    onUpdate={handleRefresh}
                    onProblem={(taskId) => setProblemTaskId(taskId)}
                    onBeforeStart={async () => {
                      const w = await askWorker(
                        t("Who's starting this task?", "¿Quién empieza?", "Wie begint deze taak?"),
                      );
                      return !!w;
                    }}
                    photos={photosByTask.get(task.id) ?? []}
                    workerId={undefined}
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
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewPhoto(p.url)}
                    className="aspect-square overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] active:scale-[0.97]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? "photo"} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* ── Parts ───────────────────────────────────────── */}
          <Section
            icon={<Package className="h-4 w-4" />}
            title={t("Parts", "Piezas", "Onderdelen")}
            badge={repair.partRequests.filter((p) => p.status !== "received" && p.status !== "cancelled").length}
            defaultOpen={repair.partRequests.length > 0}
          >
            {repair.partRequests.length > 0 ? (
              <div className="mb-3 flex flex-col gap-1.5 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
                {repair.partRequests.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90">
                        {pr.partName}
                        {pr.quantity > 1 ? <span className="ml-1 text-white/40">×{pr.quantity}</span> : null}
                      </p>
                      {pr.supplierName ? (
                        <p className="truncate text-[11px] text-white/40">{pr.supplierName}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        pr.status === "received"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : pr.status === "shipped"
                            ? "bg-indigo-500/15 text-indigo-300"
                            : pr.status === "ordered"
                              ? "bg-blue-500/15 text-blue-300"
                              : pr.status === "cancelled"
                                ? "bg-white/[0.06] text-white/40"
                                : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {t(
                        pr.status.charAt(0).toUpperCase() + pr.status.slice(1),
                        pr.status === "received" ? "Recibida" : pr.status === "shipped" ? "Enviada" : pr.status === "ordered" ? "Pedida" : pr.status === "cancelled" ? "Cancelada" : "Solicitada",
                        pr.status === "received" ? "Ontvangen" : pr.status === "shipped" ? "Onderweg" : pr.status === "ordered" ? "Besteld" : pr.status === "cancelled" ? "Geannuleerd" : "Aangevraagd",
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {isActive ? (
              <GaragePartsPicker
                repairJobId={repair.id}
                t={t}
                partCategories={partCategories}
                onAdded={handleRefresh}
              />
            ) : null}
          </Section>

          {/* ── Findings ────────────────────────────────────── */}
          {(unresolvedFindings.length > 0 || repair.findings.length > 0) ? (
            <Section
              icon={<Sparkles className="h-4 w-4" />}
              title={t("Findings", "Hallazgos", "Bevindingen")}
              badge={unresolvedFindings.length || repair.findings.length}
              defaultOpen={unresolvedFindings.length > 0}
              action={
                <button
                  type="button"
                  onClick={() => setShowFinding(true)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-semibold text-white/70 hover:bg-white/[0.1] active:scale-[0.97]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("Add", "Añadir", "Toevoegen")}
                </button>
              }
            >
              <div className="flex flex-col gap-2">
                {repair.findings.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-start gap-2.5 rounded-xl p-3 ring-1 ${f.resolvedAt ? "bg-white/[0.03] ring-white/[0.06] opacity-60" : "bg-amber-500/[0.06] ring-amber-400/15"}`}
                  >
                    <span className="text-base">
                      {FINDING_CATEGORY_EMOJI[f.category as FindingCategory] ?? "🔧"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/90">
                        {FINDING_CATEGORY_LABELS[f.category as FindingCategory]}{" "}
                        <span className="text-white/40">·</span>{" "}
                        <span className="text-amber-300">
                          {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-white/70">{f.description}</p>
                      {f.createdByName ? (
                        <p className="mt-0.5 text-[11px] text-white/40">— {f.createdByName}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : (
            <button
              type="button"
              onClick={() => setShowFinding(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.04] text-sm font-medium text-white/60 ring-1 ring-white/[0.06] hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              {t("Add a finding", "Añadir hallazgo", "Bevinding toevoegen")}
            </button>
          )}

          {/* ── Conversation thread ─────────────────────────────────
               Collapsed by default — workers asked us to put doing-work
               sections first. Office messages still surface as a hero
               card above; this section is the full back-and-forth log.
             ────────────────────────────────────────────────────────── */}
          <Section
            icon={<MessageSquare className="h-4 w-4" />}
            title={t("Conversation", "Conversación", "Gesprek")}
            defaultOpen={false}
          >
            <GarageRepairThread repairJobId={repair.id} t={t} lang={deviceLang} />
          </Section>

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
              <>
                <button
                  type="button"
                  onClick={handleMarkDone}
                  disabled={isPending || repair.status === "completed"}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-md hover:bg-emerald-500/90 active:scale-[0.98] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("Ready for check", "Listo para revisión", "Klaar voor controle")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotDoneSheet(true)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 hover:bg-white/[0.1] active:scale-[0.97]"
                  aria-label={t("Not done", "No listo", "Niet klaar")}
                  title={t("Not done", "No listo", "Niet klaar")}
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowCommentSheet(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 hover:bg-white/[0.1] active:scale-[0.97]"
              aria-label={t("Comment", "Comentario", "Opmerking")}
              title={t("Comment", "Comentario", "Opmerking")}
            >
              <MessageSquare className="h-5 w-5" />
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
            <button
              type="button"
              onClick={() => setShowBlocker(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 active:scale-[0.97]"
              aria-label={t("Block", "Bloquear", "Blokkeer")}
              title={t("Block", "Bloquear", "Blokkeer")}
            >
              <OctagonX className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── Worker picker (overlay) ─────────────────────── */}
      <WorkerPicker
        open={!!picker}
        onClose={() => setPicker(null)}
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
          onComplete={handleRefresh}
        />
      ) : null}

      <HandNeededSheet
        open={showHandNeeded}
        onClose={() => setShowHandNeeded(false)}
        onSent={handleRefresh}
        repairJobId={repair.id}
        repairLabel={repair.title ?? repair.publicCode ?? undefined}
      />

      {showBlocker ? (
        <BlockerDialog
          repairJobId={repair.id}
          open={showBlocker}
          onClose={() => setShowBlocker(false)}
          onComplete={handleRefresh}
        />
      ) : null}

      {/* Comment sheet */}
      {showCommentSheet ? (
        <BottomSheet onClose={() => setShowCommentSheet(false)}>
          <h3 className="text-base font-semibold text-white">
            {t("Add a comment", "Añadir comentario", "Opmerking toevoegen")}
          </h3>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={4}
            placeholder={t("Type your comment…", "Escribe…", "Typ je opmerking…")}
            className="w-full rounded-xl bg-white/[0.06] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <VoiceRecorder
            value={commentVoice}
            onChange={setCommentVoice}
            t={t}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCommentSheet(false)}
              className="h-12 flex-1 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/80 hover:bg-white/[0.1] active:scale-[0.97]"
            >
              {t("Cancel", "Cancelar", "Annuleer")}
            </button>
            <button
              type="button"
              onClick={handleAddComment}
              disabled={isPending || (!commentText.trim() && !commentVoice)}
              className="h-12 flex-1 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-500/90 active:scale-[0.97] disabled:opacity-50"
            >
              {t("Send", "Enviar", "Verzenden")}
            </button>
          </div>
        </BottomSheet>
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

      {/* Not done sheet */}
      {showNotDoneSheet ? (
        <BottomSheet onClose={() => setShowNotDoneSheet(false)}>
          <h3 className="text-base font-semibold text-white">
            {t("Why isn't it done?", "¿Por qué no está listo?", "Waarom is het niet klaar?")}
          </h3>
          <textarea
            value={notDoneReason}
            onChange={(e) => setNotDoneReason(e.target.value)}
            rows={3}
            placeholder={t("Reason…", "Motivo…", "Reden…")}
            className="w-full rounded-xl bg-white/[0.06] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNotDoneSheet(false)}
              className="h-12 flex-1 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/70 hover:bg-white/[0.1]"
            >
              {t("Cancel", "Cancelar", "Annuleer")}
            </button>
            <button
              type="button"
              onClick={handleMarkNotDone}
              disabled={isPending || !notDoneReason.trim()}
              className="h-12 flex-1 rounded-xl bg-amber-500 text-sm font-bold text-stone-950 hover:bg-amber-500/90 disabled:opacity-50"
            >
              {t("Send", "Enviar", "Verzenden")}
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
