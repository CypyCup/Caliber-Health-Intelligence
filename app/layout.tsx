import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusBanner } from "@/components/StatusBanner";

export const metadata: Metadata = {
  title: {
    default: "Caliber Health Intelligence",
    template: "%s · Caliber Health Intelligence",
  },
  description:
    "The longitudinal workforce record of U.S. skilled nursing. Caliber Health Intelligence preserves every federal staffing, quality, financial, and ownership release as published, and joins them at the facility across time and through every change of ownership.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <StatusBanner />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
