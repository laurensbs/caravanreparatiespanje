"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { HandHelping, X, Send } from "lucide-react";
import { useLanguage } from "@/components/garage/language-toggle";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { createToolRequest } from "@/actions/tool-requests";
import { VoiceRecorder, type VoiceClip } from "@/components/garage/voice-recorder";
import { uploadVoiceNote } from "@/lib/upload-voice-note";

/* ─────────────────────────────────────────────────────────────────────
   "Hand needed" sheet
   ─────────────────────────────────────────────────────────────────────
   Lightweight asks for "iemand komt even meekijken" — distinct from a
   blocker (which stops the job). It re-uses the tool_requests pipeline
   so the office sees it in the same inbox; the description is prefixed
   so admins can spot it at a glance, and the row is auto-linked to the
   current repair.
   ───────────────────────────────────────────────────────────────── */

const HAND_PREFIX = "🙋 Hand needed";

export function HandNeededSheet({
  open,
  onClose,
  onSent,
  repairJobId,
  repairLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  repairJobId: string;
  repairLabel?: string;
}) {
  const { t } = useLanguage();
  const [description, setDescription] = useState("");
  const [voiceClip, setVoiceClip] = useState<VoiceClip | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setDescription("");
      setVoiceClip(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    const desc = description.trim();
    if (!desc && !voiceClip) {
      toast.error(
        t(
          "Type or record what you need help with.",
          "Escribe o graba para qué necesitas ayuda.",
          "Typ of spreek in waarvoor je hulp nodig hebt.",
        ),
      );
      return;
    }

    hapticTap();
    startTransition(async () => {
      try {
        const finalDesc = desc
          ? `${HAND_PREFIX}: ${desc}`
          : `${HAND_PREFIX} (voice note)`;
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
          t(
            "Sent — someone will come help.",
            "Enviado — alguien viene a ayudar.",
            "Verstuurd — er komt iemand helpen.",
          ),
        );
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
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <HandHelping className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white">
              {t("Hand needed", "Necesito ayuda", "Hulp nodig")}
            </h3>
            <p className="truncate text-xs text-white/50">
              {repairLabel ??
                t(
                  "We'll ping the office and your colleagues.",
                  "Avisamos a la oficina y tus compañeros.",
                  "We pingen kantoor en je collega's.",
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

        <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-5">
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t(
              "What do you need a hand with? (e.g. lift the panel, second opinion on the wiring)",
              "¿Para qué necesitas ayuda? (p.ej. levantar el panel, segunda opinión sobre el cableado)",
              "Waarvoor heb je hulp nodig? (bv. paneel optillen, even meekijken bij de bedrading)",
            )}
            className="w-full rounded-xl bg-white/[0.06] p-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
          />

          <VoiceRecorder
            value={voiceClip}
            onChange={setVoiceClip}
            t={t}
          />
        </div>

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
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-400 text-sm font-bold text-stone-950 shadow-md hover:bg-sky-300 active:scale-[0.97] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t("Send", "Enviar", "Verstuur")}
          </button>
        </div>
      </div>
    </div>
  );
}
