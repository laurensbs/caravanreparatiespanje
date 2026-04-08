import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-utils";
import { desc, eq, like, and, sql } from "drizzle-orm";
import { format } from "date-fns";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entity?: string; q?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = 50;

  const conditions = [];
  if (params.action) conditions.push(eq(auditLogs.action, params.action));
  if (params.entity) conditions.push(eq(auditLogs.entityType, params.entity));
  if (params.q) conditions.push(like(auditLogs.entityType, `%${params.q}%`));

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

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
    import: "bg-purple-100 text-purple-800",
    export: "bg-yellow-100 text-yellow-800",
    bulk_update: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Complete history of all actions in the system.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        <select
          name="action"
          defaultValue={params.action ?? ""}
          className="rounded-lg border px-3 py-1.5 text-xs bg-background"
          onChange={(e) => {
            const val = e.target.value;
            const p = new URLSearchParams();
            if (val) p.set("action", val);
            if (params.entity) p.set("entity", params.entity);
            window.location.href = `/audit?${p.toString()}`;
          }}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="import">Import</option>
          <option value="export">Export</option>
          <option value="bulk_update">Bulk Update</option>
        </select>
        <select
          name="entity"
          defaultValue={params.entity ?? ""}
          className="rounded-lg border px-3 py-1.5 text-xs bg-background"
          onChange={(e) => {
            const val = e.target.value;
            const p = new URLSearchParams();
            if (params.action) p.set("action", params.action);
            if (val) p.set("entity", val);
            window.location.href = `/audit?${p.toString()}`;
          }}
        >
          <option value="">All Entities</option>
          <option value="repair_job">Repair Jobs</option>
          <option value="customer">Customers</option>
          <option value="unit">Units</option>
          <option value="user">Users</option>
          <option value="import">Imports</option>
        </select>
      </div>

      {/* Log table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Timestamp</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Entity</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
                  </td>
                  <td className="px-4 py-3">
                    {log.userName ?? log.userEmail ?? "System"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">
                      {log.entityType}:{log.entityId?.slice(0, 8)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                    {log.changes ? JSON.stringify(log.changes).slice(0, 100) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} entries)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/audit?page=${page - 1}&action=${params.action ?? ""}&entity=${params.entity ?? ""}`}
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/audit?page=${page + 1}&action=${params.action ?? ""}&entity=${params.entity ?? ""}`}
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
