import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rugby League Wordle — 27-0",
  description: "Guess the daily rugby league player from club, position, age and more.",
};

export default function WordleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
