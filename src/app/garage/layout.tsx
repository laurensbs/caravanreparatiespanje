import { LanguageProvider } from "@/components/garage/language-toggle";
import { Toaster } from "sonner";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { GarageLoginForm } from "@/components/garage/login-form";

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
  const authed = await isGarageAuthenticated();

  if (!authed) {
    return (
      <LanguageProvider>
        <GarageLoginForm />
        <Toaster richColors position="top-center" toastOptions={{ className: "rounded-2xl" }} />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
        {children}
        <Toaster richColors position="top-center" toastOptions={{ className: "rounded-2xl" }} />
      </div>
    </LanguageProvider>
  );
}
