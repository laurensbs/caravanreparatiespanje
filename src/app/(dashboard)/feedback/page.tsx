import { getFeedback } from "@/actions/feedback";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeedbackClient } from "./feedback-client";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const items = await getFeedback();

  return (
    <FeedbackClient
      items={items}
      currentUserId={session.user.id!}
      userRole={session.user.role as "admin" | "manager" | "staff" | "viewer"}
    />
  );
}
