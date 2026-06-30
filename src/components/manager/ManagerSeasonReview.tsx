"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { getPlayerById } from "@/lib/players";
import { playSeasonComplete, playUiClick } from "@/lib/sound";

interface ManagerSeasonReviewProps {
  career: ManagerCareer;
  onContinue: () => void;
  onHome: () => void;
}

export function ManagerSeasonReview({
  career,
  onContinue,
  onHome,
}: ManagerSeasonReviewProps) {
  const summary = buildSeasonSummary(career);
  const bestPlayer = summary.bestPlayerId
    ? getPlayerById(summary.bestPlayerId)
    : null;
  const topScorer = summary.topTryScorerId
    ? getPlayerById(summary.topTryScorerId)
    : null;

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <div className={`${CARD.elevated} ${SPACING.cardPaddingLg} text-center`}>
        <p className={TYPO.sectionLabel}>Season Review</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 text-3xl font-bold text-accent-gold`}>
          {summary.position}
          {summary.position === 1
            ? "st"
            : summary.position === 2
              ? "nd"
              : summary.position === 3
                ? "rd"
                : "th"}{" "}
          Place
        </p>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackMd}`}>
        <Row label="Record" value={`${summary.wins}W - ${summary.losses}L`} />
        <Row
          label="Points"
          value={`${summary.pointsFor} for / ${summary.pointsAgainst} against`}
        />
        {bestPlayer && (
          <Row label="Best Player" value={bestPlayer.name} />
        )}
        {topScorer && (
          <Row label="Top Try Scorer" value={topScorer.name} />
        )}
        <Row label="Board Verdict" value={summary.boardVerdict} />
        <Row
          label="Budget Change"
          value={`+£${(summary.budgetChange / 1000).toFixed(0)}k`}
        />
        {summary.trophies.length > 0 && (
          <Row label="Trophies" value={summary.trophies.join(", ")} />
        )}
      </div>

      <GameButton
        variant="theme"
        onClick={() => {
          playSeasonComplete();
          playUiClick();
          onContinue();
        }}
      >
        Continue to Next Season
      </GameButton>
      <GameButton
        variant="secondary"
        onClick={() => {
          playUiClick();
          onHome();
        }}
      >
        Return Home
      </GameButton>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <span className={`${TYPO.bodySm} text-pitch-400`}>{label}</span>
      <span className={`${TYPO.bodySm} text-white`}>{value}</span>
    </div>
  );
}
