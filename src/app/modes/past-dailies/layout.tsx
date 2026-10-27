import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Past Dailies — 27-0",
  description: "Replay the last 30 Dailies as practice.",
};

export default function PastDailiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
