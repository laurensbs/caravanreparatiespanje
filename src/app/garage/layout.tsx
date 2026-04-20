import { Suspense } from "react";
import { LanguageProvider } from "@/components/garage/language-toggle";
import { GarageThemeProvider } from "@/components/garage/theme-provider";
import { Toaster } from "sonner";
import { sonnerToastOptions } from "@/lib/sonner-toast-options";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { GarageLoginForm } from "@/components/garage/login-form";
import { GarageIdleLock } from "@/components/garage/idle-lock";
import { RouteProgress } from "@/components/layout/route-progress";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import "./garage-theme.css";

export const metadata = {
  title: "Garage — Caravan Repairs",
  manifest: "/garage-manifest.json",
  icons: {
    // Donkere afgeronde vierkant-versie van het caravan-logo, zodat
    // het icoon zowel op licht als donker tab-achtergrond zichtbaar
    // is. Het oorspronkelijke /favicon.png is zwart-op-wit en
    // verdween op donkere Chrome-tabs.
    icon: [
      { url: "/favicon-tab-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-tab-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-tab-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-tab-32.png", type: "image/png" }],
    apple: [{ url: "/favicon-tab-180.png", sizes: "180x180", type: "image/png" }],
  },
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
        <GarageThemeProvider>
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
        </GarageThemeProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <GarageThemeProvider>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
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
        <ConfirmDialogHost />
      </GarageThemeProvider>
    </LanguageProvider>
  );
}
