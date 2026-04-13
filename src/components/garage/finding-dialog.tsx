"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  minor: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
  normal: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  critical: "border-red-400 bg-red-50 text-red-700 ring-2 ring-red-200 dark:border-red-600 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20",
};

const SEVERITY_SELECTED: Record<FindingSeverity, string> = {
  minor: "border-slate-500 bg-slate-50 text-slate-700 ring-2 ring-slate-200 dark:border-slate-400 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20",
  normal: "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200 dark:border-amber-400 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  critical: "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200 dark:border-red-400 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            🔍 {t("Add Finding", "Añadir Hallazgo", "Bevinding Toevoegen")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Category grid */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t("Category", "Categoría", "Categorie")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors active:scale-[0.97] ${
                    category === cat
                      ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="text-2xl">{FINDING_CATEGORY_EMOJI[cat]}</span>
                  <span className="text-[11px] font-bold leading-tight">
                    {t(FINDING_CATEGORY_LABELS[cat], CATEGORY_ES[cat], CATEGORY_NL[cat])}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
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
              className="w-full rounded-xl border p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Severity toggle */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t("Severity", "Gravedad", "Ernst")}
            </p>
            <div className="flex gap-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`flex-1 rounded-xl border p-3 text-sm font-bold transition-colors active:scale-[0.97] ${
                    severity === sev ? SEVERITY_SELECTED[sev] : SEVERITY_COLORS[sev]
                  }`}
                >
                  {sev === "critical" && "⚠ "}
                  {t(FINDING_SEVERITY_LABELS[sev], SEVERITY_ES[sev], SEVERITY_NL[sev])}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle flags */}
          <div className="space-y-2">
            <button
              onClick={() => setRequiresFollowUp(!requiresFollowUp)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm text-left transition-colors active:scale-[0.98] ${
                requiresFollowUp
                  ? "border-purple-400 bg-purple-50 text-purple-700"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-lg">{requiresFollowUp ? "☑" : "☐"}</span>
              <span className="font-medium">
                {t("Requires follow-up", "Requiere seguimiento", "Vervolg nodig")}
              </span>
            </button>
            <button
              onClick={() => setRequiresCustomerApproval(!requiresCustomerApproval)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm text-left transition-colors active:scale-[0.98] ${
                requiresCustomerApproval
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-lg">{requiresCustomerApproval ? "☑" : "☐"}</span>
              <span className="font-medium">
                {t("Needs customer approval", "Necesita aprobación del cliente", "Klantgoedkeuring nodig")}
              </span>
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { reset(); onClose(); }}
              className="flex-1 h-12 rounded-xl"
              disabled={isPending}
            >
              {t("Cancel", "Cancelar", "Annuleren")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!category || !description.trim() || isPending}
              className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending
                ? t("Saving...", "Guardando...", "Opslaan...")
                : t("Add Finding", "Añadir Hallazgo", "Bevinding Toevoegen")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
