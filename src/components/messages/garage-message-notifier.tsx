"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLatestUnreadGarageMessage } from "@/actions/garage-sync";

const STORAGE_KEY = "admin:last-seen-garage-msg";
const POLL_MS = 15_000;
const POLL_MS_HIDDEN = 60_000;

/**
 * Global polling notifier for admins: whenever the newest unread
 * garage→admin message has an id we haven't seen before, show a loud
 * toast with a "View" button that deep-links into the Messages app.
 * Also plays a short beep the first time.
 *
 * We skip the toast entirely when the user is already sitting on the
 * /messages page — the thread list handles unread surfacing there.
 */
export function GarageMessageNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const lastToastId = useRef<string | null>(null);
  const hasPrimed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const msg = await getLatestUnreadGarageMessage();
        if (cancelled) return;

        if (!msg) {
          // Clean inbox — clear our watermark so next message re-notifies.
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {}
          schedule();
          return;
        }

        const lastSeen = (() => {
          try {
            return window.localStorage.getItem(STORAGE_KEY);
          } catch {
            return null;
          }
        })();

        // On first tick, don't pop for messages we've already notified
        // in a previous session — but do pop for any id newer than the
        // watermark. That way an admin who comes back from lunch sees
        // the messages they missed.
        if (!hasPrimed.current) {
          hasPrimed.current = true;
          // If this message is the same as the one we last showed, stay
          // quiet. Otherwise fall through and show it once.
          if (lastSeen === msg.id) {
            schedule();
            return;
          }
        }

        const alreadyShown = lastSeen === msg.id || lastToastId.current === msg.id;
        const onMessagesPage = pathname?.startsWith("/messages");

        if (!alreadyShown && !onMessagesPage) {
          lastToastId.current = msg.id;
          try {
            window.localStorage.setItem(STORAGE_KEY, msg.id);
          } catch {}

          // Soft beep — best-effort, browsers will block without gesture.
          try {
            const ctx = new (window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
              AudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.value = 0.05;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => {
              o.stop();
              ctx.close();
            }, 160);
          } catch {}

          const who = msg.authorName?.trim() || "Garage";
          const code = msg.publicCode ? `${msg.publicCode} · ` : "";
          const customer = msg.customerName ? `${msg.customerName}` : "";
          const header = customer ? `${code}${customer}` : `${code}${msg.title ?? "Repair"}`;
          const body = msg.body.length > 140 ? `${msg.body.slice(0, 137)}…` : msg.body;

          toast(
            `💬 ${who} — ${header}`,
            {
              description: body,
              duration: 30_000,
              closeButton: true,
              style: {
                // Emerald accent band + subtle bump so the message popup
                // is distinguishable from regular toasts.
                borderLeft: "4px solid rgb(16 185 129)",
              },
              action: {
                label: "View",
                onClick: () => router.push(`/messages?repair=${msg.repairJobId}`),
              },
            },
          );
        }
      } catch (err) {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("garage-message-notifier poll failed", err);
        }
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (cancelled) return;
      const visible = typeof document !== "undefined" ? !document.hidden : true;
      const ms = visible ? POLL_MS : POLL_MS_HIDDEN;
      timer = setTimeout(tick, ms);
    }

    // Kick off immediately on mount.
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pathname, router]);

  return null;
}
