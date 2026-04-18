"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage, LanguageToggle } from "@/components/garage/language-toggle";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { FindingDialog } from "@/components/garage/finding-dialog";
import { BlockerDialog } from "@/components/garage/blocker-dialog";
import { GaragePhotoUpload } from "@/components/garage/photo-upload";
import { addGarageComment, suggestExtraTask, garageMarkDone, garageMarkNotDone, toggleMyWorker, resolveBlocker as resolveBlockerAction } from "@/actions/garage";
import { markAdminMessageRead } from "@/actions/garage-sync";
import { GaragePartsPicker } from "@/components/garage/parts-picker";
import { GarageRepairThread } from "@/components/garage/repair-thread";
import { stopTimer } from "@/actions/time-entries";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { getSelectableGarageUsers } from "@/lib/garage-workers";
import { inferGarageLanguageFromWorkerName, garageLangManualSessionKey } from "@/lib/garage-lang-by-worker";
import { useGarageMe } from "@/lib/garage-me";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { STATUS_LABELS, PRIORITY_LABELS, FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS } from "@/types";
import type { RepairTask, RepairPhoto, RepairStatus, Priority, FindingCategory, FindingSeverity, BlockerReason } from "@/types";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChevronLeft,
  RefreshCw,
  MapPin,
  ClipboardList,
  Camera,
  Package,
  Info,
  AlertTriangle,
  MessageSquare,
  Flag,
  OctagonX,
  Plus,
  CheckCircle2,
  XCircle,
  Square,
  X,
} from "lucide-react";

/* ─── Types ─── */

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
  partCategories: { id: string; key: string; label: string; icon: string; color: string; sortOrder: number; active: boolean }[];
  activeTimers: {
    id: string;
    userId: string;
    userName: string | null;
    startedAt: Date | string;
  }[];
  allUsers: { id: string; name: string | null; role: string | null }[];
}

type Tab = "tasks" | "photos" | "parts" | "info";

/* ─── Header Timer ─── */

function HeaderTimerDisplay({ timer, repairJobId, t, onStop }: {
  timer: { id: string; userId: string; userName: string | null; startedAt: Date | string };
  repairJobId: string;
  t: (en: string, es: string, nl: string) => string;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(timer.startedAt).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer.startedAt]);

  const handleStop = async () => {
    const ok = await confirmDialog({
      title: t(
        `Pause timer for ${timer.userName ?? "worker"}?`,
        `¿Pausar temporizador de ${timer.userName ?? "trabajador"}?`,
        `Timer pauzeren voor ${timer.userName ?? "werker"}?`,
      ),
      description: t(
        "Time is saved on this repair for billing.",
        "El tiempo queda registrado en esta reparación.",
        "Tijd wordt opgeslagen op deze klus voor facturatie.",
      ),
      confirmLabel: t("Pause", "Pausar", "Pauzeren"),
      cancelLabel: t("Keep running", "Seguir", "Laten lopen"),
    });
    if (!ok) return;
    hapticTap();
    await stopTimer(repairJobId, timer.userId);
    onStop();
  };

  return (
    <button
      type="button"
      onClick={handleStop}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-all active:scale-[0.97] active:bg-red-500/25 sm:gap-2 sm:px-3"
      aria-label={t("Pause timer", "Pausar temporizador", "Timer pauzeren")}
    >
      <Square className="h-3.5 w-3.5 shrink-0 fill-current" />
      <span className="max-w-[5rem] truncate text-[11px] font-medium text-white/70">
        {timer.userName?.split(" ")[0]}
      </span>
      <span className="font-mono text-[12.5px] tabular-nums">{elapsed}</span>
    </button>
  );
}

/* ─── Main ─── */

export function GarageRepairDetailClient({ repair, currentUserId, currentUserName, partCategories, activeTimers, allUsers }: Props) {
  const { t, setLang, lang } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [problemTaskId, setProblemTaskId] = useState<string | null>(null);
  const [showFinalCheck, setShowFinalCheck] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showNotDone, setShowNotDone] = useState(false);
  const [notDoneReason, setNotDoneReason] = useState("");
  const [showFinding, setShowFinding] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [workerPickerResolve, setWorkerPickerResolve] = useState<((ok: boolean) => void) | null>(null);
  const [lastPickedWorkerId, setLastPickedWorkerId] = useState<string | null>(null);
  const selectableUsers = useMemo(() => getSelectableGarageUsers(allUsers), [allUsers]);
  const { me } = useGarageMe();

  const allDone = repair.tasks.length > 0 && repair.tasks.every((t) => t.status === "done");
  const hasTasks = repair.tasks.length > 0;
  const doneCount = repair.tasks.filter((t) => t.status === "done").length;
  const isActive = ["new", "todo", "scheduled", "in_progress", "in_inspection", "blocked"].includes(repair.status);
  const activeBlockers = repair.blockers.filter(b => b.active);
  const unresolvedFindings = repair.findings.filter(f => !f.resolvedAt);
  // Priority for "who am I on this job": explicit tap > device-level "me" >
  // anyone already clocked in on the repair. This makes a single-tap flow
  // possible when the iPad already knows the worker.
  const meIsSelectable = !!me && selectableUsers.some((u) => u.id === me.id);
  const activeWorkerId =
    lastPickedWorkerId ??
    (meIsSelectable ? me!.id : null) ??
    repair.workers[0]?.userId ??
    null;
  const activeWorker = selectableUsers.find((u) => u.id === activeWorkerId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(garageLangManualSessionKey(repair.id))) return;
    } catch {
      return;
    }
    const workerDisplayName =
      activeWorker?.name ??
      repair.workers.find((w) => w.userId === activeWorkerId)?.userName ??
      null;
    const inferred = inferGarageLanguageFromWorkerName(workerDisplayName);
    if (!inferred) return;
    setLang(inferred);
  }, [repair.id, activeWorkerId, activeWorker?.name, repair.workers, setLang]);

  async function ensureActiveWorkerSelected() {
    if (activeWorker?.id) return true;
    // Fast path: the iPad already knows who's at it → silently clock them
    // in on this job. Avoids a redundant "who are you?" prompt on every
    // action when we already have the answer.
    if (meIsSelectable && me) {
      const isAssigned = repair.workers.some((w) => w.userId === me.id);
      if (!isAssigned) {
        await toggleMyWorker(repair.id, me.id);
      }
      setLastPickedWorkerId(me.id);
      router.refresh();
      return true;
    }
    const ok = await new Promise<boolean>((resolve) => {
      setWorkerPickerResolve(() => resolve);
      setShowWorkerPicker(true);
    });
    if (!ok) {
      toast.message(t("Select a worker first", "Selecciona primero un trabajador", "Kies eerst een werker"));
    }
    return ok;
  }

  // Check if any worker is assigned before starting a task
  async function handleBeforeStart(): Promise<boolean> {
    if (repair.workers.length > 0) return true;
    // Same fast path as above — no picker if we already know "me".
    if (meIsSelectable && me) {
      await toggleMyWorker(repair.id, me.id);
      setLastPickedWorkerId(me.id);
      router.refresh();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      setWorkerPickerResolve(() => resolve);
      setShowWorkerPicker(true);
    });
  }

  // Smart polling: only refresh when data actually changed
  useGaragePoll(repair.id);

  // Auto-mark admin message as read
  useEffect(() => {
    if (repair.garageAdminMessage && !repair.garageAdminMessageReadAt) {
      markAdminMessageRead(repair.id);
    }
  }, [repair.id, repair.garageAdminMessage, repair.garageAdminMessageReadAt]);

  // Flags
  const flags: { key: string; label: string; color: string }[] = [];
  if (repair.waterDamageRiskFlag) flags.push({ key: "water", label: t("Water Damage", "Daño Agua", "Waterschade"), color: "bg-blue-400/10 text-blue-400" });
  if (repair.safetyFlag) flags.push({ key: "safety", label: t("Safety", "Seguridad", "Veiligheid"), color: "bg-red-400/10 text-red-400" });
  if (repair.tyresFlag) flags.push({ key: "tyres", label: t("Tyres", "Neumáticos", "Banden"), color: "bg-white/[0.06] text-white/60" });
  if (repair.lightsFlag) flags.push({ key: "lights", label: t("Lights", "Luces", "Verlichting"), color: "bg-amber-400/10 text-amber-400" });
  if (repair.brakesFlag) flags.push({ key: "brakes", label: t("Brakes", "Frenos", "Remmen"), color: "bg-red-400/10 text-red-400" });
  if (repair.windowsFlag) flags.push({ key: "windows", label: t("Windows", "Ventanas", "Ramen"), color: "bg-teal-400/10 text-teal-400" });
  if (repair.sealsFlag) flags.push({ key: "seals", label: t("Seals", "Sellados", "Afdichtingen"), color: "bg-teal-400/10 text-teal-400" });
  if (repair.partsRequiredFlag) flags.push({ key: "parts", label: t("Parts Needed", "Piezas", "Onderdelen Nodig"), color: "bg-orange-400/10 text-orange-400" });
  if (repair.followUpRequiredFlag) flags.push({ key: "followup", label: t("Follow-up", "Seguimiento", "Follow-up"), color: "bg-violet-400/10 text-violet-400" });
  if (repair.customFlags && Array.isArray(repair.customFlags)) {
    for (const cf of repair.customFlags as string[]) {
      flags.push({ key: `custom-${cf}`, label: cf, color: "bg-violet-400/10 text-violet-400" });
    }
  }

  function handleRefresh() { router.refresh(); }

  async function handleMarkDone() {
    const ok = await ensureActiveWorkerSelected();
    if (!ok) return;
    startTransition(async () => {
      await garageMarkDone(repair.id);
      toast.success(t("Sent for review", "Enviado para revisión", "Klaar gemeld voor controle"));
      router.refresh();
    });
  }

  async function handleMarkNotDone() {
    if (!notDoneReason.trim()) return;
    const ok = await ensureActiveWorkerSelected();
    if (!ok) return;
    startTransition(async () => {
      await garageMarkNotDone(repair.id, notDoneReason);
      setNotDoneReason("");
      setShowNotDone(false);
      toast.success(t("Status updated", "Estado actualizado", "Status bijgewerkt"));
      router.refresh();
    });
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    const ok = await ensureActiveWorkerSelected();
    if (!ok) return;
    startTransition(async () => {
      await addGarageComment(repair.id, commentText);
      setCommentText("");
      setShowComment(false);
      toast.success(t("Comment added", "Comentario añadido", "Opmerking toegevoegd"));
      router.refresh();
    });
  }

  async function handleSuggest() {
    if (!suggestTitle.trim()) return;
    const ok = await ensureActiveWorkerSelected();
    if (!ok) return;
    startTransition(async () => {
      await suggestExtraTask(repair.id, suggestTitle, suggestDesc || undefined);
      setSuggestTitle("");
      setSuggestDesc("");
      setShowSuggest(false);
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

  const progress = repair.tasks.length > 0 ? Math.round((doneCount / repair.tasks.length) * 100) : 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "tasks", label: t("Tasks", "Tareas", "Taken"), icon: <ClipboardList className="h-5 w-5" />, badge: repair.tasks.length - doneCount || undefined },
    { key: "photos", label: t("Photos", "Fotos", "Foto's"), icon: <Camera className="h-5 w-5" />, badge: repair.photos.length || undefined },
    { key: "parts", label: t("Parts", "Piezas", "Delen"), icon: <Package className="h-5 w-5" />, badge: repair.partRequests.filter(p => p.status !== "received" && p.status !== "cancelled").length || undefined },
    { key: "info", label: "Info", icon: <Info className="h-5 w-5" />, badge: (activeBlockers.length + unresolvedFindings.length) || undefined },
  ];

  return (
    // `min-h-[100dvh]` handles mobile browser URL bar resize better than `h-screen`
    // which traps content behind the iOS Safari bottom chrome.
    <div className="flex min-h-[100dvh] flex-col bg-stone-950 text-white">

      {/* ─── HEADER ─── */}
      <header className="safe-area-pt sticky top-0 z-30 shrink-0 border-b border-white/[0.06] bg-stone-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-3 sm:px-4">
          {/* Nav row — always contains Back + Lang + Refresh. Running timers
              live on their own horizontally-scrollable row just below so we
              never overflow the header on phones when 2-3 people are
              clocked in on the same job. */}
          <div className="flex h-12 items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/garage")}
              className="-ml-2 inline-flex h-11 items-center gap-0.5 rounded-xl px-2 text-sm font-medium text-white/55 transition-all active:scale-95 active:bg-white/[0.06] active:text-white/80"
            >
              <ChevronLeft className="h-5 w-5" />
              {t("Back", "Atrás", "Terug")}
            </button>
            <div className="flex items-center gap-0.5">
              <LanguageToggle />
              <button
                type="button"
                onClick={handleRefresh}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white/40 transition-all active:scale-95 active:bg-white/[0.06]"
                aria-label={t("Refresh", "Actualizar", "Vernieuwen")}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Running-timer chips — scroll horizontally on phones, wrap on
              tablets. Keeping these close to the top makes "Pause" always
              reachable with one thumb. */}
          {activeTimers.length > 0 && (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto pb-2 sm:flex-wrap">
              {activeTimers.map((timer) => (
                <HeaderTimerDisplay
                  key={timer.id}
                  timer={timer}
                  repairJobId={repair.id}
                  t={t}
                  onStop={() => router.refresh()}
                />
              ))}
            </div>
          )}

          {/* Vehicle identity */}
          <div className="pb-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-[19px] font-bold tracking-tight text-white">
                {repair.unitRegistration || repair.publicCode || "—"}
              </h1>
              {(repair.priority === "urgent" || repair.priority === "high") && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    repair.priority === "urgent"
                      ? "bg-red-400/10 text-red-300"
                      : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {PRIORITY_LABELS[repair.priority as Priority]}
                </span>
              )}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  repair.status === "in_progress"
                    ? "bg-teal-400/10 text-teal-300"
                    : repair.status === "ready_for_check"
                      ? "bg-violet-400/10 text-violet-300"
                      : repair.status === "completed"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : repair.status === "blocked"
                          ? "bg-red-400/10 text-red-300"
                          : "bg-white/[0.06] text-white/50"
                }`}
              >
                {STATUS_LABELS[repair.status as RepairStatus]}
              </span>
            </div>
            <p className="text-[12.5px] text-white/45">
              {[repair.customerName, repair.unitBrand, repair.unitModel]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {hasTasks && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      progress === 100
                        ? "bg-emerald-400"
                        : "bg-gradient-to-r from-teal-400 to-teal-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[11.5px] font-medium tabular-nums text-white/35">
                  {doneCount}/{repair.tasks.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── CONTENT AREA ─── */}
      {/* pb-44 keeps the sticky bottom action bar from covering the last card */}
      <main className="flex-1 pb-44">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4">

          {/* Admin message banner — keeps the latest single message glanceable */}
          {repair.garageAdminMessage && (
            <div className="motion-safe:animate-slide-up mb-3 rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-400/[0.08] to-teal-400/[0.04] px-4 py-3.5 shadow-[0_0_0_1px_rgba(20,184,166,0.10)]">
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-5 w-5 items-center justify-center">
                  {!repair.garageAdminMessageReadAt ? (
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-teal-400/70" />
                  ) : null}
                  <MessageSquare className="relative h-4 w-4 text-teal-300" />
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                  {t("Office Message", "Mensaje de Oficina", "Kantoor Bericht")}
                </h3>
              </div>
              <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-white/85">
                {repair.garageAdminMessage}
              </p>
              {repair.garageAdminMessageAt && (
                <p className="mt-1.5 text-[11px] text-teal-400/55">
                  {new Date(repair.garageAdminMessageAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}

          {/* Bidirectional admin ↔ garage thread */}
          <GarageRepairThread repairJobId={repair.id} t={t} lang={lang} />

          {/* Active blockers banner */}
          {activeBlockers.length > 0 && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5 mb-4 space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                {t("Blocked", "Bloqueado", "Geblokkeerd")} ({activeBlockers.length})
              </h3>
              {activeBlockers.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-red-400">
                      {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                    </span>
                    {b.description && <p className="text-sm text-red-300/70 mt-0.5">{b.description}</p>}
                    <p className="text-[11px] text-red-400/50 mt-0.5">{b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleResolveBlocker(b.id)}
                    disabled={isPending}
                    className="shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-400 active:bg-emerald-500/20"
                  >
                    ✓ {t("Resolve", "Resolver", "Oplossen")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Final check failed */}
          {repair.finalCheckStatus === "failed" && repair.finalCheckNotes && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5 mb-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-400 mb-1">
                {t("Final Check Failed", "Control Final Fallido", "Natest Afgekeurd")}
              </h3>
              <p className="text-sm text-red-300">{repair.finalCheckNotes}</p>
            </div>
          )}

          {/* ═══ TAB: TASKS ═══ */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Team: tap name = who gets task/timer; ✕ = remove from job */}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-semibold mb-2">
                  {t("Team on this job", "Equipo en este trabajo", "Team op deze klus")}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectableUsers.map((user) => {
                    const isAssigned = repair.workers.some((w) => w.userId === user.id);
                    const isActive = activeWorkerId === user.id;
                    return (
                      <div
                        key={user.id}
                        className={`inline-flex items-stretch rounded-full overflow-hidden min-h-11 border transition-all ${
                          isActive
                            ? "border-teal-400/50 bg-teal-400/[0.08] ring-1 ring-teal-400/25"
                            : isAssigned
                              ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                              : "border-white/[0.08] bg-white/[0.03]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            hapticTap();
                            if (isAssigned) {
                              setLastPickedWorkerId(user.id);
                              return;
                            }
                            startTransition(async () => {
                              await toggleMyWorker(repair.id, user.id);
                              setLastPickedWorkerId(user.id);
                              router.refresh();
                            });
                          }}
                          disabled={isPending}
                          className={`inline-flex items-center gap-2 pl-3 pr-2 py-2.5 text-base font-medium transition-all active:scale-[0.99] disabled:opacity-50 ${
                            isAssigned ? "text-emerald-200" : "text-white/55"
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white shrink-0 ${
                              isAssigned ? "bg-emerald-500" : "bg-white/20"
                            }`}
                          >
                            {(user.name ?? "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="max-w-[140px] truncate">{user.name}</span>
                          {isAssigned && <span className="text-emerald-400 text-xs font-bold">✓</span>}
                        </button>
                        {isAssigned && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              hapticTap();
                              startTransition(async () => {
                                await toggleMyWorker(repair.id, user.id);
                                if (lastPickedWorkerId === user.id) {
                                  setLastPickedWorkerId(null);
                                }
                                router.refresh();
                              });
                            }}
                            className="shrink-0 px-2.5 border-l border-white/10 text-white/35 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 disabled:opacity-40"
                            aria-label={t("Remove from job", "Quitar del trabajo", "Van klus halen")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Flags */}
              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {flags.map((f) => (
                    <span key={f.key} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${f.color}`}>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Office notes */}
              {(repair.descriptionRaw || repair.notesRaw || repair.internalComments) && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] pl-4 pr-4 py-3.5 border-l-[3px] border-l-amber-400/50">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-white/30 mb-1.5">
                    {t("Office Notes", "Notas de Oficina", "Kantoor Notities")}
                  </p>
                  {repair.descriptionRaw && <p className="text-sm whitespace-pre-wrap text-white/70 leading-relaxed">{repair.descriptionRaw}</p>}
                  {repair.notesRaw && <p className="text-sm whitespace-pre-wrap mt-1.5 text-white/50 leading-relaxed">{repair.notesRaw}</p>}
                  {repair.internalComments && <p className="text-sm whitespace-pre-wrap mt-1.5 text-white/30 italic leading-relaxed">{repair.internalComments}</p>}
                </div>
              )}

              {/* Task list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-white/90">
                    {t("Tasks", "Tareas", "Taken")}
                  </h2>
                  <button
                    onClick={() => setShowSuggest(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 h-8 text-xs font-medium text-white/50 active:bg-white/[0.06]"
                  >
                    <Plus className="h-3 w-3" />
                    {t("Task", "Tarea", "Taak")}
                  </button>
                </div>
                {hasTasks ? (
                  <div className="space-y-2">
                    {repair.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        repairJobId={repair.id}
                        repairJobStatus={repair.status}
                        onUpdate={handleRefresh}
                        onProblem={(id) => setProblemTaskId(id)}
                        onBeforeStart={handleBeforeStart}
                        workerId={activeWorkerId ?? undefined}
                        photos={repair.photos.filter((p) => p.repairTaskId === task.id).map((p) => ({ id: p.id, url: p.thumbnailUrl ?? p.url, caption: p.caption }))}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-8 px-4 text-center">
                    <ClipboardList className="h-8 w-8 text-white/10 mx-auto mb-2" />
                    <p className="text-sm text-white/30">{t("No tasks yet", "Sin tareas todav\u00eda", "Nog geen taken")}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: PHOTOS ═══ */}
          {activeTab === "photos" && (
            <div className="space-y-4">
              {/* Task photos grouped by task */}
              {repair.tasks
                .filter((task) => repair.photos.some((p) => p.repairTaskId === task.id))
                .map((task) => (
                  <div key={task.id}>
                    <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ClipboardList className="h-3 w-3" />
                      {task.title}
                      <span className="text-[10px] bg-white/[0.06] text-white/40 rounded-full px-1.5 py-0.5 font-bold">
                        {repair.photos.filter((p) => p.repairTaskId === task.id).length}
                      </span>
                    </h3>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                      <div className="grid grid-cols-3 gap-0.5 p-0.5">
                        {repair.photos
                          .filter((p) => p.repairTaskId === task.id)
                          .map((photo) => (
                            <button
                              key={photo.id}
                              onClick={() => setViewPhoto(photo.thumbnailUrl ?? photo.url)}
                              className="aspect-square overflow-hidden bg-white/[0.04]"
                            >
                              <img
                                src={photo.thumbnailUrl ?? photo.url}
                                alt={photo.caption || ""}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}

              {/* General photos + upload */}
              <div>
                {repair.photos.some((p) => p.repairTaskId) && (
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Camera className="h-3 w-3" />
                    {t("General", "General", "Algemeen")}
                  </h3>
                )}
                <GaragePhotoUpload
                  repairJobId={repair.id}
                  photos={repair.photos.filter((p) => !p.repairTaskId).map((p) => ({ id: p.id, url: p.thumbnailUrl ?? p.url, caption: p.caption }))}
                  onUpdate={handleRefresh}
                  t={t}
                />
              </div>
            </div>
          )}

          {/* ═══ TAB: PARTS ═══ */}
          {activeTab === "parts" && (
            <div className="space-y-4">
              {repair.partRequests.length > 0 && (
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white/90">{t("Requested Parts", "Piezas Solicitadas", "Aangevraagde Onderdelen")}</h2>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    repair.partRequests.every(p => p.status === "received") ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                  }`}>
                    {repair.partRequests.filter(p => p.status === "received").length}/{repair.partRequests.length} {t("received", "recibidas", "ontvangen")}
                  </span>
                </div>
              )}

              {repair.partRequests.length > 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                  {repair.partRequests.map((pr, i) => (
                    <div key={pr.id} className={`flex items-center justify-between px-4 py-3.5 text-sm ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                      <div className="min-w-0">
                        <span className="font-medium text-white/90">{pr.partName}</span>
                        {pr.quantity > 1 && <span className="text-white/30 ml-1">×{pr.quantity}</span>}
                        {pr.supplierName && <span className="text-xs text-white/30 ml-2">{pr.supplierName}</span>}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ml-2 ${
                        pr.status === "received" ? "bg-emerald-400/10 text-emerald-400" :
                        pr.status === "shipped" ? "bg-indigo-400/10 text-indigo-400" :
                        pr.status === "ordered" ? "bg-blue-400/10 text-blue-400" :
                        pr.status === "cancelled" ? "bg-white/[0.06] text-white/40" :
                        "bg-amber-400/10 text-amber-400"
                      }`}>
                        {t(
                          pr.status.charAt(0).toUpperCase() + pr.status.slice(1),
                          pr.status === "received" ? "Recibida" : pr.status === "shipped" ? "Enviada" : pr.status === "ordered" ? "Pedida" : pr.status === "cancelled" ? "Cancelada" : "Solicitada",
                          pr.status === "received" ? "Ontvangen" : pr.status === "shipped" ? "Onderweg" : pr.status === "ordered" ? "Besteld" : pr.status === "cancelled" ? "Geannuleerd" : "Aangevraagd"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] py-12 px-6 text-center">
                  <Package className="h-12 w-12 text-white/10 mx-auto mb-3" />
                  <p className="text-base text-white/30">{t("No parts requested yet", "Sin piezas solicitadas", "No parts yet aangevraagd")}</p>
                </div>
              )}

              {isActive && (
                <GaragePartsPicker
                  repairJobId={repair.id}
                  t={t}
                  partCategories={partCategories}
                  workerName={activeWorker?.name ?? undefined}
                />
              )}
            </div>
          )}

          {/* ═══ TAB: INFO ═══ */}
          {activeTab === "info" && (
            <div className="space-y-4">
              {/* Vehicle details */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                    {t("Vehicle", "Veh\u00edculo", "Voertuig")}
                  </h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {repair.unitRegistration && <InfoRow label={t("Registration", "Matrícula", "Kenteken")} value={repair.unitRegistration} mono />}
                  {repair.unitBrand && <InfoRow label={t("Brand", "Marca", "Merk")} value={`${repair.unitBrand} ${repair.unitModel || ""}`} />}
                  {repair.unitYear && <InfoRow label={t("Year", "Año", "Bouwjaar")} value={String(repair.unitYear)} />}
                  {repair.unitLength && <InfoRow label={t("Length", "Largo", "Lengte")} value={repair.unitLength} />}
                  {repair.unitChassisId && <InfoRow label={t("Chassis", "Chasis", "Chassis")} value={repair.unitChassisId} mono />}
                  {(repair.unitStorageLocation || repair.unitCurrentPosition) && (
                    <InfoRow
                      label={t("Location", "Ubicación", "Locatie")}
                      value={repair.unitCurrentPosition || repair.unitStorageLocation || ""}
                      icon={<MapPin className="h-3 w-3 text-white/30" />}
                    />
                  )}
                </div>
              </div>

              {/* Customer */}
              {repair.customerId && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04]">
                    <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                      {t("Customer", "Cliente", "Klant")}
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {repair.customerName && <InfoRow label={t("Name", "Nombre", "Naam")} value={repair.customerName} />}
                    {repair.customerPhone && (
                      <a href={`tel:${repair.customerPhone}`} className="block">
                        <InfoRow label={t("Phone", "Teléfono", "Telefoon")} value={repair.customerPhone} link />
                      </a>
                    )}
                    {repair.customerMobile && repair.customerMobile !== repair.customerPhone && (
                      <a href={`tel:${repair.customerMobile}`} className="block">
                        <InfoRow label={t("Mobile", "Móvil", "Mobiel")} value={repair.customerMobile} link />
                      </a>
                    )}
                    {repair.customerEmail && (
                      <a href={`mailto:${repair.customerEmail}`} className="block">
                        <InfoRow label={t("Email", "Email", "Email")} value={repair.customerEmail} link />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Job details */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                    {t("Job", "Trabajo", "Klus")}
                  </h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {repair.publicCode && <InfoRow label={t("Code", "Código", "Code")} value={repair.publicCode} mono />}
                  {repair.title && <InfoRow label={t("Title", "Título", "Titel")} value={repair.title} />}
                  <InfoRow label="Status" value={STATUS_LABELS[repair.status as RepairStatus] || repair.status} />
                  <InfoRow label={t("Priority", "Prioridad", "Prioriteit")} value={PRIORITY_LABELS[repair.priority as Priority] || repair.priority} />
                  {repair.dueDate && <InfoRow label={t("Due", "Vencimiento", "Deadline")} value={new Date(repair.dueDate).toLocaleDateString()} />}
                </div>
              </div>

              {/* Findings */}
              {unresolvedFindings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-2">
                    {t("Issues found", "Problemas", "Bevindingen")} ({unresolvedFindings.length})
                  </h3>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    {unresolvedFindings.map((f, i) => (
                      <div key={f.id} className={`flex items-start gap-2.5 px-4 py-3 text-sm ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                        <span className="text-base mt-0.5 shrink-0">{FINDING_CATEGORY_EMOJI[f.category as FindingCategory]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-white/90">{FINDING_CATEGORY_LABELS[f.category as FindingCategory]}</span>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              f.severity === "critical" ? "bg-red-400/10 text-red-400" : f.severity === "minor" ? "bg-white/[0.06] text-white/40" : "bg-amber-400/10 text-amber-400"
                            }`}>
                              {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                            </span>
                            {f.requiresCustomerApproval && (
                              <span className="inline-flex items-center rounded-full bg-orange-400/10 text-orange-400 px-1.5 py-0.5 text-[10px] font-medium">
                                {t("Approval", "Aprobación", "Goedkeuring")}
                              </span>
                            )}
                          </div>
                          <p className="text-white/50 mt-0.5">{f.description}</p>
                          <p className="text-[11px] text-white/25 mt-0.5">{f.createdByName} · {new Date(f.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── BOTTOM: Action bar + Tab nav ─── */}
      <div className="safe-area-pb fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-stone-950/95 backdrop-blur-xl">
        {/* Action buttons */}
        {isActive && (
          <div className="mx-auto max-w-4xl px-4 pb-1 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  handleMarkDone();
                }}
                disabled={isPending}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all active:scale-[0.98] active:bg-emerald-600 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("Ready for Check", "Listo para Revisión", "Klaar voor Controle")}
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setShowNotDone(true);
                }}
                aria-label={t("Mark not done", "Marcar como no hecho", "Markeer als niet klaar")}
                className="flex h-11 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 text-sm font-medium text-white/55 transition-all active:scale-[0.98] active:bg-white/[0.06]"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick actions row */}
        <div className="mx-auto max-w-4xl px-4 py-1.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setShowComment(true);
              }}
              className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white/[0.04] text-[12px] font-medium text-white/45 transition-all active:scale-[0.98] active:bg-white/[0.08]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {t("Comment", "Nota", "Opmerking")}
            </button>
            {isActive && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    hapticTap();
                    const ok = await ensureActiveWorkerSelected();
                    if (!ok) return;
                    setShowFinding(true);
                  }}
                  className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white/[0.04] text-[12px] font-medium text-white/45 transition-all active:scale-[0.98] active:bg-white/[0.08]"
                >
                  <Flag className="h-3.5 w-3.5" />
                  {t("Issue", "Problema", "Bevinding")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    hapticTap();
                    const ok = await ensureActiveWorkerSelected();
                    if (!ok) return;
                    setShowBlocker(true);
                  }}
                  className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white/[0.04] text-[12px] font-medium text-white/45 transition-all active:scale-[0.98] active:bg-white/[0.08]"
                >
                  <OctagonX className="h-3.5 w-3.5" />
                  {t("Block", "Bloqueo", "Blokkade")}
                </button>
              </>
            )}
            {allDone && repair.finalCheckStatus !== "passed" && (
              <button
                type="button"
                onClick={() => setShowFinalCheck(true)}
                className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-amber-400/10 text-[12px] font-semibold text-amber-300 transition-all active:scale-[0.98] active:bg-amber-400/20"
              >
                {t("Final Check", "Control", "Natest")}
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mx-auto max-w-4xl">
          <div className="flex">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => {
                    hapticTap();
                    setActiveTab(tab.key);
                  }}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                    active ? "text-white" : "text-white/35"
                  }`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.badge && tab.badge > 0 ? (
                      <span className="absolute -right-1.5 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                        {tab.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                  {active ? (
                    <span className="absolute left-1/4 right-1/4 top-0 h-0.5 rounded-full bg-white" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── DIALOGS ─── */}
      <ProblemDialog open={!!problemTaskId} onClose={() => setProblemTaskId(null)} taskId={problemTaskId} onComplete={handleRefresh} />
      <FinalCheckDialog repairJobId={repair.id} open={showFinalCheck} onClose={() => setShowFinalCheck(false)} onComplete={handleRefresh} />
      <FindingDialog repairJobId={repair.id} open={showFinding} onClose={() => setShowFinding(false)} onComplete={handleRefresh} />
      <BlockerDialog repairJobId={repair.id} open={showBlocker} onClose={() => setShowBlocker(false)} onComplete={handleRefresh} />

      {/* Worker Picker Dialog */}
      <Dialog open={showWorkerPicker} onOpenChange={(open) => {
        if (!open) {
          workerPickerResolve?.(false);
          setWorkerPickerResolve(null);
          setShowWorkerPicker(false);
        }
      }}>
        <DialogContent className="rounded-2xl max-w-sm bg-foreground border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle>{t("Who are you?", "¿Quién eres?", "Wie ben je?")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {selectableUsers.map((user) => (
              <button
                key={user.id}
                onClick={async () => {
                  const isAssigned = repair.workers.some((w) => w.userId === user.id);
                  if (!isAssigned) {
                    await toggleMyWorker(repair.id, user.id);
                  }
                  setLastPickedWorkerId(user.id);
                  setShowWorkerPicker(false);
                  workerPickerResolve?.(true);
                  setWorkerPickerResolve(null);
                  router.refresh();
                }}
                className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm font-medium text-white/80 active:bg-white/[0.08] transition-all"
              >
                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-teal-500 text-sm font-bold text-white shrink-0">
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </span>
                {user.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={showComment} onOpenChange={setShowComment}>
        <DialogContent className="rounded-2xl max-w-md bg-foreground border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle>{t("Add Comment", "Añadir Comentario", "Opmerking Toevoegen")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("Type your message...", "Escribe tu mensaje...", "Typ je bericht...")}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder:text-white/30"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowComment(false)} className="flex-1 h-11 rounded-xl">{t("Cancel", "Cancelar", "Annuleren")}</Button>
              <Button onClick={handleAddComment} disabled={!commentText.trim() || isPending} className="flex-1 h-11 rounded-xl">{t("Send", "Enviar", "Verstuur")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Not Done Dialog */}
      <Dialog open={showNotDone} onOpenChange={setShowNotDone}>
        <DialogContent className="rounded-2xl max-w-md bg-foreground border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400">{t("Why is it not done?", "¿Por qué no está listo?", "Waarom is het niet klaar?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <textarea
              value={notDoneReason}
              onChange={(e) => setNotDoneReason(e.target.value)}
              placeholder={t("Describe the problem...", "Describe el problema...", "Beschrijf het probleem...")}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder:text-white/30"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNotDone(false)} className="flex-1 h-11 rounded-xl">{t("Cancel", "Cancelar", "Annuleren")}</Button>
              <Button onClick={handleMarkNotDone} disabled={!notDoneReason.trim() || isPending} className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white">{t("Submit", "Enviar", "Verstuur")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggest Task Dialog */}
      <Dialog open={showSuggest} onOpenChange={setShowSuggest}>
        <DialogContent className="rounded-2xl max-w-md bg-foreground border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle>{t("Suggest Extra Task", "Sugerir Tarea Extra", "Extra Taak Voorstellen")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <input
              value={suggestTitle}
              onChange={(e) => setSuggestTitle(e.target.value)}
              placeholder={t("Task name...", "Nombre de tarea...", "Naam van taak...")}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder:text-white/30"
              autoFocus
            />
            <textarea
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder={t("Description (optional)...", "Descripción (opcional)...", "Beschrijving (optioneel)...")}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder:text-white/30"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSuggest(false)} className="flex-1 h-11 rounded-xl border-white/[0.1] text-white/70 hover:bg-white/[0.06]">{t("Cancel", "Cancelar", "Annuleren")}</Button>
              <Button onClick={handleSuggest} disabled={!suggestTitle.trim() || isPending} className="flex-1 h-11 rounded-xl">{t("Suggest", "Sugerir", "Voorstellen")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox (for grouped task photos) */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setViewPhoto(null)}>
            <XCircle className="h-5 w-5" />
          </button>
          <img src={viewPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/* ─── InfoRow helper ─── */

function InfoRow({ label, value, mono, link, icon }: { label: string; value: string; mono?: boolean; link?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-white/30">{label}</span>
      <span className={`text-sm text-right ${link ? "text-teal-400" : "text-white/80"} ${mono ? "font-mono" : ""} flex items-center gap-1`}>
        {icon}
        {value}
      </span>
    </div>
  );
}
