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
              className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-3 md:p-4 animate-fade-in"
              style={{
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              {children}
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
      </AssistantProvider>
    </SidebarProvider>
  );
}
