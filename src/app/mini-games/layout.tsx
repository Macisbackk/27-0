import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mini Games — 27-0",
  description: "Super League Millionaire, Rugby League Wordle, Hangman and Higher or Lower. Daily rewards pay Club Funds.",
};

export default function MiniGamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
