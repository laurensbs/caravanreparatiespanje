"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Settings, MessageCircleQuestion, MessageSquare, Menu, Trash2 } from "lucide-react";
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
import { ReminderPanel } from "@/components/reminder-panel";
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
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 shrink-0 touch-manipulation rounded-lg"
      asChild
    >
      <Link
        href={href}
        title={title}
        aria-label={showBadge ? `${title}, ${badgeCount} unread` : title}
        className={cn(
          "inline-flex items-center justify-center text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-gray-100",
          isActive && "bg-gray-100 text-gray-900 dark:bg-white/[0.08] dark:text-gray-100"
        )}
      >
        {children}
        {showBadge ? (
          <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white tabular-nums ring-2 ring-white dark:ring-gray-950">
            {badgeCount! > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </Link>
    </Button>
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
  const { toggle } = useAssistantContext();
  const { setMobileOpen } = useSidebar();
  const showSettings = hasMinRole(userRole, "admin");
  const feedbackActive = pathname === "/feedback" || pathname.startsWith("/feedback/");
  const settingsActive = pathname.startsWith("/settings");
  const binActive = pathname.startsWith("/repairs/bin");

  return (
    <>
      <CommandPalette />
      <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-3 border-b border-gray-100 bg-white/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:border-gray-800/80 dark:bg-gray-950/70 dark:supports-[backdrop-filter]:bg-gray-950/60 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
            }
            className="group/search flex h-9 min-w-0 max-w-full flex-1 cursor-pointer items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 text-sm text-gray-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0)] transition-all hover:border-gray-200 hover:bg-white hover:text-gray-900 focus-visible:border-gray-300 focus-visible:bg-white focus-visible:outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-100 sm:max-w-sm lg:max-w-md"
          >
            <Search className="h-3.5 w-3.5 shrink-0 opacity-70 transition-opacity group-hover/search:opacity-100" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-normal">Search work, customers, units…</span>
            <kbd className="pointer-events-none hidden shrink-0 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex max-w-[min(60vw,18rem)] shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-none sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 touch-manipulation rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-gray-100"
            title="Smart Assistant"
            aria-label="Smart Assistant"
            onClick={() => toggle()}
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>

          <ReminderPanel />

          <HeaderIconLink
            href="/feedback"
            title="Feedback"
            isActive={feedbackActive}
            badgeCount={feedbackUnreadReplyCount}
          >
            <MessageSquare className="h-4 w-4" />
          </HeaderIconLink>

          <HeaderIconLink
            href="/repairs/bin"
            title="Deleted work orders"
            isActive={binActive}
          >
            <Trash2 className="h-4 w-4" />
          </HeaderIconLink>

          <span className="mx-1.5 hidden h-5 w-px bg-gray-200 dark:bg-gray-800 sm:block" aria-hidden />

          <ThemeToggle />

          {showSettings ? (
            <HeaderIconLink href="/settings" title="Settings" isActive={settingsActive}>
              <Settings className="h-4 w-4" />
            </HeaderIconLink>
          ) : null}

          <span className="mx-1.5 hidden h-5 w-px bg-gray-200 dark:bg-gray-800 sm:block" aria-hidden />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group/avatar h-9 gap-2 rounded-full px-1 pr-2.5 touch-manipulation transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                aria-label={`Account menu for ${userName}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-[11px] font-semibold text-white ring-1 ring-white/40 shadow-sm dark:ring-white/10">
                  {userName?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
                <span className="hidden max-w-[120px] truncate text-[13px] font-medium text-gray-700 group-hover/avatar:text-gray-900 dark:text-gray-300 dark:group-hover/avatar:text-gray-100 md:inline">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
              <DropdownMenuLabel className="rounded-lg px-2 py-2">
                <p className="text-sm font-semibold leading-tight">{userName}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</p>
                <Badge variant="secondary" className="mt-1.5 h-4 rounded-full px-1.5 text-[10px] font-medium">
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
      </header>
    </>
  );
}
