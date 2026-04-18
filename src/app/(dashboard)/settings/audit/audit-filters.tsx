"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const AUDIT_BASE = "/settings/audit";

export function AuditFilters({
  action,
  entity,
  dateFrom,
  dateTo,
  userId,
  users = [],
}: {
  action?: string;
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  users?: { id: string; name: string }[];
}) {
  const router = useRouter();

  function buildParams(overrides: Partial<{ entity: string; dateFrom: string; dateTo: string; userId: string }>) {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    const e = overrides.entity !== undefined ? overrides.entity : (entity ?? "");
    const df = overrides.dateFrom !== undefined ? overrides.dateFrom : (dateFrom ?? "");
    const dt = overrides.dateTo !== undefined ? overrides.dateTo : (dateTo ?? "");
    const u = overrides.userId !== undefined ? overrides.userId : (userId ?? "");
    if (e) p.set("entity", e);
    if (df) p.set("dateFrom", df);
    if (dt) p.set("dateTo", dt);
    if (u) p.set("userId", u);
    const qs = p.toString();
    return qs ? `${AUDIT_BASE}?${qs}` : AUDIT_BASE;
  }

  const hasFilters = Boolean(action || entity || dateFrom || dateTo || userId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
      <select
        name="entity"
        defaultValue={entity ?? ""}
        className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
        onChange={(ev) => router.push(buildParams({ entity: ev.target.value }))}
      >
        <option value="">All Entities</option>
        <option value="repair_job">Repair Jobs</option>
        <option value="customer">Contacts</option>
        <option value="unit">Units</option>
        <option value="user">Users</option>
        <option value="import">Imports</option>
      </select>
      {users.length > 0 ? (
        <select
          name="userId"
          defaultValue={userId ?? ""}
          className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
          onChange={(ev) => router.push(buildParams({ userId: ev.target.value }))}
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      ) : null}
      <input
        type="date"
        defaultValue={dateFrom ?? ""}
        className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
        onChange={(ev) => router.push(buildParams({ dateFrom: ev.target.value }))}
      />
      <input
        type="date"
        defaultValue={dateTo ?? ""}
        className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
        onChange={(ev) => router.push(buildParams({ dateTo: ev.target.value }))}
      />
      {hasFilters ? (
        <Link href={AUDIT_BASE} className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}
