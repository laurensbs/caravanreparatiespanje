import { Suspense } from "react";
import { LanguageProvider } from "@/components/garage/language-toggle";
import { Toaster } from "sonner";
import { sonnerToastOptions } from "@/lib/sonner-toast-options";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { GarageLoginForm } from "@/components/garage/login-form";
import { GarageIdleLock } from "@/components/garage/idle-lock";
import { RouteProgress } from "@/components/layout/route-progress";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";

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
        <Toaster
          theme="light"
          position="top-center"
          offset={{ top: "0.75rem" }}
          closeButton
          duration={4500}
          visibleToasts={4}
          gap={10}
          toastOptions={sonnerToastOptions}
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <div className="flex min-h-screen flex-col bg-gray-950">
        <GarageIdleLock />
        {children}
        <Toaster
          theme="light"
          position="top-center"
          offset={{ top: "0.75rem" }}
          closeButton
          duration={4500}
          visibleToasts={4}
          gap={10}
          toastOptions={sonnerToastOptions}
        />
      </div>
      <ConfirmDialogHost />
    </LanguageProvider>
  );
}
