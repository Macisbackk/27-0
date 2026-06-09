import type { Metadata } from "next";
import { Anton } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";

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
    title: "27-0 — Super League Squad Builder",
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
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
