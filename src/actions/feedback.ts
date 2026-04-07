"use server";

import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .update(feedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
}

export async function updateFeedbackAdminNotes(id: string, adminNotes: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .update(feedback)
    .set({ adminNotes: adminNotes.trim() || null, updatedAt: new Date() })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
}

export async function deleteFeedback(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.delete(feedback).where(eq(feedback.id, id));
  revalidatePath("/feedback");
}
