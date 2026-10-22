import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Higher or Lower — 27-0",
  description: "Call five rugby league player ratings in a row.",
};

export default function HigherLowerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
