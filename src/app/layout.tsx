import type { Metadata, Viewport } from "next";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import "../styles/floodlights.css";
import "../styles/motion.css";
import "../styles/matchnight.css";
import "../styles/pitch.css";
import { AuthProvider } from "@/lib/auth-context";
import { CoachbeardMergeRunner } from "@/components/CoachbeardMergeRunner";
import { ManagerDataPurgeRunner } from "@/components/ManagerDataPurgeRunner";
import { LoginWelcomePopup } from "@/components/LoginWelcomePopup";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { BottomNav } from "@/components/BottomNav";
import { SoundUnlock } from "@/components/SoundUnlock";
import { UiThemeProvider } from "@/components/UiThemeProvider";
import { AchievementProvider } from "@/components/achievements/AchievementProvider";
import { CapacitorAppShell } from "@/components/CapacitorAppShell";
import { ExternalLinkGuard } from "@/components/ExternalLinkGuard";
import { PwaSetup } from "@/components/PwaSetup";
import { MotionProvider } from "@/components/MotionProvider";
import { UI_THEME_BOOTSTRAP_SCRIPT } from "@/lib/ui/theme-bootstrap-script";
import { IS_APP_BUILD, NATIVE_CLASS_BOOTSTRAP_SCRIPT } from "@/lib/native/platform";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ToastHost } from "@/components/ui/ToastHost";
import { RouteSlot } from "@/components/RouteSlot";

// Matchnight type: Barlow for reading (road-sign grotesque, northern-England plain speaking),
// Barlow Condensed for headings and kit-tag labels, Anton kept for scores and the scoreboard mark.
const barlow = Barlow({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-condensed",
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
  themeColor: "#0e0f10", // match manifest theme_color
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="ui-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: UI_THEME_BOOTSTRAP_SCRIPT }}
        />
        {IS_APP_BUILD ? (
          <Script
            id="native-shell-bootstrap"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: NATIVE_CLASS_BOOTSTRAP_SCRIPT }}
          />
        ) : null}
      </head>
      <body className="app-shell flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-clip bg-[var(--bg-primary)]">
        <AuthProvider>
          <CapacitorAppShell />
          <ExternalLinkGuard />
          {IS_APP_BUILD ? <OfflineBanner /> : null}
          <PwaSetup />
          <CoachbeardMergeRunner />
          <ManagerDataPurgeRunner />
          <UiThemeProvider />
          <AchievementProvider>
            <MotionProvider>
            <SoundUnlock />
            <LoginWelcomePopup />
            <Header />
            <main className="app-main flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
              {/* Never put {children} straight inside <main>: see RouteSlot (React error #418). */}
              <RouteSlot>{children}</RouteSlot>
            </main>
            <SiteFooter />
            <BottomNav />
            <ToastHost />
            </MotionProvider>
          </AchievementProvider>
        </AuthProvider>
        <div id="game-portal-root" />
        {/* Web analytics are website-only: the store apps don't record page views. */}
        {IS_APP_BUILD ? null : <Analytics />}
      </body>
    </html>
  );
}
