"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLanguage } from "@/components/garage/language-toggle";
import { addFinding } from "@/actions/garage";
import type { FindingCategory, FindingSeverity } from "@/types";
import { FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS } from "@/types";
import { VoiceRecorder, type VoiceClip } from "@/components/garage/voice-recorder";
import { uploadVoiceNote } from "@/lib/upload-voice-note";

const CATEGORIES: FindingCategory[] = [
  "tyres", "lighting", "brakes", "windows", "water_damage", "seals",
  "door_lock", "electrical", "bodywork", "chassis", "interior", "other",
];

const CATEGORY_ES: Record<FindingCategory, string> = {
  tyres: "Neumáticos",
  lighting: "Iluminación",
  brakes: "Frenos",
  windows: "Ventanas / Claraboya",
  water_damage: "Daño por Agua",
  seals: "Sellados / Rieles",
  door_lock: "Puerta / Cerradura",
  electrical: "Eléctrico",
  bodywork: "Carrocería",
  chassis: "Chasis",
  interior: "Interior",
  other: "Otro",
};

const CATEGORY_NL: Record<FindingCategory, string> = {
  tyres: "Banden",
  lighting: "Verlichting",
  brakes: "Remmen",
  windows: "Ramen / Dakluik",
  water_damage: "Waterschade",
  seals: "Afdichtingen / Rails",
  door_lock: "Deur / Slot",
  electrical: "Elektrisch",
  bodywork: "Carrosserie",
  chassis: "Chassis",
  interior: "Interieur",
  other: "Anders",
};

const SEVERITIES: FindingSeverity[] = ["minor", "normal", "critical"];

const SEVERITY_ES: Record<FindingSeverity, string> = {
  minor: "Menor",
  normal: "Normal",
  critical: "Crítico",
};

const SEVERITY_NL: Record<FindingSeverity, string> = {
  minor: "Klein",
  normal: "Normaal",
  critical: "Kritiek",
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  minor: "border-white/[0.08] bg-white/[0.04] text-white/60",
  normal: "border-amber-400/20 bg-amber-400/10 text-amber-400",
  critical: "border-red-400/20 bg-red-400/10 text-red-400 ring-1 ring-red-400/20",
};

const SEVERITY_SELECTED: Record<FindingSeverity, string> = {
  minor: "border-white/20 bg-white/[0.08] text-white ring-1 ring-white/10",
  normal: "border-amber-400/40 bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/20",
  critical: "border-red-400/40 bg-red-400/10 text-red-400 ring-1 ring-red-400/30",
};

interface FindingDialogProps {
  open: boolean;
  onClose: () => void;
  repairJobId: string;
  /** Naam van het actieve iPad-profiel — doorgegeven aan addFinding
   *  zodat de berichten-mirror de juiste afzender toont. */
  authorName?: string | null;
  /** Fired once the finding has been persisted server-side. The
   *  optional payload lets the caller render the entry optimistically
   *  without waiting for a full page refresh. */
  onComplete: (finding?: {
    id: string;
    category: string;
    description: string;
    severity: string;
    requiresFollowUp: boolean;
    requiresCustomerApproval: boolean;
    createdByName: string | null;
  }) => void;
}

export function FindingDialog({ open, onClose, repairJobId, onComplete, authorName }: FindingDialogProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<FindingCategory | null>(null);
  const [severity, setSeverity] = useState<FindingSeverity>("normal");
  const [description, setDescription] = useState("");
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [requiresCustomerApproval, setRequiresCustomerApproval] = useState(false);
  const [voice, setVoice] = useState<VoiceClip | null>(null);
  const [needsPart, setNeedsPart] = useState(false);
  const [partName, setPartName] = useState("");
  const [partQuantity, setPartQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCategory(null);
    setSeverity("normal");
    setDescription("");
    setRequiresFollowUp(false);
    setRequiresCustomerApproval(false);
    setVoice(null);
    setNeedsPart(false);
    setPartName("");
    setPartQuantity(1);
  }

  function handleSubmit() {
    if (!category || !description.trim()) return;
    // Part is alleen relevant als vinkje AAN én een naam ingevuld.
    const partPayload =
      needsPart && partName.trim()
        ? { partName: partName.trim(), quantity: Math.max(1, partQuantity) }
        : null;
    startTransition(async () => {
      const finding = await addFinding(repairJobId, {
        category,
        description: description.trim(),
        severity,
        requiresFollowUp,
        requiresCustomerApproval,
        needsPart: partPayload,
        authorName: authorName ?? null,
      });
      if (voice && finding?.id) {
        const ok = await uploadVoiceNote({
          clip: voice,
          ownerType: "finding",
          ownerId: finding.id,
          repairJobId,
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
      reset();
      onComplete(
        finding
          ? {
              id: finding.id,
              category: finding.category,
              description: finding.description,
              severity: finding.severity,
              requiresFollowUp: finding.requiresFollowUp ?? false,
              requiresCustomerApproval: finding.requiresCustomerApproval ?? false,
              createdByName: null,
            }
          : undefined,
      );
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto !bg-stone-900 border-white/[0.08] text-white shadow-2xl p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base text-white">
            🔍 {t("Add Finding", "Añadir Hallazgo", "Bevinding Toevoegen")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Category grid — compacter tiles zodat alles in beeld past. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
              {t("Category", "Categoría", "Categorie")}
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 px-1 text-center transition-all active:scale-[0.97] ${
                    category === cat
                      ? "border-teal-400/40 bg-teal-400/10 ring-1 ring-teal-400/20"
                      : "border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-lg leading-none">{FINDING_CATEGORY_EMOJI[cat]}</span>
                  <span className="text-[9.5px] font-bold leading-tight text-white/70 truncate w-full">
                    {t(FINDING_CATEGORY_LABELS[cat], CATEGORY_ES[cat], CATEGORY_NL[cat])}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prominent Part-needed bar. Geen checkbox meer: typ je een
              naam, dan wordt het onderdeel meegestuurd en flipt de
              repair naar waiting_parts. Leeg laten = geen onderdeel.
              Grote bar zodat hij op tablet niet wegvalt. */}
          <div
            className={`rounded-2xl border-2 transition-all ${
              partName.trim()
                ? "border-orange-400/70 bg-orange-400/15 shadow-[0_0_0_3px_rgba(251,146,60,0.15)]"
                : "border-orange-400/35 bg-orange-400/5"
            }`}
          >
            <div className="flex items-center gap-3 px-4 pt-3">
              <span className="text-2xl">📦</span>
              <div className="flex-1">
                <p className="text-base font-bold text-orange-200">
                  {t("Part needed?", "¿Pieza necesaria?", "Onderdeel nodig?")}
                </p>
                <p className="text-[11px] font-medium text-orange-300/60">
                  {t(
                    "Type a part name — the repair flips to waiting parts automatically.",
                    "Escribe el nombre de la pieza — la reparación pasa a 'esperando piezas'.",
                    "Typ een onderdeelnaam — de reparatie gaat automatisch naar 'wacht op onderdelen'.",
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-3 pt-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={partName}
                onChange={(e) => {
                  setPartName(e.target.value);
                  setNeedsPart(e.target.value.trim().length > 0);
                }}
                placeholder={t(
                  "Part name (e.g. Beading strip)",
                  "Nombre de pieza (p.ej. tira de sellado)",
                  "Naam onderdeel (bv. Beading strip)",
                )}
                className="flex-1 min-w-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  {t("Qty", "Cant.", "Aantal")}
                </span>
                <input
                  type="number"
                  min={1}
                  value={partQuantity}
                  onChange={(e) => setPartQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-20 rounded-xl border border-white/[0.1] bg-white/[0.04] px-2 py-3 text-base text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
              </div>
            </div>
          </div>

          {/* Description — compacter dan voorheen (kleinere textarea). */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
              {t("What did you find?", "¿Qué encontraste?", "Wat heb je gevonden?")}
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "Describe what you found...",
                "Describe lo que encontraste...",
                "Beschrijf wat je hebt gevonden..."
              )}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-sm text-white placeholder:text-white/20 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-white/10"
            />
            <div className="mt-1.5">
              <VoiceRecorder value={voice} onChange={setVoice} t={t} />
            </div>
          </div>

          {/* Severity + follow-up + approval — naast elkaar waar mogelijk. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
              {t("Severity", "Gravedad", "Ernst")}
            </p>
            <div className="flex gap-1.5">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-all active:scale-[0.97] ${
                    severity === sev ? SEVERITY_SELECTED[sev] : SEVERITY_COLORS[sev]
                  }`}
                >
                  {sev === "critical" && "⚠ "}
                  {t(FINDING_SEVERITY_LABELS[sev], SEVERITY_ES[sev], SEVERITY_NL[sev])}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRequiresFollowUp(!requiresFollowUp)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all active:scale-[0.98] ${
                requiresFollowUp
                  ? "border-violet-400/40 bg-violet-400/10 text-violet-300"
                  : "border-white/[0.06] text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              <span>{requiresFollowUp ? "☑" : "☐"}</span>
              <span className="font-medium leading-tight">
                {t("Follow-up", "Seguimiento", "Vervolg nodig")}
              </span>
            </button>
            <button
              onClick={() => setRequiresCustomerApproval(!requiresCustomerApproval)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all active:scale-[0.98] ${
                requiresCustomerApproval
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  : "border-white/[0.06] text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              <span>{requiresCustomerApproval ? "☑" : "☐"}</span>
              <span className="font-medium leading-tight">
                {t("Customer approval", "Aprobación cliente", "Klantgoedkeuring")}
              </span>
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { reset(); onClose(); }}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl border border-white/[0.08] text-white/60 font-medium text-sm transition-all hover:bg-white/[0.04] active:scale-[0.97] disabled:opacity-40"
            >
              {t("Cancel", "Cancelar", "Annuleren")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!category || !description.trim() || isPending}
              className="flex-[2] h-11 rounded-xl bg-teal-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {isPending
                ? t("Saving...", "Guardando...", "Opslaan...")
                : t("Add Finding", "Añadir Hallazgo", "Bevinding Toevoegen")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
