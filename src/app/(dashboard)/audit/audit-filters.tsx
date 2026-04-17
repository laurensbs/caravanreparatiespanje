"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuditFilters({
  action,
  entity,
  dateFrom,
  dateTo,
}: {
  action?: string;
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const router = useRouter();

  function buildParams(overrides: Partial<{ entity: string; dateFrom: string; dateTo: string }>) {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    const e = overrides.entity !== undefined ? overrides.entity : (entity ?? "");
    const df = overrides.dateFrom !== undefined ? overrides.dateFrom : (dateFrom ?? "");
    const dt = overrides.dateTo !== undefined ? overrides.dateTo : (dateTo ?? "");
    if (e) p.set("entity", e);
    if (df) p.set("dateFrom", df);
    if (dt) p.set("dateTo", dt);
    const qs = p.toString();
    return qs ? `/audit?${qs}` : "/audit";
  }

  const hasFilters = Boolean(action || entity || dateFrom || dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <select
        name="entity"
        defaultValue={entity ?? ""}
        className="h-8 rounded-lg border bg-background px-3 text-xs"
        onChange={(ev) => router.push(buildParams({ entity: ev.target.value }))}
      >
        <option value="">All Entities</option>
        <option value="repair_job">Repair Jobs</option>
        <option value="customer">Contacts</option>
        <option value="unit">Units</option>
        <option value="user">Users</option>
        <option value="import">Imports</option>
      </select>
      <input
        type="date"
        defaultValue={dateFrom ?? ""}
        className="h-8 rounded-lg border bg-background px-3 text-xs"
        onChange={(ev) => router.push(buildParams({ dateFrom: ev.target.value }))}
      />
      <input
        type="date"
        defaultValue={dateTo ?? ""}
        className="h-8 rounded-lg border bg-background px-3 text-xs"
        onChange={(ev) => router.push(buildParams({ dateTo: ev.target.value }))}
      />
      {hasFilters ? (
        <Link href="/audit" className="ml-1 text-xs text-muted-foreground hover:text-foreground">
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}
