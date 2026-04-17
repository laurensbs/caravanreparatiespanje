import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth-utils";
import type { UserRole } from "@/types";
import { SettingsNav } from "./settings-nav";
import { SettingsChildren } from "./settings-children";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
} from "@/components/layout/dashboard-surface";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const showAudit = !!session?.user?.role && hasMinRole(session.user.role as UserRole, "admin");

  return (
    <DashboardPageCanvas>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Settings"
        description={
          <>
            Account, locations, team, tags, pricing, Holded integration
            {showAudit ? ", and the audit trail" : ""}.
          </>
        }
      />

      <SettingsNav showAudit={showAudit} />

      <SettingsChildren>{children}</SettingsChildren>
    </DashboardPageCanvas>
  );
}
