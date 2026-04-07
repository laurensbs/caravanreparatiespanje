"use client";

import { useState, useTransition } from "react";
import {
  createFeedback,
  updateFeedbackStatus,
  deleteFeedback,
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
} from "lucide-react";

type FeedbackItem = {
  id: string;
  userId: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "dismissed";
  adminNotes: string | null;
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
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    variant: "outline" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  dismissed: {
    label: "Dismissed",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
  },
};

export function FeedbackClient({
  items,
  currentUserId,
  userRole,
}: FeedbackClientProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const isAdmin = userRole === "admin" || userRole === "manager";

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
    status: "open" | "in_progress" | "done" | "dismissed"
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Suggestions, improvements and feature requests
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 rounded-lg" size="sm">
          <MessageSquarePlus className="h-4 w-4" />
          New
        </Button>
      </div>

      {showForm && (
        <Card className="animate-slide-up border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">New Feedback</CardTitle>
            <CardDescription>
              What would you like changed or added?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Title (e.g. 'Search by registration')"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
              <Textarea
                placeholder="Description (optional) — explain what you mean..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending || !title.trim()}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Open items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Open ({openItems.length})
        </h2>
        {openItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No open feedback. Click &quot;New&quot; to add something.
            </CardContent>
          </Card>
        ) : (
          openItems.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isOwner={item.userId === currentUserId}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))
        )}
      </div>

      {/* Closed items */}
      {closedItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Completed ({closedItems.length})
          </h2>
          {closedItems.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isOwner={item.userId === currentUserId}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({
  item,
  isAdmin,
  isOwner,
  onStatusChange,
  onDelete,
  isPending,
}: {
  item: FeedbackItem;
  isAdmin: boolean;
  isOwner: boolean;
  onStatusChange: (id: string, status: "open" | "in_progress" | "done" | "dismissed") => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const config = statusConfig[item.status];
  const StatusIcon = config.icon;

  return (
    <Card className="transition-all duration-150 hover:shadow-sm">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{item.title}</span>
              <Badge className={config.className} variant={config.variant}>
                {config.label}
              </Badge>
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{item.user?.name ?? "Unknown"}</span>
              <span>·</span>
              <span>
                {new Date(item.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {item.adminNotes && (
              <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium text-xs text-muted-foreground">
                  Admin:
                </span>{" "}
                {item.adminNotes}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && item.status === "open" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStatusChange(item.id, "in_progress")}
                disabled={isPending}
                title="Mark in progress"
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (item.status === "open" || item.status === "in_progress") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStatusChange(item.id, "done")}
                disabled={isPending}
                title="Mark done"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </Button>
            )}
            {(isAdmin || isOwner) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id)}
                disabled={isPending}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
