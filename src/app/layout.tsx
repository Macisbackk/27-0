import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import "../styles/floodlights.css";
import { AuthProvider } from "@/lib/auth-context";
import { CoachbeardMergeRunner } from "@/components/CoachbeardMergeRunner";
import { ManagerDataPurgeRunner } from "@/components/ManagerDataPurgeRunner";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { BottomNav } from "@/components/BottomNav";
import { SoundUnlock } from "@/components/SoundUnlock";
import { UiThemeProvider } from "@/components/UiThemeProvider";
import { AchievementProvider } from "@/components/achievements/AchievementProvider";
import { CapacitorAppShell } from "@/components/CapacitorAppShell";
import { ExternalLinkGuard } from "@/components/ExternalLinkGuard";
import { PwaSetup } from "@/components/PwaSetup";
import { CosmeticsBoot } from "@/components/CosmeticsBoot";
import { UI_THEME_BOOTSTRAP_SCRIPT } from "@/lib/ui/theme-bootstrap-script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pitch",
  display: "swap",
});

export const metadata: Metadata = {
  title: "27-0 — Rugby League Manager & Squad Builder",
  description:
    "Manage a real Super League or Championship club, or build a 13 from 2026 or historic squads and chase 27-0.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "27-0",
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  applicationName: "27-0",
  openGraph: {
    title: "27-0 — Rugby League Squad Builder",
    description: "Build a 13. Go 27-0.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a110e", // match manifest theme_color
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="ui-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: UI_THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="app-shell flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-clip bg-[var(--bg-primary)]">
        <AuthProvider>
          <CapacitorAppShell />
          <ExternalLinkGuard />
          <PwaSetup />
          <CosmeticsBoot />
          <CoachbeardMergeRunner />
          <ManagerDataPurgeRunner />
          <UiThemeProvider />
          <AchievementProvider>
            <SoundUnlock />
            <Header />
            <main className="app-main flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
              {children}
            </main>
            <SiteFooter />
            <BottomNav />
          </AchievementProvider>
        </AuthProvider>
        <div id="game-portal-root" />
        <Analytics />
      </body>
    </html>
  );
}
