import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Career Stats — 27-0",
  description: "Your Classic records, trophies, squads and mini-game stats.",
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
