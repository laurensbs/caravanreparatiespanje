"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { syncContactsFromHolded, syncProductsFromHolded, runHoldedInvoiceDiscoveryNow } from "@/actions/holded-sync";
import { toast } from "sonner";

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
      // Refresh status by re-fetching page (simulated via result data)
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
            linked: status.suppliers.linked + result.created + (result.matched - result.matched), // approximate
          },
        });
      }
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setSyncing(null);
    }
  }

  if (!configured) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="font-medium">Holded API not configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set <code className="bg-muted px-1 py-0.5 rounded text-xs">HOLDED_API_KEY</code> in your environment
            to enable the Holded integration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">Holded Connected</p>
                <p className="text-sm text-muted-foreground">
                  Two-way sync is active. Changes push to Holded on save.
                </p>
              </div>
            </div>
            <a
              href="https://app.holded.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Open Holded <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status Cards */}
      {status && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Contacts</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{status.contacts.linked}</span>
                <span className="text-sm text-muted-foreground">/ {status.contacts.total} linked</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${status.contacts.total > 0 ? (status.contacts.linked / status.contacts.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Suppliers</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{status.suppliers.linked}</span>
                <span className="text-sm text-muted-foreground">/ {status.suppliers.total} linked</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${status.suppliers.total > 0 ? (status.suppliers.linked / status.suppliers.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Products / Parts</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{status.parts.linked}</span>
                <span className="text-sm text-muted-foreground">/ {status.parts.total} linked</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${status.parts.total > 0 ? (status.parts.linked / status.parts.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Match invoices to repairs</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Runs one full pass over Holded invoices: links PDFs to work orders (public code, plate, title, date),
                  syncs payment status, and resolves customers without a Holded contact ID. Same logic as the automatic
                  cron — use this after fixing contacts or when many jobs are still missing a document link.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 gap-2"
              disabled={syncing !== null}
              onClick={handleInvoiceDiscovery}
            >
              {syncing === "invoiceDiscovery" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Run now
            </Button>
          </div>
          {invoiceDiscoveryStats && (
            <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-muted-foreground">Invoices scanned</p>
                <p className="font-semibold tabular-nums">{invoiceDiscoveryStats.invoicesTotal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">New links</p>
                <p className="font-semibold tabular-nums text-emerald-600">{invoiceDiscoveryStats.discovered}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status updates</p>
                <p className="font-semibold tabular-nums">{invoiceDiscoveryStats.statusUpdated}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customers resolved</p>
                <p className="font-semibold tabular-nums">{invoiceDiscoveryStats.customersResolved}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact ID backfill</p>
                <p className="font-semibold tabular-nums">{invoiceDiscoveryStats.holdedContactBackfilled}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Errors</p>
                <p className="font-semibold tabular-nums text-destructive">{invoiceDiscoveryStats.errors}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card>
        <CardContent>
          <h3 className="font-medium mb-4">Pull from Holded</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Import and link contacts, suppliers, and products from Holded. Existing records are matched by name, email, or Holded ID.
            New suppliers and products from Holded are automatically imported.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSyncContacts}
              disabled={syncing !== null}
              variant="outline"
              className="gap-2"
            >
              {syncing === "contacts" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Contacts & Suppliers
            </Button>
            <Button
              onClick={handleSyncProducts}
              disabled={syncing !== null}
              variant="outline"
              className="gap-2"
            >
              {syncing === "products" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Products / Parts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result / Error */}
      {lastResult && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">{lastResult.type} Sync Complete</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Holded Total</p>
                <p className="font-bold text-lg">{lastResult.result.holdedTotal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Matched & Linked</p>
                <p className="font-bold text-lg text-emerald-600">{lastResult.result.matched}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created Locally</p>
                <p className="font-bold text-lg text-blue-600">{lastResult.result.created}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Skipped</p>
                <p className="font-bold text-lg text-muted-foreground">{lastResult.result.skipped}</p>
              </div>
            </div>
            {lastResult.result.errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  {lastResult.result.errors.length} error(s)
                </p>
                <ul className="text-xs text-destructive/80 space-y-0.5">
                  {lastResult.result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Sync Error</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* How it Works */}
      <Card>
        <CardContent>
          <h3 className="font-medium mb-3">How sync works</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Contacts:</strong> Holded contacts are matched to local contacts by name or email.
              Matched contacts get linked with their phone, email, and type updated from Holded.
              New Holded suppliers are automatically created locally.
            </p>
            <p>
              <strong className="text-foreground">Products:</strong> Holded products are matched to local parts by SKU or name.
              New products are imported as parts. Existing parts get their SKU, cost, and description updated.
            </p>
            <p>
              <strong className="text-foreground">Push on save:</strong> When you edit a contact or create an invoice in the repair system,
              changes are automatically pushed to Holded in real-time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
