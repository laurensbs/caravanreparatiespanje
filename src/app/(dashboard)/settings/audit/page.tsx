import { db } from "@/lib/db";
import { auditLogs, users, repairJobs, customers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-utils";
import { desc, eq, like, and, sql, gte, lte, or, isNull, inArray, notInArray } from "drizzle-orm";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";
import Link from "next/link";
import { AuditFilters } from "./audit-filters";

const AUDIT_BASE = "/settings/audit";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entity?: string; q?: string; dateFrom?: string; dateTo?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = 50;

  const conditions = [];
  if (params.action) conditions.push(eq(auditLogs.action, params.action));
  if (params.entity) conditions.push(eq(auditLogs.entityType, params.entity));
  if (params.q) conditions.push(like(auditLogs.entityType, `%${params.q}%`));
  if (params.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) {
    const to = new Date(params.dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(lte(auditLogs.createdAt, to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        changes: auditLogs.changes,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / perPage);

  const holdedDataGaps = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      invoiceStatus: repairJobs.invoiceStatus,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedQuoteId: repairJobs.holdedQuoteId,
      customerName: customers.name,
      updatedAt: repairJobs.updatedAt,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(
      and(
        isNull(repairJobs.deletedAt),
        isNull(repairJobs.archivedAt),
        or(
          and(
            inArray(repairJobs.status, ["completed", "invoiced"]),
            isNull(repairJobs.holdedInvoiceId),
            notInArray(repairJobs.invoiceStatus, ["warranty", "no_damage", "rejected", "our_costs"]),
          ),
          and(eq(repairJobs.status, "quote_needed"), isNull(repairJobs.holdedQuoteId)),
        ),
      ),
    )
    .orderBy(desc(repairJobs.updatedAt))
    .limit(50);

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    update: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    delete: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    import: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
    export: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    bulk_update: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  };

  function buildHref(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { action: params.action ?? "", entity: params.entity ?? "", dateFrom: params.dateFrom ?? "", dateTo: params.dateTo ?? "", ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `${AUDIT_BASE}?${p.toString()}`;
  }

  function auditQuery(extra: Record<string, string>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `${AUDIT_BASE}?${qs}` : AUDIT_BASE;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Audit log</h2>
        <p className="text-xs text-muted-foreground">
          {totalCount} entr{totalCount !== 1 ? "ies" : "y"} recorded — who changed what in this app
        </p>
      </div>

      {holdedDataGaps.length > 0 && (
        <div className="motion-safe:animate-slide-up rounded-xl border border-amber-200/90 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Holded link gaps ({holdedDataGaps.length})
          </h3>
          <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/80">
            Completed or invoiced jobs without a linked Holded invoice (excluding warranty / no-charge), or quote-needed without a linked estimate. Use{" "}
            <strong>Financial → Link existing Holded document</strong> on the work order (managers).
          </p>
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs">
            {holdedDataGaps.map((r) => (
              <li key={r.id}>
                <Link href={`/repairs/${r.id}`} className="font-medium text-amber-950 underline-offset-2 hover:underline dark:text-amber-100">
                  {r.publicCode ?? r.title ?? r.id.slice(0, 8)}
                </Link>
                <span className="text-amber-800/80 dark:text-amber-300/80">
                  {" "}
                  · {r.status}
                  {r.customerName ? ` · ${r.customerName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { label: "All", action: "" },
          { label: "Create", action: "create", bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
          { label: "Update", action: "update", bg: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
          { label: "Delete", action: "delete", bg: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
          { label: "Import", action: "import", bg: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" },
        ].map((btn) => {
          const isActive = (params.action ?? "") === btn.action;
          const href = btn.action
            ? buildHref({ action: btn.action })
            : auditQuery({
                ...(params.entity ? { entity: params.entity } : {}),
                ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
                ...(params.dateTo ? { dateTo: params.dateTo } : {}),
              });
          const clearHref =
            isActive && btn.action
              ? auditQuery({
                  ...(params.entity ? { entity: params.entity } : {}),
                })
              : href;
          return (
            <Link key={btn.label} href={clearHref}>
              <span
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${
                  btn.bg ?? "bg-muted text-foreground"
                } ${
                  isActive
                    ? "ring-2 ring-primary/45 shadow-sm"
                    : btn.action
                      ? ""
                      : !params.action
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-sm"
                        : ""
                }`}
              >
                {btn.label}
              </span>
            </Link>
          );
        })}
      </div>

      <AuditFilters
        action={params.action}
        entity={params.entity}
        dateFrom={params.dateFrom}
        dateTo={params.dateTo}
      />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="max-h-[calc(100vh-20rem)] overflow-x-auto overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
              <TableRow className="border-b hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Timestamp</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">User</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Action</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Entity</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground motion-safe:animate-fade-in">
                      <Shield className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium">No audit log entries found</p>
                      <p className="text-xs">Try adjusting your filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, idx) => (
                  <TableRow key={log.id} className="table-row-animate" style={{ animationDelay: `${idx * 12}ms` }}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.userName ?? log.userEmail ?? <span className="text-muted-foreground">System</span>}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {log.entityType}:{log.entityId?.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-[11px] text-muted-foreground">
                      {log.changes ? JSON.stringify(log.changes).slice(0, 100) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Page {page} of {totalPages} ({totalCount} entries)
        </p>
      )}
    </div>
  );
}
