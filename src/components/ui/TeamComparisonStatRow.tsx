"use client";

import { memo } from "react";
import type { CompareEdge } from "@/lib/validation/compare-edge";
import { STAT_HIGHLIGHT } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface TeamComparisonStatRowProps {
  label: string;
  value: string;
  align: "left" | "right";
  edge?: CompareEdge;
  side: "left" | "right";
  truncate?: boolean;
}

export const TeamComparisonStatRow = memo(function TeamComparisonStatRow({
  label,
  value,
  align,
  edge,
  side,
  truncate,
}: TeamComparisonStatRowProps) {
  const isRight = align === "right";
  const isWinner = edge !== "tie" && edge === side;
  const isTie = edge === "tie";

  const valueClass = isWinner
    ? STAT_HIGHLIGHT.win
    : isTie
      ? STAT_HIGHLIGHT.tie
      : STAT_HIGHLIGHT.neutral;

  return (
    <div
      className={`flex flex-col gap-0.5 border-b border-pitch-800/60 pb-2 last:border-0 last:pb-0 sm:gap-2 ${
        isRight
          ? "sm:flex-row-reverse sm:items-baseline sm:justify-between"
          : "sm:flex-row sm:items-baseline sm:justify-between"
      }`}
    >
      <dt className={`shrink-0 ${TYPO.statLabel}`}>{label}</dt>
      <dd
        className={`font-display text-xs font-bold sm:text-sm ${valueClass} ${
          isWinner ? STAT_HIGHLIGHT.winGlow : ""
        } ${truncate ? "truncate" : ""} ${isRight ? "sm:text-right" : "sm:text-left"}`}
      >
        {isWinner && (
          <span className="mr-1 text-accent-green" aria-hidden>
            ✓
          </span>
        )}
        {value}
      </dd>
    </div>
  );
});
