"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Settings, Sparkles, MessageSquare, Menu, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { HoverHint, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { useAssistantContext } from "@/components/assistant-context";
import { hasMinRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { useSidebar } from "./sidebar-context";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: UserRole;
  feedbackUnreadReplyCount?: number;
}

/**
 * Stable per-user avatar gradient. Same input always returns the same
 * gradient classes, so each admin gets a consistent colour across the
 * app (header, dropdowns, login). Picked from the same palette as the
 * login account tiles for visual continuity.
 */
const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
  "from-stone-500 to-stone-700",
];
function avatarGradient(name: string | undefined | null): string {
  const key = (name ?? "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function HeaderIconLink({
  href,
  title,
  children,
  isActive,
  badgeCount,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  isActive: boolean;
  badgeCount?: number;
}) {
  const showBadge = badgeCount != null && badgeCount > 0;
  return (
    <HoverHint label={title} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-11 w-11 shrink-0 touch-manipulation rounded-lg sm:h-8 sm:w-8"
        asChild
      >
        <Link
          href={href}
          aria-label={showBadge ? `${title}, ${badgeCount} unread` : title}
          className={cn(
            "group inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground active:scale-[0.96]",
            isActive && "bg-foreground/[0.06] text-foreground"
          )}
        >
          {children}
          {showBadge ? (
            <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white tabular-nums ring-2 ring-white dark:ring-gray-950">
              {badgeCount! > 9 ? "9+" : badgeCount}
            </span>
          ) : null}
        </Link>
      </Button>
    </HoverHint>
  );
}

function HeaderIconButton({
  title,
  onClick,
  children,
  isActive,
  badgeCount,
  badgeTone = "red",
  ariaLabel,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  isActive?: boolean;
  badgeCount?: number;
  badgeTone?: "red" | "neutral";
  ariaLabel?: string;
}) {
  const showBadge = badgeCount != null && badgeCount > 0;
  return (
    <HoverHint label={title} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClick}
        aria-label={ariaLabel ?? (showBadge ? `${title}, ${badgeCount} pending` : title)}
        className={cn(
          "group relative h-11 w-11 shrink-0 touch-manipulation rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground active:scale-[0.96] sm:h-8 sm:w-8",
          isActive && "bg-foreground/[0.06] text-foreground",
        )}
      >
        {children}
        {showBadge ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums ring-2 ring-background",
              badgeTone === "red"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background",
            )}
          >
            {badgeCount! > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </Button>
    </HoverHint>
  );
}

export function Header({
  userName,
  userEmail,
  userRole,
  feedbackUnreadReplyCount = 0,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { open: assistantOpen, openWith, inboxTotalCount, inboxBadgeCount } = useAssistantContext();
  const { setMobileOpen } = useSidebar();
  const showSettings = hasMinRole(userRole, "admin");
  const feedbackActive = pathname === "/feedback" || pathname.startsWith("/feedback/");
  const settingsActive = pathname.startsWith("/settings");
  const binActive = pathname.startsWith("/repairs/bin");
  // Choose what badge to show on the unified Assistant icon:
  //  – Red, urgent overdue count if any.
  //  – Otherwise neutral total inbox count (or no badge if zero).
  const assistantBadge = inboxBadgeCount > 0 ? inboxBadgeCount : inboxTotalCount;
  const assistantBadgeTone: "red" | "neutral" = inboxBadgeCount > 0 ? "red" : "neutral";

  return (
    <>
      <CommandPalette />
      <header
        // min-h i.p.v. fixed h, zodat env(safe-area-inset-top) de header
        // boven de iPhone statusbar uitbreidt (tijd/batterij) in plaats
        // van er overheen te lopen. Desktop houdt 14 (56px) als vloer.
        className="sticky top-0 z-30 flex min-h-[60px] min-w-0 items-center gap-2 border-b border-border/60 bg-background/75 px-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:min-h-14 sm:gap-3 sm:px-5"
        style={{ paddingTop: "max(6px, env(safe-area-inset-top))" }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group h-11 w-11 shrink-0 touch-manipulation rounded-lg text-muted-foreground hover:text-foreground sm:h-9 sm:w-9 lg:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="icon-pop h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
            }
            className="group group/search relative flex h-11 min-w-0 max-w-full flex-1 cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 px-3.5 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_0_0_rgba(0,0,0,0.02)] transition-all hover:border-foreground/15 hover:from-card hover:to-card hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_8px_-2px_rgba(0,0,0,0.06)] focus-visible:border-ring focus-visible:from-card focus-visible:to-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:from-card/[0.04] dark:to-card/[0.02] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:from-card/[0.08] dark:hover:to-card/[0.06] sm:h-9 sm:gap-2 sm:px-3 sm:max-w-sm lg:max-w-md"
          >
            <Search className="icon-pop h-[18px] w-[18px] shrink-0 opacity-70 transition-all group-hover/search:opacity-100 group-hover/search:text-foreground sm:h-[15px] sm:w-[15px]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-[15px] font-normal tracking-[-0.005em] sm:text-[13px]">
              <span className="sm:hidden">Search…</span>
              <span className="hidden sm:inline">Search work orders, contacts, units…</span>
            </span>
            <kbd className="pointer-events-none hidden shrink-0 items-center gap-[3px] rounded-md border border-border/80 bg-card/90 px-[6px] py-[2px] font-mono text-[10px] font-semibold tracking-wide text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur transition-colors group-hover/search:text-foreground/80 dark:bg-card/40 dark:shadow-[0_1px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] sm:inline-flex">
              <span className="text-[11px] leading-none">⌘</span>
              <span className="leading-none">K</span>
            </kbd>
          </button>
        </div>

        <TooltipProvider delayDuration={250} disableHoverableContent>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-0.5">
          {/*
            Compact "more" overflow on phones. We collapse Inbox / Feedback /
            Bin / Theme / Settings into a single tap target so the search bar
            actually has room to breathe and every visible button stays >=44px.
          */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More actions"
                className="relative h-11 w-11 shrink-0 touch-manipulation rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground active:scale-[0.96] sm:hidden"
              >
                <MoreHorizontal className="h-5 w-5" />
                {assistantBadge > 0 || feedbackUnreadReplyCount > 0 ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
              <DropdownMenuItem
                className="rounded-lg py-2.5"
                onSelect={() => openWith(inboxTotalCount > 0 ? "inbox" : "assistant")}
              >
                <Sparkles className="mr-2.5 h-4 w-4" />
                <span className="flex-1">{inboxTotalCount > 0 ? "Inbox" : "Assistant"}</span>
                {assistantBadge > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      assistantBadgeTone === "red" && "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {assistantBadge > 9 ? "9+" : assistantBadge}
                  </Badge>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg py-2.5" onSelect={() => router.push("/feedback")}>
                <MessageSquare className="mr-2.5 h-4 w-4" />
                <span className="flex-1">Feedback</span>
                {feedbackUnreadReplyCount > 0 ? (
                  <Badge variant="outline" className="h-5 rounded-full border-destructive/40 bg-destructive/10 px-1.5 text-[10px] font-semibold tabular-nums text-destructive">
                    {feedbackUnreadReplyCount > 9 ? "9+" : feedbackUnreadReplyCount}
                  </Badge>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg py-2.5" onSelect={() => router.push("/repairs/bin")}>
                <Trash2 className="mr-2.5 h-4 w-4" />
                Deleted work orders
              </DropdownMenuItem>
              {showSettings ? (
                <DropdownMenuItem className="rounded-lg py-2.5" onSelect={() => router.push("/settings")}>
                  <Settings className="mr-2.5 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center gap-0.5 sm:flex">
            <HeaderIconButton
              title={inboxTotalCount > 0 ? `Inbox · ${inboxTotalCount}` : "Inbox & Assistant"}
              ariaLabel="Open inbox and assistant"
              isActive={assistantOpen}
              badgeCount={assistantBadge}
              badgeTone={assistantBadgeTone}
              onClick={() => openWith(inboxTotalCount > 0 ? "inbox" : "assistant")}
            >
              <Sparkles className="icon-wiggle h-4 w-4" />
            </HeaderIconButton>

            <HeaderIconLink
              href="/feedback"
              title="Feedback"
              isActive={feedbackActive}
              badgeCount={feedbackUnreadReplyCount}
            >
              <MessageSquare className="icon-bob h-4 w-4" />
            </HeaderIconLink>

            <HeaderIconLink
              href="/repairs/bin"
              title="Deleted work orders"
              isActive={binActive}
            >
              <Trash2 className="icon-wiggle h-4 w-4" />
            </HeaderIconLink>

            <span className="mx-1.5 hidden h-5 w-px bg-border sm:block" aria-hidden />

            <HoverHint label="Toggle theme" side="bottom">
              <span className="inline-flex">
                <ThemeToggle />
              </span>
            </HoverHint>

            {showSettings ? (
              <HeaderIconLink href="/settings" title="Settings" isActive={settingsActive}>
                <Settings className="icon-spin-slow h-4 w-4" />
              </HeaderIconLink>
            ) : null}

            <span className="mx-1.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group/avatar h-11 gap-2 rounded-full px-1 pr-1 touch-manipulation transition-colors hover:bg-foreground/[0.05] sm:h-9 sm:pr-2.5"
                aria-label={`Account menu for ${userName}`}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white ring-1 ring-white/40 shadow-sm dark:ring-white/10",
                    avatarGradient(userName),
                  )}
                >
                  {userName?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
                <span className="hidden max-w-[120px] truncate text-[13px] font-medium tracking-[-0.005em] text-foreground/80 group-hover/avatar:text-foreground md:inline">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
              <DropdownMenuLabel className="rounded-lg px-2 py-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                      avatarGradient(userName),
                    )}
                  >
                    {userName?.charAt(0)?.toUpperCase() ?? "U"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight tracking-[-0.01em]">{userName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>
                <Badge variant="outline" className="mt-2 h-4 rounded-full px-1.5 text-[10px] font-medium uppercase tracking-wider">
                  {userRole}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg" onSelect={() => router.push("/settings/account")}>
                <Settings className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              {showSettings ? (
                <DropdownMenuItem className="rounded-lg" onSelect={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  All settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-lg text-destructive focus:text-destructive"
                onSelect={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </TooltipProvider>
      </header>
    </>
  );
}
