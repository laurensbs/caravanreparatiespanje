"use client";

import { useState, useTransition } from "react";
import { Package, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { GaragePartsPicker } from "@/components/garage/parts-picker";
import { garageLogPartUse } from "@/actions/garage";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import type { Language } from "@/components/garage/language-toggle";

type PartCategory = {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  active: boolean;
};

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
  partCategories?: PartCategory[];
  /** Parts already linked to this task (compact list). */
  linkedParts: TaskPartLite[];
}

/**
 * Per-taak: onderdelen aanvragen (catalogus of vrije tekst) en
 * "gebruikt" loggen — zo denken werkers in taken i.p.v. losse job-parts.
 */
export function TaskPartRow({
  repairJobId,
  taskId,
  t,
  deviceLang,
  onUpdate,
  partCategories,
  linkedParts,
}: TaskPartRowProps) {
  const [showRequest, setShowRequest] = useState(false);
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
    <div className="mt-2 space-y-2 rounded-xl bg-white/[0.02] p-2 ring-1 ring-white/[0.05]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            setShowRequest((v) => !v);
          }}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all active:scale-[0.97] ${
            showRequest ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          {t("Parts / order", "Piezas / pedir", "Onderdelen / bestellen")}
        </button>
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
          {t("Used / note", "Usado / nota", "Gebruikt / notitie")}
        </span>
        <input
          type="text"
          value={useText}
          onChange={(e) => setUseText(e.target.value)}
          placeholder={t(
            "What did you use? (any language)",
            "¿Qué usaste? (cualquier idioma)",
            "Wat heb je gebruikt? (elke taal)",
          )}
          disabled={isPending}
          className="min-w-[8rem] flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          type="button"
          onClick={submitUse}
          disabled={isPending || !useText.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {t("Save", "Guardar", "Opslaan")}
        </button>
      </div>

      {showRequest ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
          <GaragePartsPicker
            repairJobId={repairJobId}
            repairTaskId={taskId}
            taskScoped
            t={t}
            partCategories={partCategories}
            onAdded={() => {
              setShowRequest(false);
              onUpdate();
            }}
          />
        </div>
      ) : null}

      {linkedParts.length > 0 ? (
        <ul className="space-y-1 border-t border-white/[0.05] pt-2">
          {linkedParts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-[11px] text-white/55">
              <span className="truncate">
                {p.partName}
                {p.quantity > 1 ? <span className="text-white/35"> ×{p.quantity}</span> : null}
              </span>
              <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/45">
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
