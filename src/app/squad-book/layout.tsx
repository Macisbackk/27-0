import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Squad Book — 27-0",
  description: "Every player card you've fielded. Collect sets for Club Funds.",
};

export default function SquadBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
