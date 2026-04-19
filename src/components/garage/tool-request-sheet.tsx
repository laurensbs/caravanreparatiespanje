"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Wrench, X, Send, Package } from "lucide-react";
import { useLanguage } from "@/components/garage/language-toggle";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { createToolRequest } from "@/actions/tool-requests";
import { createPartRequestFromGarage } from "@/actions/parts";
import { VoiceRecorder, type VoiceClip } from "@/components/garage/voice-recorder";
import { uploadVoiceNote } from "@/lib/upload-voice-note";

/* ─────────────────────────────────────────────────────────────────────
   "Need a tool / part / supply" sheet
   ─────────────────────────────────────────────────────────────────────
   This is the iPad's primary way to ping the office without having to
   open a repair detail and hunt for the right place. It lets the worker:
     - type one short line ("18V impact", "M6 nuts", "RTV silicone"),
     - optionally tag the request to a repair from a short scrollable list,
     - attach a quick voice note (handy for accents and tricky part names),
     - send. The office sees it instantly in the dashboard inbox.
   ───────────────────────────────────────────────────────────────── */

type RepairOption = {
  id: string;
  label: string;
  sublabel: string | null;
};

export function ToolRequestSheet({
  open,
  onClose,
  onSent,
  repairOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  repairOptions: RepairOption[];
}) {
  const { t } = useLanguage();
  // Tool = generic workshop ask (impact driver, sealant gun, ladder…).
  // Part = consumable that has to land on a specific repair (M6 nuts,
  // window seal, brake disc). The split routes the request to the
  // right inbox: Equipment tab vs Part requests tab + the repair page.
  const [kind, setKind] = useState<"tool" | "part">("tool");
  const [description, setDescription] = useState("");
  const [repairJobId, setRepairJobId] = useState<string | null>(null);
  const [voiceClip, setVoiceClip] = useState<VoiceClip | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Reset on close so the next opener gets a clean slate.
    if (!open) {
      setKind("tool");
      setDescription("");
      setRepairJobId(null);
      setVoiceClip(null);
      setSearch("");
    }
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const filtered = search.trim()
    ? repairOptions.filter((r) =>
        (r.label + " " + (r.sublabel ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : repairOptions;

  function handleSubmit() {
    const desc = description.trim();
    if (!desc && !voiceClip) {
      toast.error(
        t(
          "Type or record what you need.",
          "Escribe o graba lo que necesitas.",
          "Typ of spreek in wat je nodig hebt.",
        ),
      );
      return;
    }

    // Parts must land on a specific repair — otherwise the office
    // can't act on them and they pollute the inbox.
    if (kind === "part" && !repairJobId) {
      toast.error(
        t(
          "Pick the repair this part is for.",
          "Elige la reparación para esta pieza.",
          "Kies voor welke klus deze onderdeel is.",
        ),
      );
      return;
    }

    // Parts need a typed name — a voice-only "I need something" request
    // is too vague to add as a part_request line.
    if (kind === "part" && !desc) {
      toast.error(
        t(
          "Type the part name.",
          "Escribe el nombre de la pieza.",
          "Typ de naam van het onderdeel.",
        ),
      );
      return;
    }

    hapticTap();
    startTransition(async () => {
      try {
        if (kind === "tool") {
          // Voice-only requests still need a description for the inbox; we
          // fall back to a short marker the office sees as "(voice note)".
          const finalDesc =
            desc || t("(voice note)", "(nota de voz)", "(spraakbericht)");
          const created = await createToolRequest({
            description: finalDesc,
            repairJobId,
          });
          if (voiceClip) {
            await uploadVoiceNote({
              clip: voiceClip,
              ownerType: "tool_request",
              ownerId: created.id,
              repairJobId,
            });
          }
          hapticSuccess();
          toast.success(
            t("Sent to office.", "Enviado a oficina.", "Verstuurd naar kantoor."),
          );
        } else {
          const created = await createPartRequestFromGarage({
            partName: desc,
            repairJobId: repairJobId!,
          });
          if (voiceClip) {
            await uploadVoiceNote({
              clip: voiceClip,
              ownerType: "tool_request",
              ownerId: created.id,
              repairJobId,
            });
          }
          hapticSuccess();
          toast.success(
            t(
              "Added to repair.",
              "Añadido a la reparación.",
              "Toegevoegd aan klus.",
            ),
          );
        }
        onSent?.();
        onClose();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Send failed");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-3xl bg-stone-900 shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              kind === "tool"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-sky-500/15 text-sky-300"
            }`}
          >
            {kind === "tool" ? (
              <Wrench className="h-5 w-5" />
            ) : (
              <Package className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white">
              {kind === "tool"
                ? t("Need a tool", "Necesito herramienta", "Gereedschap nodig")
                : t("Need a part", "Necesito una pieza", "Onderdeel nodig")}
            </h3>
            <p className="text-xs text-white/50">
              {kind === "tool"
                ? t(
                    "The office sees this immediately.",
                    "La oficina lo ve al instante.",
                    "Het kantoor ziet dit meteen.",
                  )
                : t(
                    "Goes onto the repair so the office can order it.",
                    "Va a la reparación para que la oficina la pida.",
                    "Komt op de klus zodat kantoor het kan bestellen.",
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] active:scale-[0.95]"
            aria-label={t("Close", "Cerrar", "Sluiten")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-5">
          {/* Type toggle — Tool vs Part. Shown above the input so the
              worker mentally categorises the request before typing. */}
          <div
            role="tablist"
            aria-label={t("Request type", "Tipo de solicitud", "Type aanvraag")}
            className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.06]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={kind === "tool"}
              onClick={() => {
                hapticTap();
                setKind("tool");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                kind === "tool"
                  ? "bg-amber-400 text-stone-950 shadow-sm"
                  : "text-white/70 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Wrench className="h-4 w-4" />
              {t("Tool", "Herramienta", "Gereedschap")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === "part"}
              onClick={() => {
                hapticTap();
                setKind("part");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                kind === "part"
                  ? "bg-sky-400 text-stone-950 shadow-sm"
                  : "text-white/70 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Package className="h-4 w-4" />
              {t("Part", "Pieza", "Onderdeel")}
            </button>
          </div>

          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={
              kind === "tool"
                ? t(
                    "What tool do you need? (e.g. 18V impact, ladder, sealant gun)",
                    "¿Qué herramienta necesitas? (p.ej. impacto 18V, escalera, pistola)",
                    "Welk gereedschap heb je nodig? (bv. slagschroevendraaier, ladder)",
                  )
                : t(
                    "Which part? (e.g. M6 nuts, window seal, brake disc)",
                    "¿Qué pieza? (p.ej. tuercas M6, junta, disco de freno)",
                    "Welk onderdeel? (bv. M6 moeren, raamrubber, remschijf)",
                  )
            }
            className={`w-full rounded-xl bg-white/[0.06] p-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 ${
              kind === "tool"
                ? "focus:ring-amber-400/30"
                : "focus:ring-sky-400/30"
            }`}
          />

          <VoiceRecorder
            value={voiceClip}
            onChange={setVoiceClip}
            t={t}
          />

          {repairOptions.length > 0 ? (
            <div
              className={`rounded-xl bg-white/[0.04] p-2 ring-1 ${
                kind === "part" && !repairJobId
                  ? "ring-sky-400/40"
                  : "ring-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    kind === "part" ? "text-sky-200/80" : "text-white/50"
                  }`}
                >
                  {kind === "part"
                    ? t(
                        "Pick the repair (required)",
                        "Elige la reparación (obligatorio)",
                        "Kies de klus (verplicht)",
                      )
                    : t(
                        "Link to repair (optional)",
                        "Vincular reparación (opcional)",
                        "Koppel aan klus (optioneel)",
                      )}
                </p>
                {repairJobId ? (
                  <button
                    type="button"
                    onClick={() => setRepairJobId(null)}
                    className="text-[11px] font-semibold text-white/50 hover:text-white"
                  >
                    {t("Clear", "Quitar", "Wis")}
                  </button>
                ) : null}
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search registration / customer", "Buscar matrícula / cliente", "Zoek kenteken / klant")}
                className="mb-1 h-9 w-full rounded-lg bg-white/[0.04] px-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/15"
              />
              <div className="max-h-40 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-white/30">
                    {t("No match.", "Sin resultados.", "Geen resultaten.")}
                  </p>
                ) : (
                  filtered.slice(0, 30).map((r) => {
                    const selected = repairJobId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          hapticTap();
                          setRepairJobId(selected ? null : r.id);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/30"
                            : "text-white/80 hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm font-semibold">
                            {r.label}
                          </span>
                          {r.sublabel ? (
                            <span className="block truncate text-[11px] text-white/45">
                              {r.sublabel}
                            </span>
                          ) : null}
                        </span>
                        {selected ? (
                          <span className="text-[11px] font-bold uppercase text-amber-300">
                            {t("linked", "vinculado", "gekoppeld")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-12 flex-1 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/80 hover:bg-white/[0.1] active:scale-[0.97] disabled:opacity-50"
          >
            {t("Cancel", "Cancelar", "Annuleer")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-stone-950 shadow-md active:scale-[0.97] disabled:opacity-50 ${
              kind === "tool"
                ? "bg-amber-400 hover:bg-amber-300"
                : "bg-sky-400 hover:bg-sky-300"
            }`}
          >
            <Send className="h-4 w-4" />
            {t("Send", "Enviar", "Verstuur")}
          </button>
        </div>
      </div>
    </div>
  );
}
