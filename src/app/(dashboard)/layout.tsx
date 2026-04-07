import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardContent } from "@/components/layout/dashboard-content";
import { Toaster } from "sonner";
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar userRole={session.user.role as UserRole} />
        <DashboardContent>
          <Header
            userName={session.user.name}
            userEmail={session.user.email}
            userRole={session.user.role as UserRole}
          />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 animate-fade-in">
            {children}
          </main>
          <Toaster richColors position="bottom-right" toastOptions={{ className: "rounded-xl" }} />
        </DashboardContent>
      </div>
    </SidebarProvider>
  );
}
