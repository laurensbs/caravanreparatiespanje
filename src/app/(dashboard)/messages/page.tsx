import { listMessageThreads } from "@/actions/garage-sync";
import { MessagesAppClient } from "@/components/messages/messages-app-client";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const threads = await listMessageThreads();
  return <MessagesAppClient initialThreads={threads} />;
}
