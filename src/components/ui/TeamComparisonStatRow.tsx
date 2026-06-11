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

function getSideHighlight(side: "left" | "right", edge: CompareEdge | undefined) {
  const isWinner = edge !== "tie" && edge !== undefined && edge === side;
  const isTie = edge === "tie" || edge === undefined;

  if (isTie) {
    return {
      valueClass: STAT_HIGHLIGHT.tie,
      glowClass: "",
    };
  }

  if (isWinner) {
    if (side === "left") {
      return {
        valueClass: STAT_HIGHLIGHT.win,
        glowClass: STAT_HIGHLIGHT.winGlow,
      };
    }
    return {
      valueClass: "text-accent-red",
      glowClass: "shadow-[0_0_8px_rgba(239,68,68,0.25)]",
    };
  }

  return {
    valueClass: STAT_HIGHLIGHT.neutral,
    glowClass: "",
  };
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
  const { valueClass, glowClass } = getSideHighlight(side, edge);
  const isWinner = edge !== "tie" && edge !== undefined && edge === side;

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
        className={`font-display text-xs font-bold sm:text-sm ${valueClass} ${glowClass} ${
          truncate ? "truncate" : ""
        } ${isRight ? "sm:text-right" : "sm:text-left"}`}
      >
        {isWinner && side === "left" && (
          <span className="mr-1 text-accent-green" aria-hidden>
            ✓
          </span>
        )}
        {isWinner && side === "right" && (
          <span className="mr-1 text-accent-red" aria-hidden>
            ✓
          </span>
        )}
        {value}
      </dd>
    </div>
  );
});

interface MobileComparisonStatRowProps {
  label: string;
  userValue: string;
  opponentValue: string;
  edge?: CompareEdge;
}

export const MobileComparisonStatRow = memo(function MobileComparisonStatRow({
  label,
  userValue,
  opponentValue,
  edge,
}: MobileComparisonStatRowProps) {
  const userHighlight = getSideHighlight("left", edge);
  const oppHighlight = getSideHighlight("right", edge);

  return (
    <div className="rounded-lg border border-pitch-700/50 bg-pitch-950/50 px-4 py-3 text-center">
      <p
        className={`font-display text-lg font-black leading-none ${userHighlight.valueClass} ${userHighlight.glowClass}`}
      >
        {userValue}
      </p>
      <p className={`my-2 ${TYPO.statLabel}`}>{label}</p>
      <p
        className={`font-display text-lg font-black leading-none ${oppHighlight.valueClass} ${oppHighlight.glowClass}`}
      >
        {opponentValue}
      </p>
    </div>
  );
});
