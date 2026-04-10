import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LanguageProvider } from "@/components/garage/language-toggle";
import { Toaster } from "sonner";

export const metadata = {
  title: "Garage — Caravan Repairs",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent" as const,
    title: "Garage",
  },
};

export default async function GarageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {children}
        <Toaster richColors position="top-center" toastOptions={{ className: "rounded-lg" }} />
      </div>
    </LanguageProvider>
  );
}
