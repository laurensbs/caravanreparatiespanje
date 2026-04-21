"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, Check, Package } from "lucide-react";
import { toast } from "sonner";
import { garageLogPartUse, garageMarkPartReceived } from "@/actions/garage";
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
 *
 * Kleurkeuze: alleen tokens die door garage-theme.css worden geïnverteerd
 * in light mode (text-white → zwart, bg-white/X → lichte tinten). Dus
 * geen harde text-white/75 of text-teal-200 op grote koppen — die geven
 * witte tekst op witte achtergrond in light mode.
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
  const [checkingId, setCheckingId] = useState<string | null>(null);

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

  function checkOffPart(p: TaskPartLite) {
    if (p.status === "received") return;
    hapticTap();
    setCheckingId(p.id);
    startTransition(async () => {
      try {
        await garageMarkPartReceived(p.id);
        hapticSuccess();
        toast.success(
          deviceLang === "es"
            ? `"${p.partName}" recibida`
            : deviceLang === "nl"
              ? `"${p.partName}" ontvangen`
              : `"${p.partName}" received`,
        );
        onUpdate();
      } catch (e) {
        toast.error((e as Error)?.message ?? "Could not update");
      } finally {
        setCheckingId(null);
      }
    });
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
      {/* ── Grote afvinkbare rijen voor parts die admin heeft toegevoegd / aangevraagd ── */}
      {linkedParts.length > 0 ? (
        <ul className="space-y-2">
          {linkedParts.map((p) => {
            const isDone = p.status === "received";
            const isWaiting = p.status === "requested" || p.status === "ordered" || p.status === "shipped";
            const statusLabel =
              p.status === "received"
                ? t("Ready", "Lista", "Klaar")
                : p.status === "ordered"
                  ? t("Ordered", "Pedida", "Besteld")
                  : p.status === "shipped"
                    ? t("On the way", "En camino", "Onderweg")
                    : p.status === "cancelled"
                      ? t("Cancelled", "Cancelada", "Geannuleerd")
                      : t("Requested", "Solicitada", "Aangevraagd");
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => checkOffPart(p)}
                  disabled={isDone || checkingId === p.id}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ring-1 active:scale-[0.99] disabled:opacity-100 ${
                    isDone
                      ? "bg-emerald-500/15 ring-emerald-400/30"
                      : isWaiting
                        ? "bg-amber-500/10 ring-amber-400/25 hover:bg-amber-500/15"
                        : "bg-white/[0.04] ring-white/[0.08]"
                  }`}
                >
                  {/* Big tick box */}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : "border-2 border-white/30 bg-transparent text-transparent"
                    }`}
                    aria-hidden
                  >
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </span>

                  <Package className="h-5 w-5 shrink-0 text-white/60" aria-hidden />

                  {/* Part name — uses text-white so it stays contrasted in both modes */}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-base font-semibold text-white ${isDone ? "line-through decoration-white/40" : ""}`}
                    >
                      {p.partName}
                    </span>
                    {p.quantity > 1 ? (
                      <span className="text-xs text-white/50">×{p.quantity}</span>
                    ) : null}
                  </span>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      isDone
                        ? "bg-emerald-500/25 text-emerald-200"
                        : isWaiting
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-white/[0.08] text-white/70"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* ── Vrije-tekst invoer: wat heb je gebruikt? ── */}
      <div className="flex flex-col gap-2 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.06] sm:flex-row sm:items-center">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/60 sm:w-28">
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
          className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
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
    </div>
  );
}
