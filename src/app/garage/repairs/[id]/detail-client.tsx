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
import { addGarageComment, suggestExtraTask, updateRepairTitle, garageMarkDone, garageMarkNotDone, garageRequestPart, toggleMyWorker, resolveBlocker as resolveBlockerAction } from "@/actions/garage";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS } from "@/types";
import type { RepairTask, RepairPhoto, RepairStatus, Priority, FindingCategory, FindingSeverity, BlockerReason } from "@/types";
import { toast } from "sonner";

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
}

export function GarageRepairDetailClient({ repair, currentUserId, currentUserName }: Props) {
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

  // Request part
  const [showRequestPart, setShowRequestPart] = useState(false);
  const [requestPartName, setRequestPartName] = useState("");

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
  if (repair.waterDamageRiskFlag) flags.push({ key: "water", label: t("Water Damage Risk", "Riesgo de Agua", "Waterschade Risico"), color: "bg-blue-100 text-blue-800 border-blue-300" });
  if (repair.safetyFlag) flags.push({ key: "safety", label: t("Safety", "Seguridad", "Veiligheid"), color: "bg-red-100 text-red-800 border-red-300" });
  if (repair.tyresFlag) flags.push({ key: "tyres", label: t("Tyres", "Neumáticos", "Banden"), color: "bg-gray-100 text-gray-800 border-gray-300" });
  if (repair.lightsFlag) flags.push({ key: "lights", label: t("Lights", "Luces", "Verlichting"), color: "bg-yellow-100 text-yellow-800 border-yellow-300" });
  if (repair.brakesFlag) flags.push({ key: "brakes", label: t("Brakes", "Frenos", "Remmen"), color: "bg-red-100 text-red-800 border-red-300" });
  if (repair.windowsFlag) flags.push({ key: "windows", label: t("Windows", "Ventanas", "Ramen"), color: "bg-cyan-100 text-cyan-800 border-cyan-300" });
  if (repair.sealsFlag) flags.push({ key: "seals", label: t("Seals", "Sellados", "Afdichtingen"), color: "bg-teal-100 text-teal-800 border-teal-300" });
  if (repair.partsRequiredFlag) flags.push({ key: "parts", label: t("Parts Required", "Piezas Necesarias", "Onderdelen Nodig"), color: "bg-orange-100 text-orange-800 border-orange-300" });
  if (repair.followUpRequiredFlag) flags.push({ key: "followup", label: t("Follow-up", "Seguimiento", "Follow-up"), color: "bg-purple-100 text-purple-800 border-purple-300" });

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
      toast.success(t("Marked as done", "Marcado como hecho", "Klaar gemeld"));
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

  function handleRequestPart() {
    if (!requestPartName.trim()) return;
    startTransition(async () => {
      await garageRequestPart(repair.id, requestPartName);
      setRequestPartName("");
      setShowRequestPart(false);
      toast.success(t("Part requested", "Pieza solicitada", "Onderdeel aangevraagd"));
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
    <div className="flex flex-col min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-white/80 dark:bg-card/80 backdrop-blur-2xl px-5 pt-3 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push("/garage")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground active:opacity-70 -ml-1"
          >
            <span className="text-lg">‹</span> {t("Back", "Atrás", "Terug")}
          </button>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button
              onClick={handleRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-base active:bg-muted/60 transition-colors"
            >
              ↻
            </button>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground/70 tracking-widest uppercase">{repair.publicCode}</span>
            <Badge className={STATUS_COLORS[repair.status as RepairStatus]}>
              {STATUS_LABELS[repair.status as RepairStatus]}
            </Badge>
            <Badge className={PRIORITY_COLORS[repair.priority as Priority]}>
              {PRIORITY_LABELS[repair.priority as Priority]}
            </Badge>
          </div>
          {/* Editable title */}
          {editingTitle ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="flex-1 rounded-xl border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button onClick={handleSaveTitle} disabled={isPending} className="text-sm font-medium text-green-600 active:opacity-70">✓</button>
              <button onClick={() => setEditingTitle(false)} className="text-sm text-muted-foreground active:opacity-70">✕</button>
            </div>
          ) : (
            <p
              className="text-sm text-muted-foreground mt-1.5 active:opacity-70 cursor-pointer"
              onClick={() => setEditingTitle(true)}
              title={t("Tap to edit title", "Toca para editar", "Tik om titel te wijzigen")}
            >
              {repair.title || <span className="italic">{t("No title — tap to add", "Sin título", "Geen titel — tik om toe te voegen")}</span>}
              <span className="ml-1 text-xs opacity-40">✎</span>
            </p>
          )}
          <p className="text-[15px] font-bold mt-1.5 leading-tight">
            {repair.unitRegistration && <span className="mr-2">{repair.unitRegistration}</span>}
            {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}
          </p>
          {repair.customerName && (
            <p className="text-sm text-muted-foreground mt-0.5">{repair.customerName}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-28 space-y-4">

        {/* Active blockers — prominent red banner */}
        {activeBlockers.length > 0 && (
          <div className="rounded-2xl border-2 border-red-400/60 bg-red-50/80 dark:bg-red-950/30 p-4 space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-red-600/80 dark:text-red-400/80">
              🚫 {t("Blocked", "Bloqueado", "Geblokkeerd")} ({activeBlockers.length})
            </h3>
            {activeBlockers.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-red-700 dark:text-red-300">
                    {t(
                      BLOCKER_REASON_LABELS[b.reason as BlockerReason],
                      BLOCKER_REASON_LABELS[b.reason as BlockerReason],
                      BLOCKER_REASON_LABELS[b.reason as BlockerReason]
                    )}
                  </span>
                  {b.description && (
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">{b.description}</p>
                  )}
                  <p className="text-[11px] text-red-500/60 mt-0.5">
                    {b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveBlocker(b.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-xl border border-green-300 bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700 active:bg-green-100 transition-colors"
                >
                  ✓ {t("Resolve", "Resolver", "Oplossen")}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Flags (prominent warnings) */}
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span key={f.key} className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-[13px] font-bold ${f.color}`}>
                ⚠ {f.label}
              </span>
            ))}
          </div>
        )}

        {/* Vehicle & Customer info */}
        <div className="grid grid-cols-1 gap-3">
          {/* Vehicle card */}
          {repair.unitId && (
            <div className="rounded-2xl border border-border/50 bg-white dark:bg-card p-4 shadow-sm">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-2">
                🚐 {t("Vehicle", "Vehículo", "Voertuig")}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {repair.unitRegistration && (
                  <div><span className="text-muted-foreground">{t("Reg", "Mat", "Kenteken")}:</span> <span className="font-medium">{repair.unitRegistration}</span></div>
                )}
                {(repair.unitBrand || repair.unitModel) && (
                  <div><span className="text-muted-foreground">{t("Model", "Modelo", "Model")}:</span> <span className="font-medium">{[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}</span></div>
                )}
                {repair.unitYear && (
                  <div><span className="text-muted-foreground">{t("Year", "Año", "Jaar")}:</span> <span className="font-medium">{repair.unitYear}</span></div>
                )}
                {repair.unitLength && (
                  <div><span className="text-muted-foreground">{t("Length", "Longitud", "Lengte")}:</span> <span className="font-medium">{repair.unitLength}</span></div>
                )}
                {repair.unitChassisId && (
                  <div className="col-span-2"><span className="text-muted-foreground">{t("Chassis", "Chasis", "Chassis")}:</span> <span className="font-medium">{repair.unitChassisId}</span></div>
                )}
                {repair.unitCurrentPosition && (
                  <div><span className="text-muted-foreground">{t("Position", "Posición", "Positie")}:</span> <span className="font-medium">{repair.unitCurrentPosition}</span></div>
                )}
                {repair.unitStorageLocation && (
                  <div><span className="text-muted-foreground">{t("Storage", "Almacén", "Opslag")}:</span> <span className="font-medium">{repair.unitStorageLocation}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Customer card */}
          {repair.customerId && (repair.customerPhone || repair.customerEmail || repair.customerMobile) && (
            <div className="rounded-2xl border border-border/50 bg-white dark:bg-card p-4 shadow-sm">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-2">
                👤 {repair.customerName ?? t("Customer", "Cliente", "Klant")}
              </h3>
              <div className="space-y-1 text-sm">
                {repair.customerPhone && (
                  <a href={`tel:${repair.customerPhone}`} className="flex items-center gap-2 text-blue-600 active:opacity-70">
                    📞 {repair.customerPhone}
                  </a>
                )}
                {repair.customerMobile && repair.customerMobile !== repair.customerPhone && (
                  <a href={`tel:${repair.customerMobile}`} className="flex items-center gap-2 text-blue-600 active:opacity-70">
                    📱 {repair.customerMobile}
                  </a>
                )}
                {repair.customerEmail && (
                  <a href={`mailto:${repair.customerEmail}`} className="flex items-center gap-2 text-blue-600 active:opacity-70">
                    ✉ {repair.customerEmail}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Office notes (read-only) */}
        {(repair.descriptionRaw || repair.notesRaw || repair.internalComments) && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600/80 dark:text-amber-400/80 mb-2">
              📋 {t("Office Notes", "Notas de Oficina", "Kantoor Notities")}
            </h3>
            {repair.descriptionRaw && (
              <p className="text-sm whitespace-pre-wrap">{repair.descriptionRaw}</p>
            )}
            {repair.notesRaw && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-muted-foreground">{repair.notesRaw}</p>
            )}
            {repair.internalComments && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-muted-foreground italic">{repair.internalComments}</p>
            )}
          </div>
        )}

        {/* Findings */}
        {unresolvedFindings.length > 0 && (
          <div className="rounded-2xl border border-border/50 bg-white dark:bg-card p-4 shadow-sm">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-3">
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
                    <p className="text-muted-foreground mt-0.5">{f.description}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {f.createdByName} · {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parts status */}
        {(repair.partRequests.length > 0 || repair.partsRequiredFlag) && (
          <div className="rounded-2xl border border-border/50 bg-white dark:bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60">
                📦 {t("Parts", "Piezas", "Onderdelen")}
              </h3>
              {repair.partRequests.length > 0 && (
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                  repair.partRequests.every(p => p.status === "received")
                    ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                    : "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
                }`}>
                  {repair.partRequests.filter(p => p.status === "received").length}/{repair.partRequests.length} {t("received", "recibidas", "ontvangen")}
                </span>
              )}
            </div>
            {repair.partRequests.length > 0 ? (
              <div className="space-y-2">
                {repair.partRequests.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium">{pr.partName}</span>
                      {pr.quantity > 1 && <span className="text-muted-foreground ml-1">×{pr.quantity}</span>}
                      {pr.supplierName && <span className="text-xs text-muted-foreground ml-2">{pr.supplierName}</span>}
                    </div>
                    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ml-2 ${
                      pr.status === "received" ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400" :
                      pr.status === "shipped" ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400" :
                      pr.status === "ordered" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" :
                      pr.status === "cancelled" ? "bg-gray-50 dark:bg-gray-950/40 text-gray-500" :
                      "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400"
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
              <p className="text-sm text-muted-foreground">
                {t("Parts required — none ordered yet", "Se necesitan piezas — ninguna pedida", "Onderdelen nodig — nog niet besteld")}
              </p>
            )}
            {/* Technician can request a part */}
            {isActive && !showRequestPart && (
              <button
                onClick={() => setShowRequestPart(true)}
                className="mt-3 w-full rounded-xl border border-dashed border-orange-300/60 p-3 text-sm text-orange-500 font-bold active:bg-orange-50/60 transition-colors"
              >
                + {t("Request Part", "Solicitar Pieza", "Onderdeel Aanvragen")}
              </button>
            )}
            {showRequestPart && (
              <div className="mt-3 space-y-2">
                <input
                  value={requestPartName}
                  onChange={(e) => setRequestPartName(e.target.value)}
                  placeholder={t("Part name...", "Nombre de pieza...", "Naam onderdeel...")}
                  className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRequestPart();
                    if (e.key === "Escape") setShowRequestPart(false);
                  }}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowRequestPart(false)} className="flex-1 h-11 rounded-xl">
                    {t("Cancel", "Cancelar", "Annuleren")}
                  </Button>
                  <Button onClick={handleRequestPart} disabled={!requestPartName.trim() || isPending} className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                    {t("Request", "Solicitar", "Aanvragen")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final check banner */}
        {repair.finalCheckStatus === "failed" && repair.finalCheckNotes && (
          <div className="rounded-2xl border border-red-300/60 bg-red-50/60 dark:bg-red-950/20 p-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-red-600/80 mb-1.5">
              ✗ {t("Final Check Failed", "Control Final Fallido", "Natest Afgekeurd")}
            </h3>
            <p className="text-sm text-red-800">{repair.finalCheckNotes}</p>
          </div>
        )}

        {/* Task list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60">
                {t("Tasks", "Tareas", "Taken")}
              </h3>
              {hasTasks && (
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                  {doneCount}/{repair.tasks.length}
                </span>
              )}
            </div>
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
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              <p>{t("No tasks assigned yet", "Sin tareas asignadas", "Nog geen taken toegewezen")}</p>
            </div>
          )}
        </div>

        {/* Workers — "I worked on this" */}
        <div className="rounded-2xl border border-border/50 bg-white dark:bg-card p-4 shadow-sm">
          <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-3">
            👷 {t("Workers", "Trabajadores", "Medewerkers")}
          </h3>
          {/* Toggle button for current user */}
          <button
            onClick={() => {
              startTransition(async () => {
                await toggleMyWorker(repair.id);
                router.refresh();
              });
            }}
            disabled={isPending}
            className={`w-full rounded-xl border-2 p-3.5 text-sm font-bold transition-all active:scale-[0.98] ${
              repair.workers.some(w => w.userId === currentUserId)
                ? "border-green-500/70 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "border-dashed border-muted-foreground/20 text-muted-foreground"
            }`}
          >
            {repair.workers.some(w => w.userId === currentUserId)
              ? `✓ ${t("I worked on this", "Trabajé en esto", "Ik heb hieraan gewerkt")}`
              : `+ ${t("I worked on this", "Trabajé en esto", "Ik heb hieraan gewerkt")}`}
          </button>
          {/* List of workers */}
          {repair.workers.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {repair.workers.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold text-white ${
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

        {/* Photos */}
        {repair.photos.length > 0 && (
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-3">
              {t("Photos", "Fotos", "Foto's")} ({repair.photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {repair.photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-muted shadow-sm">
                  <img
                    src={photo.thumbnailUrl ?? photo.url}
                    alt={photo.caption ?? ""}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment form (expandable) */}
        {showComment && (
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-bold">
              💬 {t("Add Comment", "Añadir Comentario", "Opmerking Toevoegen")}
            </h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("Type your message...", "Escribe tu mensaje...", "Typ je bericht...")}
              className="w-full rounded-xl border p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowComment(false)} className="flex-1 h-11 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleAddComment} disabled={!commentText.trim() || isPending} className="flex-1 h-11 rounded-xl">
                {t("Send", "Enviar", "Verstuur")}
              </Button>
            </div>
          </div>
        )}

        {/* Not done reason form (expandable) */}
        {showNotDone && (
          <div className="rounded-xl border border-orange-300 bg-orange-50/50 p-4 space-y-3">
            <h3 className="text-sm font-bold text-orange-700">
              ⚠️ {t("Why is it not done?", "¿Por qué no está listo?", "Waarom is het niet klaar?")}
            </h3>
            <textarea
              value={notDoneReason}
              onChange={(e) => setNotDoneReason(e.target.value)}
              placeholder={t("Describe the problem...", "Describe el problema...", "Beschrijf het probleem...")}
              className="w-full rounded-xl border p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNotDone(false)} className="flex-1 h-11 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button
                onClick={handleMarkNotDone}
                disabled={!notDoneReason.trim() || isPending}
                className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
              >
                {t("Submit", "Enviar", "Verstuur")}
              </Button>
            </div>
          </div>
        )}

        {/* Suggest task form (expandable) */}
        {showSuggest && (
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-bold">
              ➕ {t("Suggest Extra Task", "Sugerir Tarea Extra", "Extra Taak Voorstellen")}
            </h3>
            <input
              value={suggestTitle}
              onChange={(e) => setSuggestTitle(e.target.value)}
              placeholder={t("Task name...", "Nombre de tarea...", "Naam van taak...")}
              className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <textarea
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder={t("Description (optional)...", "Descripción (opcional)...", "Beschrijving (optioneel)...")}
              className="w-full rounded-xl border p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSuggest(false)} className="flex-1 h-11 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleSuggest} disabled={!suggestTitle.trim() || isPending} className="flex-1 h-11 rounded-xl">
                {t("Suggest", "Sugerir", "Voorstellen")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-white/95 dark:bg-card/95 backdrop-blur-2xl px-5 py-3 safe-area-pb space-y-2">
        {/* Done / Not Done buttons (when repair is active) */}
        {isActive && !showComment && !showSuggest && !showNotDone && (
          <div className="flex gap-2.5">
            <button
              onClick={handleMarkDone}
              disabled={isPending}
              className="flex-1 rounded-2xl bg-gradient-to-b from-green-500 to-green-600 text-white p-3.5 text-sm font-extrabold active:from-green-600 active:to-green-700 transition-all disabled:opacity-50 shadow-sm"
            >
              ✓ {t("Done", "Listo", "Klaar")}
            </button>
            <button
              onClick={() => setShowNotDone(true)}
              className="flex-1 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-600 text-white p-3.5 text-sm font-extrabold active:from-orange-600 active:to-orange-700 transition-all shadow-sm"
            >
              ✗ {t("Not Done", "No Listo", "Niet Klaar")}
            </button>
          </div>
        )}
        {/* Secondary actions */}
        {!showComment && !showSuggest && !showNotDone && (
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowComment(true)}
              className="flex-1 rounded-2xl border border-border/50 bg-white dark:bg-card p-3 text-sm font-bold active:bg-muted/60 transition-colors shadow-sm"
            >
              💬 {t("Comment", "Comentario", "Opmerking")}
            </button>
            <button
              onClick={() => setShowSuggest(true)}
              className="flex-1 rounded-2xl border border-border/50 bg-white dark:bg-card p-3 text-sm font-bold active:bg-muted/60 transition-colors shadow-sm"
            >
              ➕ {t("Extra Task", "Tarea Extra", "Extra Taak")}
            </button>
            {allDone && repair.finalCheckStatus !== "passed" && (
              <button
                onClick={() => setShowFinalCheck(true)}
                className="flex-1 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 text-white p-3 text-sm font-extrabold active:from-amber-600 active:to-amber-700 transition-all shadow-sm"
              >
                🔍 {t("Final Check", "Control", "Natest")}
              </button>
            )}
          </div>
        )}
        {/* Third row: Finding & Blocker */}
        {isActive && !showComment && !showSuggest && !showNotDone && (
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowFinding(true)}
              className="flex-1 rounded-2xl border border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-sm font-bold text-blue-700 dark:text-blue-300 active:bg-blue-100/60 transition-colors shadow-sm"
            >
              🔍 {t("Finding", "Hallazgo", "Bevinding")}
            </button>
            <button
              onClick={() => setShowBlocker(true)}
              className="flex-1 rounded-2xl border border-red-300/60 bg-red-50/60 dark:bg-red-950/20 p-3 text-sm font-bold text-red-700 dark:text-red-300 active:bg-red-100/60 transition-colors shadow-sm"
            >
              🚫 {t("Blocker", "Bloqueo", "Blokkade")}
            </button>
          </div>
        )}
      </div>

      {/* Dialogs */}
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
