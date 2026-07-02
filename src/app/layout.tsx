import type { Metadata } from "next";
import { Anton } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CoachbeardMergeRunner } from "@/components/CoachbeardMergeRunner";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SoundUnlock } from "@/components/SoundUnlock";
import { UiThemeProvider } from "@/components/UiThemeProvider";
import { UI_THEME_BOOTSTRAP_SCRIPT } from "@/lib/ui/theme-bootstrap-script";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pitch",
  display: "swap",
});

export const metadata: Metadata = {
  title: "27-0 — Build Your Super League Dream Team",
  description:
    "Build the most valuable Super League rugby team from random player offers. Sign or skip — every decision matters.",
  openGraph: {
    title: "27-0 — Rugby League Squad Builder",
    description: "Can you build the ultimate Super League starting XIII?",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={anton.variable} suppressHydrationWarning>
      <head>
        <Script
          id="ui-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: UI_THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <CoachbeardMergeRunner />
          <UiThemeProvider />
          <SoundUnlock />
          <Header />
          <main className="app-main flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
