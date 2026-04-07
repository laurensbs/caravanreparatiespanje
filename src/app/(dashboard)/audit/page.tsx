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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Complete history of all actions in the system.
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2">
        <select
          name="action"
          defaultValue={params.action ?? ""}
          className="rounded-md border px-3 py-2 text-sm"
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
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Entities</option>
          <option value="repair_job">Repair Jobs</option>
          <option value="customer">Customers</option>
          <option value="unit">Units</option>
          <option value="user">Users</option>
          <option value="import">Imports</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Filter
        </button>
      </form>

      {/* Log table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Entity</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} entries)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/audit?page=${page - 1}&action=${params.action ?? ""}&entity=${params.entity ?? ""}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/audit?page=${page + 1}&action=${params.action ?? ""}&entity=${params.entity ?? ""}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
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
