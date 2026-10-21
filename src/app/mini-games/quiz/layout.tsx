import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super League Millionaire — 27-0",
  description: "15 rugby league questions, four lifelines and a £1,000,000 Club Funds top prize.",
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
