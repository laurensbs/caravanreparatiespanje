import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
    <div className="flex min-h-screen">
      <Sidebar userRole={session.user.role as UserRole} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header
          userName={session.user.name}
          userEmail={session.user.email}
          userRole={session.user.role as UserRole}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
