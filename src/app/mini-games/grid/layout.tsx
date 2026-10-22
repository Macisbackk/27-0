import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rugby League Grid — 27-0",
  description: "Fill the daily 3×3 grid with Super League players who fit each club, nation and position.",
};

export default function GridLayout({ children }: { children: React.ReactNode }) {
  return children;
}
