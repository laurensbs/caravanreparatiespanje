"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { FindingDialog } from "@/components/garage/finding-dialog";
import { BlockerDialog } from "@/components/garage/blocker-dialog";
import { addGarageComment, suggestExtraTask, garageMarkDone, garageMarkNotDone, toggleMyWorker, resolveBlocker as resolveBlockerAction } from "@/actions/garage";
import { GaragePartsPicker } from "@/components/garage/parts-picker";
import { GarageTimer } from "@/components/garage/timer";
import { STATUS_LABELS, PRIORITY_LABELS, FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS } from "@/types";
import type { RepairTask, RepairPhoto, RepairStatus, Priority, FindingCategory, FindingSeverity, BlockerReason } from "@/types";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw, MapPin } from "lucide-react";

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
  allUsers: { id: string; name: string | null; role: string | null }[];
}

export function GarageRepairDetailClient({ repair, currentUserId, currentUserName, partCategories, activeTimers, allUsers }: Props) {
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



  // Not done reason
  const [showNotDone, setShowNotDone] = useState(false);
  const [notDoneReason, setNotDoneReason] = useState("");

  // Findings & blockers
  const [showFinding, setShowFinding] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);

  // Collapsible sections
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
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200/60 px-4 md:px-6 pt-3 pb-3 safe-area-pt">
        <div className="max-w-3xl mx-auto">
          {/* Nav row */}
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => router.push("/garage")}
              className="flex items-center gap-0.5 h-8 px-1.5 -ml-1.5 text-[13px] font-medium text-gray-400 active:text-gray-600 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> {t("Back", "Atrás", "Terug")}
            </button>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <button
                onClick={handleRefresh}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 active:bg-gray-50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Vehicle identity */}
          <h1 className="text-[17px] font-semibold text-gray-900 leading-snug">
            {repair.unitRegistration && <span className="mr-1.5">{repair.unitRegistration}</span>}
            {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}
          </h1>

          {/* Job title (read-only) */}
          {repair.title && (
            <p className="text-[13px] text-gray-400 mt-0.5">{repair.title}</p>
          )}

          {/* Meta chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-medium ${
              repair.status === "in_progress" ? "bg-sky-50 text-sky-600" :
              repair.status === "ready_for_check" ? "bg-amber-50 text-amber-600" :
              repair.status === "completed" ? "bg-emerald-50 text-emerald-600" :
              repair.status === "blocked" ? "bg-red-50 text-red-600" :
              "bg-gray-50 text-gray-500"
            }`}>
              {STATUS_LABELS[repair.status as RepairStatus]}
            </span>
            {(repair.priority === "urgent" || repair.priority === "high") && (
              <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-medium ${
                repair.priority === "urgent" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
              }`}>
                {PRIORITY_LABELS[repair.priority as Priority]}
              </span>
            )}
            {repair.customerName && (
              <span className="inline-flex items-center rounded-full bg-gray-50 text-gray-500 px-2 py-[3px] text-[11px] font-medium">
                {repair.customerName}
              </span>
            )}
            {(repair.unitStorageLocation || repair.unitCurrentPosition) && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 text-gray-500 px-2 py-[3px] text-[11px] font-medium">
                <MapPin className="h-2.5 w-2.5" />
                {repair.unitCurrentPosition || repair.unitStorageLocation}
              </span>
            )}
            <span className="text-[10px] text-gray-300 font-mono ml-auto">{repair.publicCode}</span>
            {hasTasks && (
              <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                {doneCount}/{repair.tasks.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 pb-40 space-y-4 max-w-3xl mx-auto w-full">

        {/* ══════════════════════════════════════════
            WORKERS + TIMER — inline, first thing
            ══════════════════════════════════════════ */}
        <div className="flex items-center gap-2 flex-wrap">
          {allUsers.filter(u => u.name && u.role !== "admin").map((user) => {
            const isAssigned = repair.workers.some(w => w.userId === user.id);
            return (
              <button
                key={user.id}
                onClick={() => {
                  startTransition(async () => {
                    await toggleMyWorker(repair.id, user.id);
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                  isAssigned
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white ${
                  isAssigned ? "bg-emerald-500" : "bg-gray-300"
                }`}>
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </span>
                {isAssigned && <span className="text-emerald-500 text-xs">✓</span>}
                {user.name}
              </button>
            );
          })}
          {/* Timer inline */}
          {isActive && (
            <GarageTimer
              repairJobId={repair.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              activeTimers={activeTimers}
              t={t}
            />
          )}
        </div>

        {/* ── Active blockers ── */}
        {activeBlockers.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
              {t("Blocked", "Bloqueado", "Geblokkeerd")} ({activeBlockers.length})
            </h3>
            {activeBlockers.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-red-700">
                    {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                  </span>
                  {b.description && (
                    <p className="text-sm text-red-600/80 mt-0.5">{b.description}</p>
                  )}
                  <p className="text-[11px] text-red-400 mt-0.5">
                    {b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveBlocker(b.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg bg-white border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 active:bg-green-50 transition-colors"
                >
                  ✓ {t("Resolve", "Resolver", "Oplossen")}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Final check failed ── */}
        {repair.finalCheckStatus === "failed" && repair.finalCheckNotes && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-500 mb-1">
              {t("Final Check Failed", "Control Final Fallido", "Natest Afgekeurd")}
            </h3>
            <p className="text-sm text-red-800">{repair.finalCheckNotes}</p>
          </div>
        )}

        {/* ── Flags ── */}
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span key={f.key} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${f.color}`}>
                {f.label}
              </span>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════
            OFFICE NOTES — Mollie style: white card, left accent
            ══════════════════════════════════════════ */}
        {(repair.descriptionRaw || repair.notesRaw || repair.internalComments) && (
          <div className="rounded-xl bg-white border border-gray-200/60 pl-4 pr-4 py-3.5 border-l-[3px] border-l-amber-400">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
              {t("Office Notes", "Notas de Oficina", "Kantoor Notities")}
            </p>
            {repair.descriptionRaw && (
              <p className="text-[13px] whitespace-pre-wrap text-gray-700 leading-relaxed">{repair.descriptionRaw}</p>
            )}
            {repair.notesRaw && (
              <p className="text-[13px] whitespace-pre-wrap mt-1.5 text-gray-500 leading-relaxed">{repair.notesRaw}</p>
            )}
            {repair.internalComments && (
              <p className="text-[13px] whitespace-pre-wrap mt-1.5 text-gray-400 italic leading-relaxed">{repair.internalComments}</p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TASKS
            ══════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {t("Tasks", "Tareas", "Taken")}
            </h2>
            {hasTasks && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 tabular-nums">
                  {doneCount}/{repair.tasks.length} {t("completed", "completadas", "voltooid")}
                </span>
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
            <div className="space-y-2">
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
            <div className="rounded-xl bg-gray-50 border border-gray-100 py-6 px-4 text-center">
              <p className="text-sm text-gray-500">{t("No tasks yet", "Sin tareas todavía", "Nog geen taken")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("Add a task to start the repair workflow", "Añade una tarea para iniciar", "Voeg een taak toe om te starten")}</p>
              <button
                onClick={() => setShowSuggest(true)}
                className="mt-3 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 active:bg-gray-50 transition-all"
              >
                + {t("Add task", "Añadir tarea", "Taak toevoegen")}
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            PARTS
            ══════════════════════════════════════════ */}
        {(repair.partRequests.length > 0 || repair.partsRequiredFlag || isActive) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {t("Parts", "Piezas", "Onderdelen")}
              </h2>
              {repair.partRequests.length > 0 && (
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  repair.partRequests.every(p => p.status === "received")
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}>
                  {repair.partRequests.filter(p => p.status === "received").length}/{repair.partRequests.length} {t("received", "recibidas", "ontvangen")}
                </span>
              )}
            </div>

            {repair.partRequests.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {repair.partRequests.map((pr, i) => (
                  <div key={pr.id} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? "border-t border-gray-50" : ""}`}>
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">{pr.partName}</span>
                      {pr.quantity > 1 && <span className="text-gray-400 ml-1">×{pr.quantity}</span>}
                      {pr.supplierName && <span className="text-xs text-gray-400 ml-2">{pr.supplierName}</span>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ml-2 ${
                      pr.status === "received" ? "bg-emerald-50 text-emerald-600" :
                      pr.status === "shipped" ? "bg-indigo-50 text-indigo-600" :
                      pr.status === "ordered" ? "bg-blue-50 text-blue-600" :
                      pr.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                      "bg-amber-50 text-amber-600"
                    }`}>
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
              <p className="text-sm text-gray-400">{t("No parts added yet", "Sin piezas añadidas", "Nog geen onderdelen toegevoegd")}</p>
            )}

            {isActive && (
              <div className="mt-3">
                <GaragePartsPicker repairJobId={repair.id} t={t} partCategories={partCategories} />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            FINDINGS
            ══════════════════════════════════════════ */}
        {unresolvedFindings.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              {t("Issues found", "Problemas encontrados", "Bevindingen")} ({unresolvedFindings.length})
            </h2>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {unresolvedFindings.map((f, i) => (
                <div key={f.id} className={`flex items-start gap-2.5 px-4 py-3 text-sm ${i > 0 ? "border-t border-gray-50" : ""}`}>
                  <span className="text-base mt-0.5 shrink-0">{FINDING_CATEGORY_EMOJI[f.category as FindingCategory]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {FINDING_CATEGORY_LABELS[f.category as FindingCategory]}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        f.severity === "critical" ? "bg-red-50 text-red-600" :
                        f.severity === "minor" ? "bg-gray-100 text-gray-500" :
                        "bg-amber-50 text-amber-600"
                      }`}>
                        {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                      </span>
                      {f.requiresCustomerApproval && (
                        <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-600 px-1.5 py-0.5 text-[10px] font-medium">
                          {t("Approval", "Aprobación", "Goedkeuring")}
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

        {/* ── Customer contact ── */}
        {repair.customerId && (repair.customerPhone || repair.customerEmail || repair.customerMobile) && (
          <div className="flex items-center gap-3 flex-wrap">
            {repair.customerPhone && (
              <a href={`tel:${repair.customerPhone}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-sm text-sky-600 active:opacity-70 transition-all">
                📞 {repair.customerPhone}
              </a>
            )}
            {repair.customerMobile && repair.customerMobile !== repair.customerPhone && (
              <a href={`tel:${repair.customerMobile}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-sm text-sky-600 active:opacity-70 transition-all">
                📱 {repair.customerMobile}
              </a>
            )}
            {repair.customerEmail && (
              <a href={`mailto:${repair.customerEmail}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-sm text-sky-600 active:opacity-70 transition-all">
                ✉ {repair.customerEmail}
              </a>
            )}
          </div>
        )}

        {/* ── Photos (collapsible) ── */}
        {repair.photos.length > 0 && (
          <>
            <button
              onClick={() => setShowPhotos(!showPhotos)}
              className="w-full flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-gray-50 transition-all"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("Photos", "Fotos", "Foto's")} ({repair.photos.length})
              </span>
              <span className="text-gray-300 text-sm">{showPhotos ? "▲" : "▼"}</span>
            </button>
            {showPhotos && (
              <div className="grid grid-cols-3 gap-2 -mt-2">
                {repair.photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
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
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("Add Comment", "Añadir Comentario", "Opmerking Toevoegen")}
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
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-amber-700">
              {t("Why is it not done?", "¿Por qué no está listo?", "Waarom is het niet klaar?")}
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
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("Suggest Extra Task", "Sugerir Tarea Extra", "Extra Taak Voorstellen")}
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

      {/* ─── STICKY BOTTOM ACTION BAR ─── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-xl px-4 md:px-6 pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-30">
        <div className="max-w-3xl mx-auto space-y-1.5">
          {/* Primary: Ready for Check / Not Done */}
          {isActive && !showComment && !showSuggest && !showNotDone && (
            <div className="flex gap-2">
              <button
                onClick={handleMarkDone}
                disabled={isPending}
                className="flex-1 rounded-xl bg-orange-500 text-white h-11 text-sm font-semibold active:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
              >
                {t("Ready for Check", "Listo para Revisión", "Klaar voor Controle")}
              </button>
              <button
                onClick={() => setShowNotDone(true)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 h-11 px-5 text-sm font-medium active:bg-gray-50 active:scale-[0.98] transition-all"
              >
                {t("Not Done", "No Listo", "Niet Klaar")}
              </button>
            </div>
          )}
          {/* Secondary actions */}
          {!showComment && !showSuggest && !showNotDone && (
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowComment(true)}
                className="flex-1 rounded-xl border border-gray-200 bg-white h-10 text-[13px] font-medium text-gray-600 active:bg-gray-50 active:scale-[0.98] transition-all"
              >
                {t("Comment", "Comentario", "Opmerking")}
              </button>
              <button
                onClick={() => setShowSuggest(true)}
                className="flex-1 rounded-xl border border-gray-200 bg-white h-10 text-[13px] font-medium text-gray-600 active:bg-gray-50 active:scale-[0.98] transition-all"
              >
                + {t("Task", "Tarea", "Taak")}
              </button>
              {isActive && (
                <>
                  <button
                    onClick={() => setShowFinding(true)}
                    className="flex-1 rounded-xl border border-gray-200 bg-white h-10 text-[13px] font-medium text-gray-600 active:bg-gray-50 active:scale-[0.98] transition-all"
                  >
                    {t("Issue", "Problema", "Bevinding")}
                  </button>
                  <button
                    onClick={() => setShowBlocker(true)}
                    className="flex-1 rounded-xl border border-gray-200 bg-white h-10 text-[13px] font-medium text-gray-600 active:bg-gray-50 active:scale-[0.98] transition-all"
                  >
                    {t("Block", "Bloqueo", "Blokkade")}
                  </button>
                </>
              )}
              {allDone && repair.finalCheckStatus !== "passed" && (
                <button
                  onClick={() => setShowFinalCheck(true)}
                  className="flex-1 rounded-xl bg-amber-500 text-white h-10 text-[13px] font-medium active:bg-amber-600 active:scale-[0.98] transition-all shadow-sm"
                >
                  {t("Check", "Control", "Natest")}
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
