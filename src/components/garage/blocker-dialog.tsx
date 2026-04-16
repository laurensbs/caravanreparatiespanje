"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/garage/language-toggle";
import { addBlocker } from "@/actions/garage";
import type { BlockerReason } from "@/types";
import { BLOCKER_REASON_LABELS } from "@/types";

const REASONS: BlockerReason[] = [
  "waiting_parts", "waiting_customer", "unknown_issue", "no_time", "missing_info", "other",
];

const REASON_ICONS: Record<BlockerReason, string> = {
  waiting_parts: "📦",
  waiting_customer: "👤",
  unknown_issue: "❓",
  no_time: "⏰",
  missing_info: "📋",
  other: "💬",
};

const REASON_ES: Record<BlockerReason, string> = {
  waiting_parts: "Esperando Piezas",
  waiting_customer: "Esperando al Cliente",
  unknown_issue: "Problema Desconocido",
  no_time: "Sin Tiempo",
  missing_info: "Falta Información",
  other: "Otro",
};

const REASON_NL: Record<BlockerReason, string> = {
  waiting_parts: "Wachten op Onderdelen",
  waiting_customer: "Wachten op Klant",
  unknown_issue: "Onbekend Probleem",
  no_time: "Geen Tijd",
  missing_info: "Ontbrekende Info",
  other: "Anders",
};

interface BlockerDialogProps {
  open: boolean;
  onClose: () => void;
  repairJobId: string;
  onComplete: () => void;
}

export function BlockerDialog({ open, onClose, repairJobId, onComplete }: BlockerDialogProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState<BlockerReason | null>(null);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setReason(null);
    setDescription("");
  }

  function handleSubmit() {
    if (!reason) return;
    startTransition(async () => {
      await addBlocker(repairJobId, {
        reason,
        description: description.trim() || undefined,
      });
      reset();
      onComplete();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md bg-gray-900 border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            🚫 {t("Report Blocker", "Reportar Bloqueo", "Blokkade Melden")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-white/40">
            {t("Why can't you continue?", "¿Por qué no puedes continuar?", "Waarom kun je niet verder?")}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
                  reason === r
                    ? "border-red-400/40 bg-red-400/10 ring-1 ring-red-400/20"
                    : "border-white/[0.06] hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-xl">{REASON_ICONS[r]}</span>
                <span className="font-medium text-sm text-white/80">
                  {t(BLOCKER_REASON_LABELS[r], REASON_ES[r], REASON_NL[r])}
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(
              "Additional details (optional)...",
              "Detalles adicionales (opcional)...",
              "Extra details (optioneel)..."
            )}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/20 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-white/10"
          />

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
              disabled={!reason || isPending}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {isPending
                ? t("Sending...", "Enviando...", "Versturen...")
                : t("Report Blocker", "Reportar Bloqueo", "Blokkade Melden")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
