import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repair Admin — Caravan & Trailer Management",
  description: "Professional repair management system for caravan and trailer workshops",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
