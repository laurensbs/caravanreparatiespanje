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

  const showKindSelect = allowQuote && allowInvoice;

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
      ? "text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
      : "text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-dashed border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-white/[0.03]",
        pad,
        className,
      )}
    >
      <p className={titleClass}>Link existing Holded document</p>
      <p
        className={cn(
          "mt-1 text-gray-500 dark:text-gray-400",
          variant === "compact" ? "text-[11px] leading-snug" : "text-xs",
        )}
      >
        Paste the <strong className="font-medium text-foreground/80">Holded browser link</strong> (from the address bar)
        or the raw document ID. We detect <strong className="font-medium text-foreground/80">invoice</strong> vs{" "}
        <strong className="font-medium text-foreground/80">quote</strong> from the URL. If a customer has several
        caravans, the <strong className="font-medium text-foreground/80">license plate must appear</strong> in the
        document text (or set the unit on the work order first). After linking, customer and matching caravan details
        sync from Holded when possible.
      </p>
      <div className={cn("mt-3 flex flex-col gap-2 sm:flex-row sm:items-center", variant === "compact" && "mt-2")}>
        {showKindSelect ? (
          <Select value={linkKind} onValueChange={(v) => setLinkKind(v as "quote" | "invoice")}>
            <SelectTrigger className={cn("h-9 w-full rounded-lg sm:w-[8.5rem]", variant === "compact" && "h-8 text-xs")}>
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
          disabled={loading || !linkInput.trim()}
          onClick={onLink}
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : "Link"}
        </Button>
      </div>
    </div>
  );
}
