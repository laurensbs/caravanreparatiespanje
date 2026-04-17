"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createFeedback,
  updateFeedbackStatus,
  updateFeedbackAdminNotes,
  deleteFeedback,
  markFeedbackRepliesSeen,
} from "@/actions/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquarePlus,
  CheckCircle2,
  Clock,
  CircleDot,
  XCircle,
  Trash2,
  Loader2,
  MessageSquare,
  Pencil,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FeedbackProductUpdates } from "./feedback-product-updates";

type FeedbackItem = {
  id: string;
  userId: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "dismissed";
  adminNotes: string | null;
  authorHasUnreadResponse?: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string } | null;
};

interface FeedbackClientProps {
  items: FeedbackItem[];
  currentUserId: string;
  userRole: "admin" | "manager" | "staff" | "viewer";
}

const statusConfig = {
  open: {
    label: "Open",
    icon: CircleDot,
    variant: "default" as const,
    className: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  in_progress: {
    label: "In progress",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    variant: "outline" as const,
    className: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  },
  dismissed: {
    label: "Dismissed",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400",
  },
};

export function FeedbackClient({
  items,
  currentUserId,
  userRole,
}: FeedbackClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const isAdmin = userRole === "admin" || userRole === "manager";

  const [initialUnreadReplyIds] = useState(
    () => new Set(items.filter((i) => i.authorHasUnreadResponse).map((i) => i.id)),
  );

  useEffect(() => {
    void (async () => {
      await markFeedbackRepliesSeen();
      router.refresh();
    })();
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      await createFeedback({ title, description });
      setTitle("");
      setDescription("");
      setShowForm(false);
    });
  }

  function handleStatusChange(
    id: string,
    status: "open" | "in_progress" | "done" | "dismissed",
  ) {
    startTransition(async () => {
      await updateFeedbackStatus(id, status);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this?")) return;
    startTransition(async () => {
      await deleteFeedback(id);
    });
  }

  const openItems = items.filter((i) => i.status === "open" || i.status === "in_progress");
  const closedItems = items.filter((i) => i.status === "done" || i.status === "dismissed");

  return (
    <div className="animate-fade-in">
      <header className="border-b border-border/60 bg-gradient-to-r from-muted/20 via-transparent to-cyan-500/[0.04] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Feedback</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Suggest improvements or report issues. Managers can reply in the thread. Below you will find what has shipped recently; after
              that, your open and resolved requests. When there is an unread reply, a dot appears on the Feedback icon in the top bar until you
              open this page.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="h-11 w-full shrink-0 touch-manipulation gap-2 rounded-xl bg-primary px-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.98] sm:h-11 sm:w-auto sm:px-6"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            {showForm ? "Close form" : "New request"}
          </Button>
        </div>
      </header>

      <div className="space-y-6 border-b border-border/40 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        <FeedbackProductUpdates openRequestCount={openItems.length} doneRequestCount={closedItems.length} />

        {showForm && (
          <Card className="animate-slide-up border-primary/20 shadow-sm">
            <CardHeader className="space-y-1 px-4 pt-4 sm:px-6 sm:pt-6">
              <CardTitle className="text-lg sm:text-xl">New feedback</CardTitle>
              <CardDescription className="text-sm">What would you like changed or added?</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Title (e.g. search by registration)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                  className="h-11 touch-manipulation rounded-xl text-base sm:text-sm"
                />
                <Textarea
                  placeholder="Description (optional) — explain what you mean…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="min-h-[120px] touch-manipulation resize-y rounded-xl text-base sm:text-sm"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full touch-manipulation rounded-xl sm:h-10 sm:w-auto"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending || !title.trim()} className="h-11 w-full touch-manipulation rounded-xl sm:h-10 sm:w-auto">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                    Submit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <section id="feedback-queue" className="scroll-mt-6">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
            <div className="flex flex-col gap-1 border-b border-border/50 bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Open requests</h2>
                <p className="text-xs text-muted-foreground">Active items we have not marked as done yet.</p>
              </div>
              <Badge variant="secondary" className="w-fit shrink-0 tabular-nums">
                {openItems.length} open
              </Badge>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {openItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                    <Inbox className="h-7 w-7 opacity-70" aria-hidden />
                  </div>
                  <div className="max-w-sm space-y-1 px-2">
                    <p className="text-sm font-medium text-foreground">No open requests</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      You are all caught up. Use <span className="font-medium text-foreground">New request</span> to suggest an improvement.
                    </p>
                  </div>
                </div>
              ) : (
                openItems.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    isOwner={item.userId === currentUserId}
                    highlightTeamReply={initialUnreadReplyIds.has(item.id)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    isPending={isPending}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {closedItems.length > 0 && (
          <section className="space-y-0">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
              <div className="flex flex-col gap-1 border-b border-border/50 bg-muted/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Resolved</h2>
                  <p className="text-xs text-muted-foreground">Completed or dismissed requests.</p>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 tabular-nums text-muted-foreground">
                  {closedItems.length} total
                </Badge>
              </div>
              <div className="divide-y divide-border/50 p-2 sm:p-3">
                {closedItems.map((item) => (
                  <div key={item.id} className="p-2 sm:p-2.5">
                    <FeedbackCard
                      item={item}
                      isAdmin={isAdmin}
                      isOwner={item.userId === currentUserId}
                      highlightTeamReply={initialUnreadReplyIds.has(item.id)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      isPending={isPending}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FeedbackCard({
  item,
  isAdmin,
  isOwner,
  highlightTeamReply,
  onStatusChange,
  onDelete,
  isPending,
}: {
  item: FeedbackItem;
  isAdmin: boolean;
  isOwner: boolean;
  highlightTeamReply: boolean;
  onStatusChange: (id: string, status: "open" | "in_progress" | "done" | "dismissed") => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const router = useRouter();
  const config = statusConfig[item.status];
  const StatusIcon = config.icon;
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState(item.adminNotes ?? "");
  const [savingComment, startCommentTransition] = useTransition();

  function handleSaveComment() {
    startCommentTransition(async () => {
      await updateFeedbackAdminNotes(item.id, comment);
      setCommenting(false);
      router.refresh();
    });
  }

  const showInProgress = isAdmin && item.status === "open";
  const showMarkDone = isAdmin && (item.status === "open" || item.status === "in_progress");
  const showDelete = isAdmin || isOwner;
  const showActionRow = showInProgress || showMarkDone || showDelete;

  const showNewReplyRibbon = isOwner && highlightTeamReply && Boolean(item.adminNotes?.trim());

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-xl border-border/60 transition-all duration-200 hover:border-border hover:shadow-md sm:rounded-2xl",
        showNewReplyRibbon && "ring-2 ring-cyan-500/25 dark:ring-cyan-400/20",
      )}
    >
      {showNewReplyRibbon ? (
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-cyan-500/15 to-transparent px-4 py-2 text-xs font-semibold text-cyan-900 dark:from-cyan-500/20 dark:text-cyan-100">
          <span>New reply from the team</span>
        </div>
      ) : null}
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex gap-3 sm:min-w-0 sm:flex-1">
            <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground sm:h-5" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <span className="text-base font-semibold leading-snug sm:text-[15px]">{item.title}</span>
                <Badge className={cn("w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs", config.className)} variant={config.variant}>
                  {config.label}
                </Badge>
              </div>
              {item.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{item.user?.name ?? "Unknown"}</span>
                <span className="hidden sm:inline">·</span>
                <span>
                  {new Date(item.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {commenting ? (
                <div className="space-y-2 border-t border-border/50 pt-3">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment…"
                    rows={3}
                    className="min-h-[88px] touch-manipulation resize-y rounded-xl text-sm"
                    autoFocus
                  />
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 touch-manipulation rounded-xl sm:h-9 sm:px-4"
                      onClick={() => {
                        setComment(item.adminNotes ?? "");
                        setCommenting(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" className="h-11 touch-manipulation rounded-xl sm:h-9 sm:px-4" onClick={handleSaveComment} disabled={savingComment}>
                      {savingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : item.adminNotes ? (
                <button
                  type="button"
                  className="group/comment mt-1 w-full rounded-xl border border-transparent bg-muted/50 px-3 py-3 text-left transition-colors hover:bg-muted/70 active:bg-muted/80 sm:mt-0 sm:px-3 sm:py-2"
                  onClick={() => setCommenting(true)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Response
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground sm:hidden">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit
                    </span>
                    <Pencil className="hidden h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100 sm:block" aria-hidden />
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{item.adminNotes}</p>
                </button>
              ) : isAdmin ? (
                <button
                  type="button"
                  onClick={() => setCommenting(true)}
                  className="mt-1 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/30 hover:text-foreground sm:mt-0 sm:w-auto sm:justify-start sm:px-0 sm:py-1"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                  Add comment
                </button>
              ) : null}
            </div>
          </div>

          {showActionRow ? (
            <div className="flex flex-wrap items-stretch justify-stretch gap-2 border-t border-border/50 pt-3 sm:w-auto sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-start sm:border-t-0 sm:pt-0">
              {showInProgress && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 min-w-[2.75rem] flex-1 touch-manipulation rounded-xl sm:h-9 sm:w-9 sm:flex-none"
                  onClick={() => onStatusChange(item.id, "in_progress")}
                  disabled={isPending}
                  aria-label="Mark in progress"
                  title="Mark in progress"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              )}
              {showMarkDone && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 min-w-[2.75rem] flex-1 touch-manipulation rounded-xl sm:h-9 sm:w-9 sm:flex-none"
                  onClick={() => onStatusChange(item.id, "done")}
                  disabled={isPending}
                  aria-label="Mark done"
                  title="Mark done"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </Button>
              )}
              {showDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 min-w-[2.75rem] flex-1 touch-manipulation rounded-xl text-destructive hover:text-destructive sm:h-9 sm:w-9 sm:flex-none"
                  onClick={() => onDelete(item.id)}
                  disabled={isPending}
                  aria-label="Delete feedback"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
