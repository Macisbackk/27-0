"use client";

import { formatClubFundsExact } from "@/lib/club-funds";
import {
  isSafeQuestionNumber,
  QUIZ_PRIZE_LADDER,
} from "@/lib/quiz/prizes";

type QuizPrizeLadderProps = {
  questionNumber: number;
  /** Compact list for the mobile disclosure. */
  compact?: boolean;
  className?: string;
};

export function QuizPrizeLadder({
  questionNumber,
  compact = false,
  className = "",
}: QuizPrizeLadderProps) {
  const rows = [...QUIZ_PRIZE_LADDER]
    .map((amount, index) => {
      const number = index + 1;
      const current = number === questionNumber;
      const cleared = number < questionNumber;
      const safe = isSafeQuestionNumber(number);
      const final = number === QUIZ_PRIZE_LADDER.length;
      return { amount, number, current, cleared, safe, final };
    })
    .reverse();

  return (
    <div
      className={`quiz-ladder ${compact ? "quiz-ladder--compact" : ""} ${className}`.trim()}
      aria-label="Prize ladder"
    >
      {!compact && (
        <div className="quiz-ladder__header">
          <p className="quiz-ladder__title">Prize ladder</p>
          <p className="quiz-ladder__subtitle">Q{questionNumber} of 15</p>
        </div>
      )}
      <ol className="quiz-ladder__list">
        {rows.map((row) => (
          <li
            key={row.amount}
            className={[
              "quiz-ladder__item",
              row.current ? "quiz-ladder__item--current" : "",
              row.cleared ? "quiz-ladder__item--cleared" : "",
              row.safe ? "quiz-ladder__item--safe" : "",
              row.final ? "quiz-ladder__item--final" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={row.current ? "step" : undefined}
          >
            <span className="quiz-ladder__meta">
              <span className="quiz-ladder__number">{row.number}</span>
              {row.safe ? (
                <span className="quiz-ladder__badge">Safe</span>
              ) : null}
              {row.final ? (
                <span className="quiz-ladder__badge quiz-ladder__badge--final">
                  Final
                </span>
              ) : null}
            </span>
            <span className="quiz-ladder__amount tabular-nums">
              {formatClubFundsExact(row.amount)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
