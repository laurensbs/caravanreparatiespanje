"use server";

import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-utils";
import { eq, desc, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getFeedback() {
  const items = await db.query.feedback.findMany({
    with: { user: { columns: { id: true, name: true } } },
    orderBy: [desc(feedback.createdAt)],
  });
  return items;
}

export async function createFeedback(data: {
  title: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const title = data.title.trim();
  if (!title) throw new Error("Title is required");

  await db.insert(feedback).values({
    userId: session.user.id,
    title,
    description: data.description?.trim() || null,
  });

  revalidatePath("/feedback");
}

export async function updateFeedbackStatus(
  id: string,
  status: "open" | "in_progress" | "done" | "dismissed"
) {
  await requireRole("manager");

  await db
    .update(feedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
}

export async function updateFeedbackAdminNotes(id: string, adminNotes: string) {
  const session = await requireRole("manager");

  const trimmed = adminNotes.trim() || null;
  const [row] = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
  if (!row) throw new Error("Feedback not found");

  const prev = (row.adminNotes ?? "").trim();
  const next = (trimmed ?? "").trim();
  const responseChanged = prev !== next;
  const authorId = row.userId;
  const flagAuthorUnread =
    Boolean(next) &&
    responseChanged &&
    authorId != null &&
    authorId !== session.user.id;

  await db
    .update(feedback)
    .set({
      adminNotes: trimmed,
      updatedAt: new Date(),
      ...(flagAuthorUnread ? { authorHasUnreadResponse: true } : {}),
    })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
  revalidatePath("/", "layout");
}

/** Clears in-app “new reply” for the current user’s feedback items (call when they open /feedback). */
export async function markFeedbackRepliesSeen() {
  const session = await auth();
  if (!session?.user?.id) return { cleared: 0 };

  const cleared = await db
    .update(feedback)
    .set({ authorHasUnreadResponse: false })
    .where(and(eq(feedback.userId, session.user.id), eq(feedback.authorHasUnreadResponse, true)))
    .returning({ id: feedback.id });

  revalidatePath("/", "layout");
  revalidatePath("/feedback");
  return { cleared: cleared.length };
}

export async function getUnreadFeedbackReplyCount(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), eq(feedback.authorHasUnreadResponse, true)));

  return r?.n ?? 0;
}

export async function deleteFeedback(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.delete(feedback).where(eq(feedback.id, id));
  revalidatePath("/feedback");
}
