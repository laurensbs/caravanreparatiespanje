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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto !bg-stone-900 border-white/[0.08] text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            🔍 {t("Add Finding", "Añadir Hallazgo", "Bevinding Toevoegen")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-medium text-white/40 mb-2">
              {t("Category", "Categoría", "Categorie")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all active:scale-[0.97] ${
                    category === cat
                      ? "border-teal-400/40 bg-teal-400/10 ring-1 ring-teal-400/20"
                      : "border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-2xl">{FINDING_CATEGORY_EMOJI[cat]}</span>
                  <span className="text-[11px] font-bold leading-tight text-white/70">
                    {t(FINDING_CATEGORY_LABELS[cat], CATEGORY_ES[cat], CATEGORY_NL[cat])}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white/40 mb-2">
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
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/20 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-white/10"
            />
            <div className="mt-2">
              <VoiceRecorder value={voice} onChange={setVoice} t={t} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white/40 mb-2">
              {t("Severity", "Gravedad", "Ernst")}
            </p>
            <div className="flex gap-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97] ${
                    severity === sev ? SEVERITY_SELECTED[sev] : SEVERITY_COLORS[sev]
                  }`}
                >
                  {sev === "critical" && "⚠ "}
                  {t(FINDING_SEVERITY_LABELS[sev], SEVERITY_ES[sev], SEVERITY_NL[sev])}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {/* "Onderdeel nodig" vervangt de oude Blokkade-knop. Aangevinkt
                 = repair gaat automatisch naar waiting_parts, part komt in
                 het admin Part Requests paneel. */}
            <div
              className={`rounded-xl border transition-all ${
                needsPart
                  ? "border-orange-400/40 bg-orange-400/10"
                  : "border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              <button
                type="button"
                onClick={() => setNeedsPart(!needsPart)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className="text-lg">{needsPart ? "☑" : "☐"}</span>
                <span
                  className={`font-medium text-sm ${
                    needsPart ? "text-orange-300" : "text-white/50"
                  }`}
                >
                  📦 {t("Part needed", "Pieza necesaria", "Onderdeel nodig")}
                </span>
              </button>
              {needsPart ? (
                <div className="flex flex-col gap-2 border-t border-orange-400/20 p-3 sm:flex-row">
                  <input
                    type="text"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    placeholder={t(
                      "Part name (e.g. Beading strip)",
                      "Nombre de pieza",
                      "Naam onderdeel (bv. Beading strip)",
                    )}
                    className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    autoFocus
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-white/50">
                      {t("Qty", "Cant.", "Aantal")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={partQuantity}
                      onChange={(e) => setPartQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-16 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => setRequiresFollowUp(!requiresFollowUp)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm text-left transition-all active:scale-[0.98] ${
                requiresFollowUp
                  ? "border-violet-400/40 bg-violet-400/10 text-violet-400"
                  : "border-white/[0.06] text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-lg">{requiresFollowUp ? "☑" : "☐"}</span>
              <span className="font-medium">
                {t("Requires follow-up", "Requiere seguimiento", "Vervolg nodig")}
              </span>
            </button>
            <button
              onClick={() => setRequiresCustomerApproval(!requiresCustomerApproval)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm text-left transition-all active:scale-[0.98] ${
                requiresCustomerApproval
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                  : "border-white/[0.06] text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-lg">{requiresCustomerApproval ? "☑" : "☐"}</span>
              <span className="font-medium">
                {t("Needs customer approval", "Necesita aprobación del cliente", "Klantgoedkeuring nodig")}
              </span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { reset(); onClose(); }}
              disabled={isPending}
              className="flex-1 h-12 rounded-xl border border-white/[0.08] text-white/60 font-medium text-sm transition-all hover:bg-white/[0.04] active:scale-[0.97] disabled:opacity-40"
            >
              {t("Cancel", "Cancelar", "Annuleren")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!category || !description.trim() || isPending}
              className="flex-1 h-12 rounded-xl bg-teal-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
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
