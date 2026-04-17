import { getFeedback } from "@/actions/feedback";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeedbackClient } from "./feedback-client";
import { cn } from "@/lib/utils";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const items = await getFeedback();

  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in px-0 sm:px-0">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm",
          "max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none"
        )}
      >
        <FeedbackClient
          items={items}
          currentUserId={session.user.id!}
          userRole={session.user.role as "admin" | "manager" | "staff" | "viewer"}
        />
      </div>
    </div>
  );
}
