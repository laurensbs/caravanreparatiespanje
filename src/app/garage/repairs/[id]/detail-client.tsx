"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { FindingDialog } from "@/components/garage/finding-dialog";
import { BlockerDialog } from "@/components/garage/blocker-dialog";
import { addGarageComment, suggestExtraTask, updateRepairTitle, garageMarkDone, garageMarkNotDone, toggleMyWorker, resolveBlocker as resolveBlockerAction } from "@/actions/garage";
import { GaragePartsPicker } from "@/components/garage/parts-picker";
import { GarageTimer } from "@/components/garage/timer";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS } from "@/types";
import type { RepairTask, RepairPhoto, RepairStatus, Priority, FindingCategory, FindingSeverity, BlockerReason } from "@/types";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw } from "lucide-react";

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
}

export function GarageRepairDetailClient({ repair, currentUserId, currentUserName, partCategories, activeTimers }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [problemTaskId, setProblemTaskId] = useState<string | null>(null);
  const [showFinalCheck, setShowFinalCheck] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(repair.title ?? "");

  // Not done reason
  const [showNotDone, setShowNotDone] = useState(false);
  const [notDoneReason, setNotDoneReason] = useState("");

  // Findings & blockers
  const [showFinding, setShowFinding] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);

  // Collapsible sections
  const [showVehicle, setShowVehicle] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);

  const allDone = repair.tasks.length > 0 && repair.tasks.every((t) => t.status === "done");
  const hasTasks = repair.tasks.length > 0;
  const doneCount = repair.tasks.filter((t) => t.status === "done").length;
  const isActive = ["new", "todo", "scheduled", "in_progress", "in_inspection", "blocked"].includes(repair.status);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Collect active flags
  const flags: { key: string; label: string; color: string }[] = [];
  if (repair.waterDamageRiskFlag) flags.push({ key: "water", label: t("Water Damage", "Daño Agua", "Waterschade"), color: "bg-blue-100 text-blue-800 border-blue-200" });
  if (repair.safetyFlag) flags.push({ key: "safety", label: t("Safety", "Seguridad", "Veiligheid"), color: "bg-red-100 text-red-800 border-red-200" });
  if (repair.tyresFlag) flags.push({ key: "tyres", label: t("Tyres", "Neumáticos", "Banden"), color: "bg-gray-100 text-gray-800 border-gray-200" });
  if (repair.lightsFlag) flags.push({ key: "lights", label: t("Lights", "Luces", "Verlichting"), color: "bg-yellow-100 text-yellow-800 border-yellow-200" });
  if (repair.brakesFlag) flags.push({ key: "brakes", label: t("Brakes", "Frenos", "Remmen"), color: "bg-red-100 text-red-800 border-red-200" });
  if (repair.windowsFlag) flags.push({ key: "windows", label: t("Windows", "Ventanas", "Ramen"), color: "bg-cyan-100 text-cyan-800 border-cyan-200" });
  if (repair.sealsFlag) flags.push({ key: "seals", label: t("Seals", "Sellados", "Afdichtingen"), color: "bg-teal-100 text-teal-800 border-teal-200" });
  if (repair.partsRequiredFlag) flags.push({ key: "parts", label: t("Parts Needed", "Piezas", "Onderdelen Nodig"), color: "bg-orange-100 text-orange-800 border-orange-200" });
  if (repair.followUpRequiredFlag) flags.push({ key: "followup", label: t("Follow-up", "Seguimiento", "Follow-up"), color: "bg-purple-100 text-purple-800 border-purple-200" });

  function handleRefresh() {
    router.refresh();
  }

  function handleSaveTitle() {
    if (!titleValue.trim()) return;
    startTransition(async () => {
      await updateRepairTitle(repair.id, titleValue);
      setEditingTitle(false);
      toast.success(t("Title updated", "Título actualizado", "Titel bijgewerkt"));
      router.refresh();
    });
  }

  function handleMarkDone() {
    startTransition(async () => {
      await garageMarkDone(repair.id);
      toast.success(t("Sent for review", "Enviado para revisión", "Klaar gemeld voor controle"));
      router.refresh();
    });
  }

  function handleMarkNotDone() {
    if (!notDoneReason.trim()) return;
    startTransition(async () => {
      await garageMarkNotDone(repair.id, notDoneReason);
      setNotDoneReason("");
      setShowNotDone(false);
      toast.success(t("Status updated", "Estado actualizado", "Status bijgewerkt"));
      router.refresh();
    });
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    startTransition(async () => {
      await addGarageComment(repair.id, commentText);
      setCommentText("");
      setShowComment(false);
      toast.success(t("Comment added", "Comentario añadido", "Opmerking toegevoegd"));
      router.refresh();
    });
  }

  function handleSuggest() {
    if (!suggestTitle.trim()) return;
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

  const activeBlockers = repair.blockers.filter(b => b.active);
  const unresolvedFindings = repair.findings.filter(f => !f.resolvedAt);

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100 px-5 pt-4 pb-4 safe-area-pt">
        <div className="max-w-3xl mx-auto">
          {/* Nav row */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.push("/garage")}
              className="flex items-center gap-1 h-11 px-3 -ml-3 text-sm font-semibold text-gray-500 active:bg-gray-100 rounded-2xl transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> {t("Back", "Atrás", "Terug")}
            </button>
            <div className="flex items-center gap-1.5">
              <LanguageToggle />
              <button
                onClick={handleRefresh}
                className="h-11 w-11 flex items-center justify-center rounded-2xl text-gray-400 active:bg-gray-100 transition-all duration-150"
              >
                <RefreshCw className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Title area */}
          <div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {repair.unitRegistration && <span className="mr-2">{repair.unitRegistration}</span>}
              {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}
            </p>
            {/* Editable title */}
            {editingTitle ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
                <button onClick={handleSaveTitle} disabled={isPending} className="h-11 w-11 flex items-center justify-center rounded-xl text-green-600 active:bg-green-50">✓</button>
                <button onClick={() => setEditingTitle(false)} className="h-11 w-11 flex items-center justify-center rounded-xl text-gray-400 active:bg-gray-100">✕</button>
              </div>
            ) : (
              <p
                className="text-sm text-gray-500 mt-1 active:opacity-70 cursor-pointer"
                onClick={() => setEditingTitle(true)}
              >
                {repair.title || <span className="italic text-gray-400">{t("No title — tap to add", "Sin título", "Geen titel — tik om toe te voegen")}</span>}
                <span className="ml-1 text-xs opacity-40">✎</span>
              </p>
            )}
            {repair.customerName && (
              <p className="text-sm text-gray-400 mt-0.5">{repair.customerName}</p>
            )}
            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <span className="text-[11px] font-bold text-gray-300 tracking-widest uppercase">{repair.publicCode}</span>
              <Badge className={STATUS_COLORS[repair.status as RepairStatus]}>
                {STATUS_LABELS[repair.status as RepairStatus]}
              </Badge>
              <Badge className={PRIORITY_COLORS[repair.priority as Priority]}>
                {PRIORITY_LABELS[repair.priority as Priority]}
              </Badge>
              {hasTasks && (
                <span className="text-xs font-bold text-gray-400 tabular-nums ml-auto">
                  {doneCount}/{repair.tasks.length} {t("tasks", "tareas", "taken")}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-44 space-y-4 max-w-3xl mx-auto w-full">

        {/* ── Active blockers — prominent ── */}
        {activeBlockers.length > 0 && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">
              🚫 {t("Blocked", "Bloqueado", "Geblokkeerd")} ({activeBlockers.length})
            </h3>
            {activeBlockers.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-red-700">
                    {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                  </span>
                  {b.description && (
                    <p className="text-sm text-red-600 mt-0.5">{b.description}</p>
                  )}
                  <p className="text-[11px] text-red-500/60 mt-0.5">
                    {b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveBlocker(b.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-bold text-green-700 active:bg-green-100 transition-colors"
                >
                  ✓ {t("Resolve", "Resolver", "Oplossen")}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Flags ── */}
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span key={f.key} className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-[13px] font-bold ${f.color}`}>
                ⚠ {f.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Final check failed banner ── */}
        {repair.finalCheckStatus === "failed" && repair.finalCheckNotes && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">
              ✗ {t("Final Check Failed", "Control Final Fallido", "Natest Afgekeurd")}
            </h3>
            <p className="text-sm text-red-800">{repair.finalCheckNotes}</p>
          </div>
        )}

        {/* ── Office notes ── */}
        {(repair.descriptionRaw || repair.notesRaw || repair.internalComments) && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
              📋 {t("Office Notes", "Notas de Oficina", "Kantoor Notities")}
            </h3>
            {repair.descriptionRaw && (
              <p className="text-sm whitespace-pre-wrap text-gray-800">{repair.descriptionRaw}</p>
            )}
            {repair.notesRaw && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-gray-600">{repair.notesRaw}</p>
            )}
            {repair.internalComments && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-gray-500 italic">{repair.internalComments}</p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TASKS — Main focus area
            ══════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              {t("Tasks", "Tareas", "Taken")}
            </h3>
            {hasTasks && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 tabular-nums">
                  {doneCount}/{repair.tasks.length}
                </span>
                {/* Mini progress bar */}
                <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      doneCount === repair.tasks.length ? "bg-emerald-500" : "bg-sky-500"
                    }`}
                    style={{ width: `${repair.tasks.length > 0 ? (doneCount / repair.tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {hasTasks ? (
            <div className="space-y-3">
              {repair.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  repairJobId={repair.id}
                  onUpdate={handleRefresh}
                  onProblem={(id) => setProblemTaskId(id)}
                  photos={repair.photos.filter((p) => p.repairTaskId === task.id).map((p) => ({ id: p.id, url: p.thumbnailUrl ?? p.url, caption: p.caption }))}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
              <p>{t("No tasks assigned yet", "Sin tareas asignadas", "Nog geen taken toegewezen")}</p>
            </div>
          )}
        </div>

        {/* ── Timer ── */}
        {isActive && (
          <GarageTimer
            repairJobId={repair.id}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            activeTimers={activeTimers}
            t={t}
          />
        )}

        {/* ── Parts ── */}
        {(repair.partRequests.length > 0 || repair.partsRequiredFlag || isActive) && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                📦 {t("Parts", "Piezas", "Onderdelen")}
              </h3>
              {repair.partRequests.length > 0 && (
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                  repair.partRequests.every(p => p.status === "received")
                    ? "bg-green-50 text-green-600"
                    : "bg-orange-50 text-orange-600"
                }`}>
                  {repair.partRequests.filter(p => p.status === "received").length}/{repair.partRequests.length} {t("received", "recibidas", "ontvangen")}
                </span>
              )}
            </div>
            {repair.partRequests.length > 0 ? (
              <div className="space-y-2">
                {repair.partRequests.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium">{pr.partName}</span>
                      {pr.quantity > 1 && <span className="text-gray-500 ml-1">×{pr.quantity}</span>}
                      {pr.supplierName && <span className="text-xs text-gray-400 ml-2">{pr.supplierName}</span>}
                    </div>
                    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ml-2 ${
                      pr.status === "received" ? "bg-green-50 text-green-600" :
                      pr.status === "shipped" ? "bg-indigo-50 text-indigo-600" :
                      pr.status === "ordered" ? "bg-blue-50 text-blue-600" :
                      pr.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-50 text-yellow-600"
                    }`}>
                      {pr.status === "received" ? "✓" :
                       pr.status === "shipped" ? "🚚" :
                       pr.status === "ordered" ? "📋" :
                       pr.status === "cancelled" ? "✗" : "⏳"}{" "}
                      {t(
                        pr.status.charAt(0).toUpperCase() + pr.status.slice(1),
                        pr.status === "received" ? "Recibida" :
                        pr.status === "shipped" ? "Enviada" :
                        pr.status === "ordered" ? "Pedida" :
                        pr.status === "cancelled" ? "Cancelada" : "Solicitada",
                        pr.status === "received" ? "Ontvangen" :
                        pr.status === "shipped" ? "Onderweg" :
                        pr.status === "ordered" ? "Besteld" :
                        pr.status === "cancelled" ? "Geannuleerd" : "Aangevraagd"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t("Parts required — none ordered yet", "Se necesitan piezas — ninguna pedida", "Onderdelen nodig — nog niet besteld")}
              </p>
            )}
            {isActive && (
              <div className="mt-3">
                <GaragePartsPicker repairJobId={repair.id} t={t} />
              </div>
            )}
          </div>
        )}

        {/* ── Findings ── */}
        {unresolvedFindings.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              🔍 {t("Findings", "Hallazgos", "Bevindingen")} ({unresolvedFindings.length})
            </h3>
            <div className="space-y-2.5">
              {unresolvedFindings.map((f) => (
                <div key={f.id} className="flex items-start gap-2.5 text-sm">
                  <span className="text-lg mt-0.5 shrink-0">{FINDING_CATEGORY_EMOJI[f.category as FindingCategory]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">
                        {FINDING_CATEGORY_LABELS[f.category as FindingCategory]}
                      </span>
                      <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${
                        f.severity === "critical"
                          ? "bg-red-50 text-red-600"
                          : f.severity === "minor"
                          ? "bg-slate-50 text-slate-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                      </span>
                      {f.requiresCustomerApproval && (
                        <span className="inline-flex items-center rounded-lg bg-orange-50 text-orange-600 px-1.5 py-0.5 text-[10px] font-bold">
                          👤 {t("Approval", "Aprobación", "Goedkeuring")}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 mt-0.5">{f.description}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {f.createdByName} · {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Vehicle & Customer (collapsible) ── */}
        {(repair.unitId || repair.customerId) && (
          <button
            onClick={() => setShowVehicle(!showVehicle)}
            className="w-full flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50 transition-all"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              🚐 {t("Vehicle & Customer", "Vehículo y Cliente", "Voertuig & Klant")}
            </span>
            <span className="text-gray-300 text-sm">{showVehicle ? "▲" : "▼"}</span>
          </button>
        )}
        {showVehicle && (
          <div className="space-y-3 -mt-1">
            {/* Vehicle card */}
            {repair.unitId && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {repair.unitRegistration && (
                    <div><span className="text-gray-400">{t("Reg", "Mat", "Kenteken")}:</span> <span className="font-semibold text-gray-900">{repair.unitRegistration}</span></div>
                  )}
                  {(repair.unitBrand || repair.unitModel) && (
                    <div><span className="text-gray-400">{t("Model", "Modelo", "Model")}:</span> <span className="font-semibold text-gray-900">{[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}</span></div>
                  )}
                  {repair.unitYear && (
                    <div><span className="text-gray-400">{t("Year", "Año", "Jaar")}:</span> <span className="font-semibold text-gray-900">{repair.unitYear}</span></div>
                  )}
                  {repair.unitLength && (
                    <div><span className="text-gray-400">{t("Length", "Longitud", "Lengte")}:</span> <span className="font-semibold text-gray-900">{repair.unitLength}</span></div>
                  )}
                  {repair.unitChassisId && (
                    <div className="col-span-2"><span className="text-gray-400">{t("Chassis", "Chasis", "Chassis")}:</span> <span className="font-semibold text-gray-900">{repair.unitChassisId}</span></div>
                  )}
                  {repair.unitCurrentPosition && (
                    <div><span className="text-gray-400">{t("Position", "Posición", "Positie")}:</span> <span className="font-semibold text-gray-900">{repair.unitCurrentPosition}</span></div>
                  )}
                  {repair.unitStorageLocation && (
                    <div><span className="text-gray-400">{t("Storage", "Almacén", "Opslag")}:</span> <span className="font-semibold text-gray-900">{repair.unitStorageLocation}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Customer card */}
            {repair.customerId && (repair.customerPhone || repair.customerEmail || repair.customerMobile) && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  👤 {repair.customerName ?? t("Customer", "Cliente", "Klant")}
                </h3>
                <div className="space-y-2 text-sm">
                  {repair.customerPhone && (
                    <a href={`tel:${repair.customerPhone}`} className="flex items-center gap-2 text-blue-600 active:opacity-70 py-1">
                      📞 {repair.customerPhone}
                    </a>
                  )}
                  {repair.customerMobile && repair.customerMobile !== repair.customerPhone && (
                    <a href={`tel:${repair.customerMobile}`} className="flex items-center gap-2 text-blue-600 active:opacity-70 py-1">
                      📱 {repair.customerMobile}
                    </a>
                  )}
                  {repair.customerEmail && (
                    <a href={`mailto:${repair.customerEmail}`} className="flex items-center gap-2 text-blue-600 active:opacity-70 py-1">
                      ✉ {repair.customerEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Workers ── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            👷 {t("Workers", "Trabajadores", "Medewerkers")}
          </h3>
          <button
            onClick={() => {
              startTransition(async () => {
                await toggleMyWorker(repair.id);
                router.refresh();
              });
            }}
            disabled={isPending}
            className={`w-full rounded-2xl border-2 p-4 text-sm font-bold transition-all active:scale-[0.98] ${
              repair.workers.some(w => w.userId === currentUserId)
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-dashed border-gray-200 text-gray-500"
            }`}
          >
            {repair.workers.some(w => w.userId === currentUserId)
              ? `✓ ${t("I worked on this", "Trabajé en esto", "Ik heb hieraan gewerkt")}`
              : `+ ${t("I worked on this", "Trabajé en esto", "Ik heb hieraan gewerkt")}`}
          </button>
          {repair.workers.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {repair.workers.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold text-white ${
                    w.userId === currentUserId ? "bg-green-500" : "bg-blue-500"
                  }`}>
                    {w.userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{w.userName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Photos (collapsible) ── */}
        {repair.photos.length > 0 && (
          <>
            <button
              onClick={() => setShowPhotos(!showPhotos)}
              className="w-full flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50 transition-all"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                📸 {t("Photos", "Fotos", "Foto's")} ({repair.photos.length})
              </span>
              <span className="text-gray-300 text-sm">{showPhotos ? "▲" : "▼"}</span>
            </button>
            {showPhotos && (
              <div className="grid grid-cols-3 gap-2.5 -mt-1">
                {repair.photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                    <img
                      src={photo.thumbnailUrl ?? photo.url}
                      alt={photo.caption ?? ""}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Comment form ── */}
        {showComment && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">
              💬 {t("Add Comment", "Añadir Comentario", "Opmerking Toevoegen")}
            </h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("Type your message...", "Escribe tu mensaje...", "Typ je bericht...")}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowComment(false)} className="flex-1 h-12 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleAddComment} disabled={!commentText.trim() || isPending} className="flex-1 h-12 rounded-xl">
                {t("Send", "Enviar", "Verstuur")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Not done reason form ── */}
        {showNotDone && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
            <h3 className="text-sm font-bold text-amber-700">
              ⚠️ {t("Why is it not done?", "¿Por qué no está listo?", "Waarom is het niet klaar?")}
            </h3>
            <textarea
              value={notDoneReason}
              onChange={(e) => setNotDoneReason(e.target.value)}
              placeholder={t("Describe the problem...", "Describe el problema...", "Beschrijf het probleem...")}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNotDone(false)} className="flex-1 h-12 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button
                onClick={handleMarkNotDone}
                disabled={!notDoneReason.trim() || isPending}
                className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
              >
                {t("Submit", "Enviar", "Verstuur")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Suggest task form ── */}
        {showSuggest && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">
              ➕ {t("Suggest Extra Task", "Sugerir Tarea Extra", "Extra Taak Voorstellen")}
            </h3>
            <input
              value={suggestTitle}
              onChange={(e) => setSuggestTitle(e.target.value)}
              placeholder={t("Task name...", "Nombre de tarea...", "Naam van taak...")}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              autoFocus
            />
            <textarea
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder={t("Description (optional)...", "Descripción (opcional)...", "Beschrijving (optioneel)...")}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSuggest(false)} className="flex-1 h-12 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleSuggest} disabled={!suggestTitle.trim() || isPending} className="flex-1 h-12 rounded-xl">
                {t("Suggest", "Sugerir", "Voorstellen")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM ACTION BAR ─── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 z-30">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Primary row: Ready for Check / Not Done */}
          {isActive && !showComment && !showSuggest && !showNotDone && (
            <div className="flex gap-2.5">
              <button
                onClick={handleMarkDone}
                disabled={isPending}
                className="flex-1 rounded-2xl bg-amber-500 text-white p-4 text-sm font-bold active:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
              >
                🔍 {t("Ready for Check", "Listo para Revisión", "Klaar voor Controle")}
              </button>
              <button
                onClick={() => setShowNotDone(true)}
                className="rounded-2xl border border-gray-200 bg-white text-gray-600 px-5 p-4 text-sm font-bold active:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
              >
                ✗ {t("Not Done", "No Listo", "Niet Klaar")}
              </button>
            </div>
          )}
          {/* Secondary row: Comment, Extra Task, Finding, Blocker, Final Check */}
          {!showComment && !showSuggest && !showNotDone && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowComment(true)}
                className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[13px] font-bold text-gray-600 active:bg-gray-100 active:scale-[0.98] transition-all"
              >
                💬 {t("Comment", "Comentario", "Opmerking")}
              </button>
              <button
                onClick={() => setShowSuggest(true)}
                className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[13px] font-bold text-gray-600 active:bg-gray-100 active:scale-[0.98] transition-all"
              >
                ➕ {t("Task", "Tarea", "Taak")}
              </button>
              {isActive && (
                <>
                  <button
                    onClick={() => setShowFinding(true)}
                    className="flex-1 rounded-2xl border border-sky-100 bg-sky-50 p-3 text-[13px] font-bold text-sky-700 active:bg-sky-100 active:scale-[0.98] transition-all"
                  >
                    🔍 {t("Finding", "Hallazgo", "Bevinding")}
                  </button>
                  <button
                    onClick={() => setShowBlocker(true)}
                    className="flex-1 rounded-2xl border border-red-100 bg-red-50 p-3 text-[13px] font-bold text-red-700 active:bg-red-100 active:scale-[0.98] transition-all"
                  >
                    🚫 {t("Block", "Bloqueo", "Blokkade")}
                  </button>
                </>
              )}
              {allDone && repair.finalCheckStatus !== "passed" && (
                <button
                  onClick={() => setShowFinalCheck(true)}
                  className="flex-1 rounded-2xl bg-amber-500 text-white p-3 text-[13px] font-bold active:bg-amber-600 active:scale-[0.98] transition-all shadow-sm"
                >
                  🔍 {t("Check", "Control", "Natest")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── DIALOGS ─── */}
      <ProblemDialog
        open={!!problemTaskId}
        onClose={() => setProblemTaskId(null)}
        taskId={problemTaskId}
        onComplete={handleRefresh}
      />
      <FinalCheckDialog
        repairJobId={repair.id}
        open={showFinalCheck}
        onClose={() => setShowFinalCheck(false)}
        onComplete={handleRefresh}
      />
      <FindingDialog
        repairJobId={repair.id}
        open={showFinding}
        onClose={() => setShowFinding(false)}
        onComplete={handleRefresh}
      />
      <BlockerDialog
        repairJobId={repair.id}
        open={showBlocker}
        onClose={() => setShowBlocker(false)}
        onComplete={handleRefresh}
      />
    </div>
  );
}
