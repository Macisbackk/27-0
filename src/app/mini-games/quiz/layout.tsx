import type { Metadata } from "next";
import { QUIZ_TOP_PRIZE } from "@/lib/quiz/prizes";

export const metadata: Metadata = {
  title: "Super League Millionaire — 27-0",
  description: `15 rugby league questions, four lifelines and a £${QUIZ_TOP_PRIZE.toLocaleString("en-GB")} Club Funds top prize.`,
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
