"use client";

import { Suspense } from "react";
import { QuizModeApp } from "@/components/quiz/QuizModeApp";

export default function MiniGamesQuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizModeApp />
    </Suspense>
  );
}
