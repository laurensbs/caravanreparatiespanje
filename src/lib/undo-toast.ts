"use client";

import { toast } from "sonner";

/**
 * Show a success toast with an Undo action. The `undo` callback is fired
 * when the user clicks the Undo button within the toast's lifetime.
 *
 * This is the standard pattern for "soft destructive" actions like moving
 * a repair to the bin, deleting a tag, or removing a line item — anything
 * that's reversible on the server side. If `undo` itself throws, we fall
 * back to an error toast so the user knows the restore failed.
 */
export function toastWithUndo(
  message: string,
  undo: () => Promise<void> | void,
  opts?: { duration?: number; description?: string },
) {
  const id = toast.success(message, {
    description: opts?.description,
    duration: opts?.duration ?? 6500,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await undo();
          toast.success("Undone", { id, duration: 2000 });
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Could not undo that action";
          toast.error(msg, { id });
        }
      },
    },
  });
}
