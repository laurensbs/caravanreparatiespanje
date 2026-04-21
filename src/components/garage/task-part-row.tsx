"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { garageLogPartUse } from "@/actions/garage";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import type { Language } from "@/components/garage/language-toggle";

type TaskPartLite = {
  id: string;
  partName: string;
  quantity: number;
  status: string;
};

interface TaskPartRowProps {
  repairJobId: string;
  taskId: string;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  deviceLang: Language;
  onUpdate: () => void;
  /** Parts already linked to this task (compact list). */
  linkedParts: TaskPartLite[];
}

/**
 * Per-taak: noteer welk onderdeel je hebt gebruikt (vrije tekst). Geen
 * catalogus-picker meer — de werker hoeft niet te zoeken. Als er echt
 * iets aangevraagd moet worden gebruikt de werker de "Problema"-knop,
 * dat signaleert naar het kantoorpaneel.
 */
export function TaskPartRow({
  repairJobId,
  taskId,
  t,
  deviceLang,
  onUpdate,
  linkedParts,
}: TaskPartRowProps) {
  const [useText, setUseText] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitUse() {
    const trimmed = useText.trim();
    if (!trimmed) return;
    hapticTap();
    startTransition(async () => {
      try {
        await garageLogPartUse(repairJobId, taskId, trimmed);
        hapticSuccess();
        toast.success(
          deviceLang === "es"
            ? "Registrado — el taller lo verá en la orden."
            : deviceLang === "nl"
              ? "Genoteerd — kantoor ziet dit op de werkorder."
              : "Logged — office will see this on the work order.",
        );
        setUseText("");
        onUpdate();
      } catch (e) {
        toast.error((e as Error)?.message ?? "Could not save");
      }
    });
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.05]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/50 sm:w-28">
          {t("Used / note", "Usado / nota", "Gebruikt / notitie")}
        </span>
        <input
          type="text"
          value={useText}
          onChange={(e) => setUseText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && useText.trim() && !isPending) {
              e.preventDefault();
              submitUse();
            }
          }}
          placeholder={t(
            "What did you use? (any language)",
            "¿Qué usaste? (cualquier idioma)",
            "Wat heb je gebruikt? (elke taal)",
          )}
          disabled={isPending}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          type="button"
          onClick={submitUse}
          disabled={isPending || !useText.trim()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          <ClipboardCheck className="h-4 w-4" />
          {t("Save", "Guardar", "Opslaan")}
        </button>
      </div>

      {linkedParts.length > 0 ? (
        <ul className="space-y-1.5 border-t border-white/[0.05] pt-3">
          {linkedParts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm text-white/75">
              <span className="truncate">
                {p.partName}
                {p.quantity > 1 ? <span className="text-white/45"> ×{p.quantity}</span> : null}
              </span>
              <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold uppercase text-white/55">
                {p.status === "received"
                  ? t("Done", "Listo", "Klaar")
                  : p.status === "requested"
                    ? t("Req.", "Ped.", "Aanv.")
                    : p.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
