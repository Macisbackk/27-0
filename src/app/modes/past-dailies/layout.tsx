import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Past Dailies — 27-0",
  description: "Replay any of the last 30 Daily Challenges as practice: same rule, same spins.",
};

export default function PastDailiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
