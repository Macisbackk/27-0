import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rugby League Grid — 27-0",
  description: "Fill the daily 3×3 grid with players who fit each row and column.
===",
};

export default function GridLayout({ children }: { children: React.ReactNode }) {
  return children;
}
