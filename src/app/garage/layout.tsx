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
  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
        {children}
        <Toaster richColors position="top-center" toastOptions={{ className: "rounded-2xl" }} />
      </div>
    </LanguageProvider>
  );
}
