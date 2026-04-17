"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** Button label on the confirm action. Defaults to "Delete" for destructive, else "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone: destructive highlights in red, default is neutral primary. */
  tone?: "destructive" | "default";
  /** If provided, user must type this exact string before confirm becomes enabled. */
  requireTyping?: string;
};

type PendingRequest = ConfirmOptions & {
  id: number;
  resolve: (ok: boolean) => void;
};

let pushRequest: ((req: Omit<PendingRequest, "id">) => void) | null = null;
let requestCounter = 0;

/**
 * Programmatic confirm. Replaces `window.confirm()` with a branded dialog
 * that respects dark mode, mobile sheet layout, and screen readers.
 *
 * Usage:
 *   if (!(await confirmDialog({ title: "Delete?", tone: "destructive" }))) return;
 *   ...do the thing...
 *
 * Relies on <ConfirmDialogHost /> being mounted once near the root. If the
 * host isn't mounted, the call resolves `false` rather than silently
 * succeeding — safer than the other way around.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushRequest) {
      // Host not mounted; refuse the action conservatively.
      resolve(false);
      return;
    }
    pushRequest({ ...options, resolve });
  });
}

/**
 * Mount once, e.g. inside the dashboard and garage layouts. Renders the
 * confirm dialog for any queued confirmDialog() call.
 */
export function ConfirmDialogHost() {
  const [current, setCurrent] = React.useState<PendingRequest | null>(null);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    pushRequest = (req) => {
      const id = ++requestCounter;
      setCurrent({ ...req, id });
      setTyped("");
      setBusy(false);
    };
    return () => {
      pushRequest = null;
    };
  }, []);

  function close(result: boolean) {
    if (!current) return;
    const resolve = current.resolve;
    setCurrent(null);
    setTyped("");
    setBusy(false);
    // Defer resolve so the dialog close animation can start.
    queueMicrotask(() => resolve(result));
  }

  if (!current) return null;

  const tone = current.tone ?? "default";
  const confirmLabel =
    current.confirmLabel ?? (tone === "destructive" ? "Delete" : "Confirm");
  const cancelLabel = current.cancelLabel ?? "Cancel";
  const typingOk =
    !current.requireTyping || typed.trim() === current.requireTyping;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {tone === "destructive" ? (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle>{current.title}</DialogTitle>
              {current.description ? (
                <DialogDescription className="mt-1.5">
                  {current.description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {current.requireTyping ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Type{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {current.requireTyping}
              </span>{" "}
              to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              )}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={() => {
              setBusy(true);
              close(true);
            }}
            disabled={busy || !typingOk}
          >
            {busy ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
