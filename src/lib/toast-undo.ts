import { toast } from "sonner";

/**
 * Wraps a successful mutation with an "Undo" toast that, when clicked,
 * runs the inverse action. The pattern is:
 *
 *   await mutate(newValue);
 *   toastWithUndo({
 *     message: "Status updated",
 *     description: "Set to In progress",
 *     undo: () => mutate(oldValue),
 *   });
 *
 * Behaviour:
 *  - The action stays clickable for `duration` ms (default 6s).
 *  - On click we call `undo()` and replace the toast with a brief
 *    "Reverted" confirmation. Errors during undo show a destructive
 *    toast.
 *  - Pressing the close button or letting it time out leaves the
 *    mutation in place silently.
 */
export function toastWithUndo({
  message,
  description,
  undo,
  duration = 6000,
}: {
  message: string;
  description?: string;
  undo: () => Promise<unknown> | unknown;
  duration?: number;
}) {
  toast.success(message, {
    description,
    duration,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await undo();
          toast("Reverted", { duration: 2000 });
        } catch (err) {
          toast.error("Couldn't undo", {
            description: err instanceof Error ? err.message : "Try again or refresh.",
          });
        }
      },
    },
  });
}
