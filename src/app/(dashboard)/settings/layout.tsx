import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth-utils";
import type { UserRole } from "@/types";
import { SettingsNav } from "./settings-nav";
import { SettingsChildren } from "./settings-children";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const showAudit = !!session?.user?.role && hasMinRole(session.user.role as UserRole, "admin");

  return (
    <div className="space-y-5 motion-safe:animate-fade-in">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 px-5 py-4 shadow-sm dark:from-card dark:via-card dark:to-muted/10">
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
          Account, locations, team, tags, pricing, Holded integration
          {showAudit ? ", and audit trail" : ""}.
        </p>
      </div>

      <SettingsNav showAudit={showAudit} />

      <SettingsChildren>{children}</SettingsChildren>
    </div>
  );
}
