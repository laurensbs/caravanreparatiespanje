"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Package,
  Building2,
  Loader2,
  ExternalLink,
  FileText,
  Plug,
} from "lucide-react";
import {
  syncContactsFromHolded,
  syncProductsFromHolded,
  runHoldedInvoiceDiscoveryNow,
} from "@/actions/holded-sync";
import { toast } from "sonner";
import {
  SettingsPanel,
  SettingsSectionHeader,
  SettingsEmptyState,
} from "@/components/settings/settings-primitives";
import { cn } from "@/lib/utils";

interface SyncStatus {
  contacts: { total: number; linked: number };
  suppliers: { total: number; linked: number };
  parts: { total: number; linked: number };
}

interface SyncResult {
  holdedTotal: number;
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type InvoiceDiscoveryStats = {
  discovered: number;
  statusUpdated: number;
  statusAdvanced: number;
  errors: number;
  invoicesTotal: number;
  customersResolved: number;
  holdedContactBackfilled: number;
};

interface Props {
  configured: boolean;
  syncStatus: SyncStatus | null;
}

function StatTile({
  icon: Icon,
  label,
  linked,
  total,
}: {
  icon: typeof Users;
  label: string;
  linked: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((linked / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-sm dark:border-border dark:bg-card/[0.03]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12.5px] font-medium text-foreground/90 dark:text-foreground/90">{label}</span>
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
            pct >= 90
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : pct >= 50
              ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
              : "bg-muted text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold tabular-nums text-foreground dark:text-foreground">
          {linked}
        </span>
        <span className="text-[12px] text-muted-foreground dark:text-muted-foreground/70">/ {total} linked</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted dark:bg-card/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-foreground/70 to-foreground transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function HoldedSyncClient({ configured, syncStatus }: Props) {
  const [syncing, setSyncing] = useState<"contacts" | "products" | "invoiceDiscovery" | null>(null);
  const [lastResult, setLastResult] = useState<{ type: string; result: SyncResult } | null>(null);
  const [invoiceDiscoveryStats, setInvoiceDiscoveryStats] = useState<InvoiceDiscoveryStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(syncStatus);

  async function handleSyncContacts() {
    setSyncing("contacts");
    setError(null);
    setLastResult(null);
    try {
      const result = await syncContactsFromHolded();
      setLastResult({ type: "Contacts", result });
      if (status) {
        setStatus({
          ...status,
          contacts: {
            ...status.contacts,
            linked: status.contacts.linked + result.matched,
          },
          suppliers: {
            ...status.suppliers,
            total: status.suppliers.total + result.created,
            linked: status.suppliers.linked + result.created,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncProducts() {
    setSyncing("products");
    setError(null);
    setLastResult(null);
    try {
      const result = await syncProductsFromHolded();
      setLastResult({ type: "Products", result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  }

  async function handleInvoiceDiscovery() {
    setSyncing("invoiceDiscovery");
    setError(null);
    setInvoiceDiscoveryStats(null);
    try {
      const stats = await runHoldedInvoiceDiscoveryNow();
      setInvoiceDiscoveryStats(stats);
      toast.success("Invoice discovery finished", {
        description: `${stats.discovered} new link(s), ${stats.statusUpdated} status update(s).`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setSyncing(null);
    }
  }

  if (!configured) {
    return (
      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={Plug}
          title="Holded integration"
          description="Sync contacts, suppliers, parts, quotes and invoices both ways."
        />
        <SettingsEmptyState
          icon={AlertCircle}
          title="Holded API not configured"
          description={
            <>
              Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/90 dark:bg-card/[0.06] dark:text-foreground/90">
                HOLDED_API_KEY
              </code>{" "}
              in your environment to enable the integration.
            </>
          }
        />
      </SettingsPanel>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsPanel className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </span>
          <div>
            <p className="text-[14px] font-semibold tracking-tight text-foreground dark:text-foreground">
              Holded connected
            </p>
            <p className="text-[12.5px] text-muted-foreground dark:text-muted-foreground/70">
              Two-way sync is active. Edits push to Holded on save.
            </p>
          </div>
        </div>
        <a
          href="https://app.holded.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 dark:border-border dark:text-muted-foreground/50 dark:hover:bg-card/[0.04]"
        >
          Open Holded <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </SettingsPanel>

      {status ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={Users} label="Contacts" linked={status.contacts.linked} total={status.contacts.total} />
          <StatTile icon={Building2} label="Suppliers" linked={status.suppliers.linked} total={status.suppliers.total} />
          <StatTile icon={Package} label="Products / Parts" linked={status.parts.linked} total={status.parts.total} />
        </div>
      ) : null}

      <SettingsPanel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/600/10 text-foreground/80">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold tracking-tight text-foreground dark:text-foreground">
                Match invoices &amp; quotes to repairs
              </h3>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground dark:text-muted-foreground/70">
                One full pass over Holded: links PDFs to work orders (public code, plate, title, date),
                syncs payment status and resolves missing contact IDs. Same logic as the cron — use it
                after fixing contacts or when many jobs are still missing a document link.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="h-9 shrink-0 rounded-full px-4 text-[12.5px] font-medium shadow-sm"
            disabled={syncing !== null}
            onClick={handleInvoiceDiscovery}
          >
            {syncing === "invoiceDiscovery" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run now
          </Button>
        </div>
        {invoiceDiscoveryStats ? (
          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3 lg:grid-cols-6 dark:border-border">
            {[
              { label: "Scanned", value: invoiceDiscoveryStats.invoicesTotal },
              { label: "New links", value: invoiceDiscoveryStats.discovered, tone: "emerald" },
              { label: "Status updates", value: invoiceDiscoveryStats.statusUpdated },
              { label: "Customers resolved", value: invoiceDiscoveryStats.customersResolved },
              { label: "Contact backfill", value: invoiceDiscoveryStats.holdedContactBackfilled },
              { label: "Errors", value: invoiceDiscoveryStats.errors, tone: "red" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {s.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[18px] font-semibold tabular-nums text-foreground dark:text-foreground",
                    s.tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
                    s.tone === "red" && "text-red-600 dark:text-red-400",
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </SettingsPanel>

      <SettingsPanel className="space-y-4">
        <SettingsSectionHeader
          icon={RefreshCw}
          title="Pull from Holded"
          description="Match contacts, suppliers and products by name, email or Holded ID. New rows are imported."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-4 text-[12.5px]"
            disabled={syncing !== null}
            onClick={handleSyncContacts}
          >
            {syncing === "contacts" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sync contacts &amp; suppliers
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-4 text-[12.5px]"
            disabled={syncing !== null}
            onClick={handleSyncProducts}
          >
            {syncing === "products" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sync products / parts
          </Button>
        </div>
      </SettingsPanel>

      {lastResult ? (
        <SettingsPanel className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-[14px] font-semibold tracking-tight text-foreground dark:text-foreground">
              {lastResult.type} sync complete
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Holded total", value: lastResult.result.holdedTotal },
              { label: "Matched", value: lastResult.result.matched, tone: "emerald" },
              { label: "Created", value: lastResult.result.created, tone: "sky" },
              { label: "Skipped", value: lastResult.result.skipped },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {s.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[20px] font-semibold tabular-nums text-foreground dark:text-foreground",
                    s.tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
                    s.tone === "sky" && "text-foreground/80",
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          {lastResult.result.errors.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-[12px] text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
              <p className="font-medium">{lastResult.result.errors.length} error(s)</p>
              <ul className="mt-1 space-y-0.5 opacity-90">
                {lastResult.result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SettingsPanel>
      ) : null}

      {error ? (
        <SettingsPanel>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Sync error</span>
          </div>
          <p className="mt-1 text-[12.5px] text-red-600/80 dark:text-red-300/80">{error}</p>
        </SettingsPanel>
      ) : null}

      <SettingsPanel className="space-y-3">
        <SettingsSectionHeader title="How sync works" />
        <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground dark:text-muted-foreground/70">
          <p>
            <strong className="text-foreground dark:text-foreground/90">Contacts:</strong> matched by name, email
            or Holded ID. Phone, email and type are pulled in. New Holded suppliers are created locally.
          </p>
          <p>
            <strong className="text-foreground dark:text-foreground/90">Products:</strong> matched by SKU or name.
            New products import as parts. Existing parts get SKU, cost and description updated.
          </p>
          <p>
            <strong className="text-foreground dark:text-foreground/90">Push on save:</strong> editing a contact or
            creating an invoice / quote here pushes to Holded in real time.
          </p>
        </div>
      </SettingsPanel>
    </div>
  );
}
