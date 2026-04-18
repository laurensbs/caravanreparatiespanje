import { db } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth-utils";
import { eq, desc, and, sql } from "drizzle-orm";
import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import {
  SettingsPanel,
  SettingsSectionHeader,
} from "@/components/settings/settings-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity, Clock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Activity",
};

const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
  "from-stone-500 to-stone-700",
];
function avatarGradient(name: string | undefined | null): string {
  const key = (name ?? "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function relative(ts: Date | null): string {
  if (!ts) return "Nog nooit";
  return formatDistanceToNow(ts, { addSuffix: true, locale: nl });
}

function statusFor(lastSeen: Date | null): {
  label: string;
  dot: string;
  text: string;
} {
  if (!lastSeen) {
    return { label: "Nog nooit ingelogd", dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
  }
  const minutes = (Date.now() - lastSeen.getTime()) / 60_000;
  if (minutes < 10) return { label: "Nu actief", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (minutes < 60 * 24) return { label: "Recent", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { label: "Langer geleden", dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
}

export default async function ActivityPage() {
  // Owner-only — defer to the helper which throws on non-owner. We catch
  // and redirect to dashboard rather than letting the error boundary
  // render, because this page is intentionally hidden, not 'broken'.
  try {
    await requireOwner();
  } catch {
    redirect("/");
  }

  // 1) All active users + their last successful login (from audit_logs).
  // 2) Last 25 login events for the timeline.
  const [usersWithLogins, recentLogins, totals] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
        lastLoginAt: sql<Date | null>`max(${auditLogs.createdAt})`,
        loginCount: sql<number>`count(${auditLogs.id})::int`,
      })
      .from(users)
      .leftJoin(
        auditLogs,
        and(eq(auditLogs.userId, users.id), eq(auditLogs.action, "login")),
      )
      .groupBy(users.id, users.name, users.email, users.role, users.active, users.createdAt)
      .orderBy(desc(sql`max(${auditLogs.createdAt})`)),

    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
        userId: users.id,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.action, "login"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(25),

    db
      .select({
        total: sql<number>`count(*)::int`,
        last24h: sql<number>`count(*) filter (where ${auditLogs.createdAt} > now() - interval '24 hours')::int`,
        last7d: sql<number>`count(*) filter (where ${auditLogs.createdAt} > now() - interval '7 days')::int`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.action, "login")),
  ]);

  const [stats] = totals;

  return (
    <div className="space-y-5">
      <SettingsPanel className="space-y-3">
        <SettingsSectionHeader
          icon={Activity}
          title="Workspace activity"
          description="Wie heeft wanneer ingelogd. Alleen jij ziet deze pagina."
        />
        <div className="grid grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Totaal logins</p>
            <p className="text-xl font-semibold tabular-nums tracking-[-0.01em]">{stats?.total ?? 0}</p>
          </div>
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Laatste 24u</p>
            <p className="text-xl font-semibold tabular-nums tracking-[-0.01em]">{stats?.last24h ?? 0}</p>
          </div>
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Laatste 7d</p>
            <p className="text-xl font-semibold tabular-nums tracking-[-0.01em]">{stats?.last7d ?? 0}</p>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold tracking-[-0.01em]">Per gebruiker</h3>
          <span className="text-[11px] text-muted-foreground">
            {usersWithLogins.length} {usersWithLogins.length === 1 ? "gebruiker" : "gebruikers"}
          </span>
        </div>
        {usersWithLogins.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Geen gebruikers"
            description="Voeg eerst gebruikers toe in Settings → Users."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {usersWithLogins.map((u) => {
              const status = statusFor(u.lastLoginAt);
              return (
                <li
                  key={u.id}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40",
                    !u.active && "opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-semibold text-white shadow-sm",
                      avatarGradient(u.name),
                    )}
                  >
                    {(u.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium tracking-[-0.005em] text-foreground">{u.name}</p>
                      {u.email.toLowerCase().trim() === "laurensbos@hotmail.com" ? (
                        <Crown className="h-3 w-3 text-amber-500" aria-label="Owner" />
                      ) : null}
                      {!u.active ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Inactief
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {u.role} · {u.loginCount ?? 0} login{u.loginCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                    {u.lastLoginAt ? (
                      <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
                        {relative(u.lastLoginAt)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsPanel>

      <SettingsPanel padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-[-0.01em]">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
            Laatste 25 logins
          </h3>
          <span className="text-[11px] text-muted-foreground">timeline</span>
        </div>
        {recentLogins.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nog geen login events"
            description="Zodra iemand inlogt verschijnt het hier."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {recentLogins.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10.5px] font-semibold text-white",
                    avatarGradient(log.userName),
                  )}
                >
                  {(log.userName ?? "?").charAt(0).toUpperCase()}
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">
                  <span className="font-medium">{log.userName ?? "Onbekend"}</span>{" "}
                  <span className="text-muted-foreground">heeft ingelogd</span>
                </p>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {format(new Date(log.createdAt), "dd MMM HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsPanel>
    </div>
  );
}
