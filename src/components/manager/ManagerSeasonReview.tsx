"use client";

import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { getPlayerById } from "@/lib/players";
import { formatWage } from "@/lib/manager/managerContracts";
import { playSeasonComplete, playUiClick } from "@/lib/sound";
import {
  ManagerInfoRow,
  ManagerSectionCard,
  boardConfidenceTone,
} from "@/components/manager/manager-ui";

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

      <ManagerSectionCard variant="featured">
        <p className={`${TYPO.sectionLabel} text-center`}>Season Review</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 text-center text-3xl font-bold text-accent-gold`}>
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
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
          {summary.seasonVerdict}
        </p>
      </ManagerSectionCard>

      <ManagerSectionCard title="Season Record" accent="primary">
        <div className={`mt-2 ${SPACING.stackMd}`}>
          <ManagerInfoRow
            label="Record"
            value={`${summary.wins}W - ${summary.losses}L`}
            tone="primary"
          />
          <ManagerInfoRow
            label="Points"
            value={`${summary.pointsFor} for / ${summary.pointsAgainst} against (PD ${summary.pointsDifference > 0 ? "+" : ""}${summary.pointsDifference})`}
            tone={
              summary.pointsDifference > 0
                ? "primary"
                : summary.pointsDifference < 0
                  ? "red"
                  : "default"
            }
          />
          <ManagerInfoRow
            label="Challenge Cup"
            value={summary.challengeCupResult}
            tone="gold"
          />
          {bestPlayer && (
            <ManagerInfoRow label="Best Player" value={bestPlayer.name} tone="gold" />
          )}
          {topScorer && (
            <ManagerInfoRow
              label="Top Try Scorer"
              value={`${topScorer.name} (${summary.topTryScorerTries})`}
              tone="primary"
            />
          )}
          <ManagerInfoRow
            label="Biggest Win"
            value={
              summary.biggestWin
                ? `${summary.biggestWin.pointsFor}-${summary.biggestWin.pointsAgainst} vs ${summary.biggestWin.opponent}`
                : "—"
            }
            tone="primary"
          />
          <ManagerInfoRow
            label="Biggest Defeat"
            value={
              summary.biggestDefeat
                ? `${summary.biggestDefeat.pointsFor}-${summary.biggestDefeat.pointsAgainst} vs ${summary.biggestDefeat.opponent}`
                : "—"
            }
            tone="red"
          />
        </div>
      </ManagerSectionCard>

      <ManagerSectionCard title="Attendance" accent="sky">
        <div className={`mt-2 ${SPACING.stackMd}`}>
          <ManagerInfoRow
            label="Average"
            value={summary.averageAttendance.toLocaleString()}
            tone="sky"
          />
          <ManagerInfoRow
            label="Highest"
            value={summary.highestAttendance.toLocaleString()}
            tone="primary"
          />
          <ManagerInfoRow
            label="Lowest"
            value={
              summary.lowestAttendance > 0
                ? summary.lowestAttendance.toLocaleString()
                : "—"
            }
            tone="muted"
          />
          <ManagerInfoRow
            label="Final Fan Mood"
            value={`${summary.finalFanMood}`}
            tone={summary.finalFanMood >= 70 ? "primary" : summary.finalFanMood >= 45 ? "default" : "amber"}
          />
        </div>
      </ManagerSectionCard>

      <ManagerSectionCard title="Contracts & Board" accent={summary.expiringContracts > 0 ? "amber" : undefined}>
        <div className={`mt-2 ${SPACING.stackMd}`}>
          <ManagerInfoRow
            label="Expiring Contracts"
            value={`${summary.expiringContracts}`}
            tone={summary.expiringContracts > 0 ? "amber" : "default"}
          />
          {summary.playersLeaving.length > 0 && (
            <ManagerInfoRow
              label="Players Leaving"
              value={summary.playersLeaving.join(", ")}
              tone="red"
            />
          )}
          <ManagerInfoRow
            label="Board Confidence"
            value={`${career.boardConfidence}%`}
            tone={boardConfidenceTone(career.boardConfidence)}
          />
          <ManagerInfoRow label="Board Verdict" value={summary.boardVerdict} tone="default" />
          <ManagerInfoRow
            label="Budget Change"
            value={`+${formatWage(summary.budgetChange)}`}
            tone="gold"
          />
          {summary.trophies.length > 0 && (
            <ManagerInfoRow
              label="Trophies"
              value={summary.trophies.join(", ")}
              tone="gold"
            />
          )}
        </div>
      </ManagerSectionCard>

      <GameButton
        variant="theme"
        onClick={() => {
          playSeasonComplete();
          playUiClick();
          onViewRewards();
        }}
      >
        View Potential Review
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
