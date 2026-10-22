import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rugby League Hangman — 27-0",
  description: "Guess the daily rugby league player name with eight lives.",
};

export default function HangmanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
