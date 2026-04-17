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
  const open = items.filter((i) => i.status === "open").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;

  return (
    <DashboardPageCanvas>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Feedback"
        description="Tell the team what should be better. Vote, discuss and follow what's being shipped."
        metadata={
          <>
            <span className="tabular-nums">{items.length} total</span>
            {open > 0 ? <span className="text-amber-600 dark:text-amber-400">{open} open</span> : null}
            {inProgress > 0 ? (
              <span className="text-sky-600 dark:text-sky-400">{inProgress} in progress</span>
            ) : null}
          </>
        }
      />
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03] max-sm:rounded-xl">
        <FeedbackClient
          items={items}
          currentUserId={session.user.id!}
          userRole={session.user.role as "admin" | "manager" | "staff" | "viewer"}
        />
      </div>
    </DashboardPageCanvas>
  );
}
