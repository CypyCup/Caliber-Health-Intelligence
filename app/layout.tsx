import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DemoDataBanner } from "@/components/DemoDataBanner";

export const metadata: Metadata = {
  title: {
    default: "Caliber Workforce Atlas",
    template: "%s · Caliber Workforce Atlas",
  },
  description:
    "The free, public-data workforce intelligence surface for U.S. skilled nursing facilities — from Caliber Health Intelligence. Every metric, with its vintage. Trends CMS Care Compare doesn't show.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <DemoDataBanner />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
