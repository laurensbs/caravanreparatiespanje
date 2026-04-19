import { getFeedback } from "@/actions/feedback";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeedbackClient } from "./feedback-client";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
} from "@/components/layout/dashboard-surface";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const items = await getFeedback();
  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const resolvedCount = items.filter(
    (i) => i.status === "done" || i.status === "dismissed",
  ).length;

  return (
    <DashboardPageCanvas>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Feedback"
        description="Tell the team what should be better. Vote, discuss and follow what's being shipped."
        metadata={
          <>
            <span className="tabular-nums">{items.length} total</span>
            {openCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">{openCount} open</span>
            ) : null}
            {inProgressCount > 0 ? (
              <span className="text-foreground/80">{inProgressCount} in progress</span>
            ) : null}
            {resolvedCount > 0 ? (
              <span className="text-muted-foreground">{resolvedCount} resolved</span>
            ) : null}
          </>
        }
      />
      <FeedbackClient
        items={items}
        currentUserId={session.user.id!}
        userRole={session.user.role as "admin" | "manager" | "staff" | "viewer"}
      />
    </DashboardPageCanvas>
  );
}
