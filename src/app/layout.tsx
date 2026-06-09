import type { Metadata } from "next";
import { Anton } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

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
      <body className="min-h-screen">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
