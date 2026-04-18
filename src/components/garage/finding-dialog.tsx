"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/garage/language-toggle";
import { addFinding } from "@/actions/garage";
import type { FindingCategory, FindingSeverity } from "@/types";
import { FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS } from "@/types";

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
  onComplete: () => void;
}

export function FindingDialog({ open, onClose, repairJobId, onComplete }: FindingDialogProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<FindingCategory | null>(null);
  const [severity, setSeverity] = useState<FindingSeverity>("normal");
  const [description, setDescription] = useState("");
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [requiresCustomerApproval, setRequiresCustomerApproval] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCategory(null);
    setSeverity("normal");
    setDescription("");
    setRequiresFollowUp(false);
    setRequiresCustomerApproval(false);
  }

  function handleSubmit() {
    if (!category || !description.trim()) return;
    startTransition(async () => {
      await addFinding(repairJobId, {
        category,
        description: description.trim(),
        severity,
        requiresFollowUp,
        requiresCustomerApproval,
      });
      reset();
      onComplete();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-foreground border-white/[0.08] text-white">
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
