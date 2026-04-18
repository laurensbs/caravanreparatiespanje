import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getUnreadFeedbackReplyCount } from "@/actions/feedback";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardContent } from "@/components/layout/dashboard-content";
import { AssistantProvider } from "@/components/assistant-context";
import { AssistantShell } from "@/components/assistant-shell";
import { RouteProgress } from "@/components/layout/route-progress";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { PageTransition } from "@/components/layout/page-transition";
import { Toaster } from "sonner";
import { sonnerToastOptions } from "@/lib/sonner-toast-options";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const feedbackUnreadReplyCount = session.user.id
    ? await getUnreadFeedbackReplyCount(session.user.id)
    : 0;

  return (
    <SidebarProvider>
      <AssistantProvider>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {/* Skip link — invisible until focused, jumps over the chrome
            for keyboard users. Uses the amber focus ring + foreground
            pill so it matches the rest of the panel when revealed. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.30)] focus:ring-2 focus:ring-ring/40 focus:outline-none"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar userRole={session.user.role as UserRole} />
          <DashboardContent>
            <Header
              userName={session.user.name}
              userEmail={session.user.email}
              userRole={session.user.role as UserRole}
              feedbackUnreadReplyCount={feedbackUnreadReplyCount}
            />
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-3 md:p-4 focus:outline-none"
              style={{
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              <Suspense fallback={null}>
                <PageTransition>{children}</PageTransition>
              </Suspense>
            </main>
            <Toaster
              theme="system"
              position="bottom-right"
              offset={{ bottom: "1rem", right: "1rem" }}
              closeButton
              duration={4500}
              visibleToasts={4}
              gap={10}
              toastOptions={sonnerToastOptions}
            />
            <AssistantShell />
          </DashboardContent>
        </div>
        <ConfirmDialogHost />
        <KeyboardShortcuts />
      </AssistantProvider>
    </SidebarProvider>
  );
}
