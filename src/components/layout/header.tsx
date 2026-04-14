"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, User, Settings, MessageCircleQuestion } from "lucide-react";
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
import type { UserRole } from "@/types";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: UserRole;
}

export function Header({ userName, userEmail, userRole }: HeaderProps) {
  const router = useRouter();
  const { toggle } = useAssistantContext();

  return (
    <>
      <CommandPalette />
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-card/80 px-5 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        {/* Search - left aligned */}
        <button
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            )
          }
          className="flex flex-1 max-w-sm items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground transition-all hover:bg-muted cursor-pointer border border-transparent hover:border-border"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left text-xs">Search...</span>
          <kbd className="hidden rounded-md bg-background/80 border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-blue-600"
            title="Smart Assistant"
            onClick={() => toggle()}
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>
          <ReminderPanel />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 ml-1 rounded-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {userName?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <span className="hidden md:inline text-sm font-medium">{userName}</span>
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
                Account Settings
              </DropdownMenuItem>
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
