"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { linkHoldedDocumentToRepair } from "@/actions/holded";
import { parseHoldedDocumentPaste } from "@/lib/holded/parse-document-paste";
import { cn } from "@/lib/utils";

type Props = {
  repairJobId: string;
  allowQuote: boolean;
  allowInvoice: boolean;
  variant?: "default" | "compact";
  className?: string;
  /** For deep-link scroll from elsewhere on the page (e.g. Documents card). */
  id?: string;
};

export function HoldedManualLinkForm({
  repairJobId,
  allowQuote,
  allowInvoice,
  variant = "default",
  className,
  id,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const defaultKind: "quote" | "invoice" =
    allowInvoice && !allowQuote ? "invoice" : allowQuote && !allowInvoice ? "quote" : "invoice";
  const [linkKind, setLinkKind] = useState<"quote" | "invoice">(defaultKind);
  const [linkInput, setLinkInput] = useState("");

  // We auto-detect invoice vs quote from Holded URLs. The manual Select is
  // only useful when the user pastes a raw document ID (no URL scheme), and
  // even then only when both kinds are allowed for this repair.
  const parsedInput = parseHoldedDocumentPaste(linkInput);
  const detectedKind = parsedInput.detectedKind;
  const trimmedInput = linkInput.trim();
  const needsManualKind =
    allowQuote && allowInvoice && trimmedInput.length > 0 && !detectedKind;
  const effectiveKind: "quote" | "invoice" = detectedKind ?? linkKind;

  function applyDetectedKindFromInput(value: string) {
    const parsed = parseHoldedDocumentPaste(value);
    if (parsed.detectedKind === "invoice" && allowInvoice) setLinkKind("invoice");
    else if (parsed.detectedKind === "quote" && allowQuote) setLinkKind("quote");
  }

  async function onLink() {
    const raw = linkInput.trim();
    if (!raw || loading) return;
    const parsed = parseHoldedDocumentPaste(raw);
    const kind = parsed.detectedKind ?? linkKind;
    if (kind === "invoice" && !allowInvoice) {
      toast.error("This repair already has an invoice linked, or invoice linking is not available here.");
      return;
    }
    if (kind === "quote" && !allowQuote) {
      toast.error("This repair already has a quote linked, or quote linking is not available here.");
      return;
    }
    setLoading(true);
    try {
      const res = await linkHoldedDocumentToRepair(repairJobId, kind, raw);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const title = kind === "quote" ? "Quote linked" : "Invoice linked";
      const parts: string[] = [];
      if (res.customerSynced) parts.push("Customer details were updated from the Holded contact.");
      if (res.unitSynced) {
        parts.push("Caravan details were updated from Holded (matching plate).");
      } else if (res.unitIdChanged) {
        parts.push("The caravan on this work order was set from the license plate in the document.");
      }
      if (parts.length > 0) {
        toast.success(title, { description: parts.join(" ") });
      } else {
        toast.success(title);
      }
      setLinkInput("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link document");
    } finally {
      setLoading(false);
    }
  }

  if (!allowQuote && !allowInvoice) return null;

  const pad = variant === "compact" ? "p-3.5" : "p-4";
  const titleClass =
    variant === "compact"
      ? "text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground"
      : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground";

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-dashed border-border bg-muted/40/80 dark:border-border dark:bg-card/[0.03]",
        pad,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={titleClass}>Link existing Holded document</p>
        {detectedKind ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              detectedKind === "invoice"
                ? "border-border bg-muted/60 text-foreground dark:border-border/60 dark:bg-muted/600/10 dark:text-foreground/90"
                : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-500/10 dark:text-violet-300",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            Detected {detectedKind}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 text-muted-foreground dark:text-muted-foreground/70",
          variant === "compact" ? "text-[11px] leading-snug" : "text-xs",
        )}
      >
        Paste the <strong className="font-medium text-foreground/80">Holded browser link</strong> (from the address bar)
        or the raw document ID — we detect whether it&apos;s an invoice or quote from the URL. If a customer has several
        caravans, the <strong className="font-medium text-foreground/80">license plate must appear</strong> in the
        document text (or set the unit on the work order first). After linking, customer and matching caravan details
        sync from Holded when possible.
      </p>
      <div className={cn("mt-3 flex flex-col gap-2 sm:flex-row sm:items-center", variant === "compact" && "mt-2")}>
        {needsManualKind ? (
          <Select value={linkKind} onValueChange={(v) => setLinkKind(v as "quote" | "invoice")}>
            <SelectTrigger
              className={cn("h-9 w-full rounded-lg sm:w-[8.5rem]", variant === "compact" && "h-8 text-xs")}
              title="No URL detected — tell us which kind of document this is."
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Input
          placeholder="https://app.holded.com/invoicing/… or document ID"
          value={linkInput}
          onChange={(e) => {
            const v = e.target.value;
            setLinkInput(v);
            applyDetectedKindFromInput(v);
          }}
          className={cn("h-9 min-w-0 flex-1 rounded-lg text-sm", variant === "compact" && "h-8 text-xs")}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("h-9 shrink-0 rounded-lg", variant === "compact" && "h-8 text-xs")}
          disabled={loading || !trimmedInput}
          onClick={onLink}
          title={
            effectiveKind === "invoice"
              ? "Link as invoice"
              : effectiveKind === "quote"
                ? "Link as quote"
                : undefined
          }
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : "Link"}
        </Button>
      </div>
    </div>
  );
}
