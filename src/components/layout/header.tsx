"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Settings, MessageCircleQuestion, MessageSquare } from "lucide-react";
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

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: UserRole;
}

function HeaderIconLink({
  href,
  title,
  children,
  isActive,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 touch-manipulation rounded-lg" asChild>
      <Link
        href={href}
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
          isActive && "bg-muted/80 text-foreground"
        )}
      >
        {children}
      </Link>
    </Button>
  );
}

export function Header({ userName, userEmail, userRole }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useAssistantContext();
  const showSettings = hasMinRole(userRole, "admin");
  const feedbackActive = pathname === "/feedback" || pathname.startsWith("/feedback/");
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      <CommandPalette />
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-card/85 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={() =>
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
          className="flex max-w-sm flex-1 cursor-pointer items-center gap-2 rounded-xl border border-transparent bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-all hover:border-border hover:bg-muted/70"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left text-xs">Search…</span>
          <kbd className="pointer-events-none hidden rounded-md border border-border/80 bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-muted-foreground hover:text-foreground"
            title="Smart Assistant"
            aria-label="Smart Assistant"
            onClick={() => toggle()}
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>

          <ReminderPanel />

          <HeaderIconLink href="/feedback" title="Feedback" isActive={feedbackActive}>
            <MessageSquare className="h-4 w-4" />
          </HeaderIconLink>

          <ThemeToggle />

          {showSettings ? (
            <HeaderIconLink href="/settings" title="Settings" isActive={settingsActive}>
              <Settings className="h-4 w-4" />
            </HeaderIconLink>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-0.5 gap-2 rounded-lg touch-manipulation sm:ml-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {userName?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">{userName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {userRole}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/settings/account")}>
                <Settings className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              {showSettings ? (
                <DropdownMenuItem onSelect={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  All settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
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
