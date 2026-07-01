"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { getPlayerById } from "@/lib/players";
import { formatWage } from "@/lib/manager/managerContracts";
import { playSeasonComplete, playUiClick } from "@/lib/sound";

interface ManagerSeasonReviewProps {
  career: ManagerCareer;
  onViewRewards: () => void;
  onHome: () => void;
}

export function ManagerSeasonReview({
  career,
  onViewRewards,
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
      <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onHome}>
        Return Home
      </GameButton>

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
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
          {summary.seasonVerdict}
        </p>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackMd}`}>
        <Row label="Record" value={`${summary.wins}W - ${summary.losses}L`} />
        <Row
          label="Points"
          value={`${summary.pointsFor} for / ${summary.pointsAgainst} against (PD ${summary.pointsDifference > 0 ? "+" : ""}${summary.pointsDifference})`}
        />
        <Row label="Challenge Cup" value={summary.challengeCupResult} />
        {bestPlayer && <Row label="Best Player" value={bestPlayer.name} />}
        {topScorer && <Row label="Top Try Scorer" value={topScorer.name} />}
        <Row
          label="Biggest Win"
          value={summary.biggestWin > 0 ? `+${summary.biggestWin}` : "—"}
        />
        <Row
          label="Biggest Defeat"
          value={summary.biggestDefeat < 0 ? `${summary.biggestDefeat}` : "—"}
        />
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackMd}`}>
        <p className={TYPO.sectionLabel}>Attendance</p>
        <Row
          label="Average"
          value={summary.averageAttendance.toLocaleString()}
        />
        <Row
          label="Highest"
          value={summary.highestAttendance.toLocaleString()}
        />
        <Row
          label="Lowest"
          value={
            summary.lowestAttendance > 0
              ? summary.lowestAttendance.toLocaleString()
              : "—"
          }
        />
        <Row label="Final Fan Mood" value={`${summary.finalFanMood}`} />
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackMd}`}>
        <p className={TYPO.sectionLabel}>Contracts & Board</p>
        <Row
          label="Expiring Contracts"
          value={`${summary.expiringContracts}`}
        />
        {summary.playersLeaving.length > 0 && (
          <Row
            label="Players Leaving"
            value={summary.playersLeaving.join(", ")}
          />
        )}
        <Row label="Board Confidence" value={`${career.boardConfidence}%`} />
        <Row label="Board Verdict" value={summary.boardVerdict} />
        <Row
          label="Budget Change"
          value={`+${formatWage(summary.budgetChange)}`}
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
          onViewRewards();
        }}
      >
        View End of Season Rewards
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
