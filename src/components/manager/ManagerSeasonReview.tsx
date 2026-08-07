"use client";

import { useEffect, useMemo, useRef } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { getOrCreateBoardSeasonEvaluation } from "@/lib/manager/boardSeasonEvaluation";
import { getSeasonSummaryTrophyLabels } from "@/lib/manager/managerSeasonTrophies";
import { ManagerSeasonRecapCard } from "@/components/manager/ManagerSeasonRecapCard";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { useAuth } from "@/lib/auth-context";
import { getPlayerById } from "@/lib/players";
import { formatWage } from "@/lib/manager/managerContracts";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { playSeasonComplete, playUiClick, playManagerSacked } from "@/lib/sound";
import {
  ManagerInfoRow,
  ManagerSectionCard,
  boardConfidenceTone,
} from "@/components/manager/manager-ui";
import { ManagerBoostsPanel } from "@/components/manager/ManagerBoostsPanel";

interface ManagerSeasonReviewProps {
  career: ManagerCareer;
  onViewRewards: () => void;
  onChooseNextClub: () => void;
  onCareerUpdate: (career: ManagerCareer) => void;
  onHome: () => void;
}

export function ManagerSeasonReview({
  career,
  onViewRewards,
  onChooseNextClub,
  onCareerUpdate,
  onHome,
}: ManagerSeasonReviewProps) {
  const { isLoggedIn, loading } = useAuth();

  const { evaluation, career: evaluatedCareer } = useMemo(() => {
    const result = getOrCreateBoardSeasonEvaluation(career);
    return { evaluation: result.evaluation, career: result.career };
  }, [career]);

  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistedRef.current === evaluation.decisionId) return;
    if (
      !career.boardSeasonEvaluations?.[evaluation.seasonId] &&
      evaluatedCareer !== career
    ) {
      persistedRef.current = evaluation.decisionId;
      onCareerUpdate(evaluatedCareer);
    }
  }, [
    career,
    evaluatedCareer,
    evaluation.decisionId,
    evaluation.seasonId,
    onCareerUpdate,
  ]);

  const summary = buildSeasonSummary(evaluatedCareer);
  const trophies = getSeasonSummaryTrophyLabels(summary);
  const clubStars = getCareerClubStars(evaluatedCareer);
  const sacked = evaluation.finalDecision === "sack";
  const sackSoundRef = useRef(false);
  useEffect(() => {
    if (!sacked || sackSoundRef.current) return;
    sackSoundRef.current = true;
    playManagerSacked();
  }, [sacked]);

  const bestPlayer = summary.bestPlayerId
    ? getPlayerById(summary.bestPlayerId)
    : null;
  const topScorer = summary.topTryScorerId
    ? getPlayerById(summary.topTryScorerId)
    : null;

  const boardDecisionLabel =
    evaluation.finalDecision === "retain" ? "Board Retain" : "Board Sack";
  const boardDecisionTone =
    evaluation.finalDecision === "retain" ? "primary" : "red";

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onHome}>
        Return Home
      </GameButton>

      <ManagerSectionCard variant="featured">
        <p className={`${TYPO.sectionLabel} text-center`}>Season Review</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>
          {evaluatedCareer.club} · {evaluatedCareer.seasonYear}
        </h1>
        <p className={`mt-2 text-center text-2xl font-bold text-accent-gold sm:text-3xl`}>
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

      <ManagerSectionCard title="Board Decision" accent={sacked ? "red" : "primary"}>
        <div className={`mt-2 ${SPACING.stackMd}`}>
          <ManagerInfoRow
            label="Decision"
            value={boardDecisionLabel}
            tone={boardDecisionTone}
          />
          <ManagerInfoRow
            label="Performance score"
            value={`${evaluation.performanceScore}/100`}
            tone={evaluation.performanceScore >= 70 ? "primary" : evaluation.performanceScore >= 50 ? "amber" : "red"}
          />
          {evaluation.protectedByNoSacking && (
            <ManagerInfoRow
              label="Protection"
              value="Sacking Protection Active"
              tone="gold"
            />
          )}
          <ul className={`${SPACING.stackSm} text-sm text-pitch-300`}>
            {evaluation.explanation.map((line) => (
              <li key={line} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
          <div className="border-t border-pitch-700/40 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-pitch-500">
              Objectives
            </p>
            <ul className={`mt-2 ${SPACING.stackSm}`}>
              {evaluation.objectiveResults.map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-pitch-200">{obj.label}</span>
                  <span
                    className={
                      obj.status === "achieved"
                        ? "text-theme-primary"
                        : obj.status === "partial"
                          ? "text-amber-400"
                          : obj.status === "na"
                            ? "text-pitch-500"
                            : "text-red-400"
                    }
                  >
                    {obj.status === "na" ? "N/A" : obj.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ManagerSectionCard>

      <ManagerSectionCard title="Season Record" accent="primary">
        <div className={`mt-2 ${SPACING.stackMd}`}>
          <ManagerInfoRow
            label="Record"
            value={`${summary.wins}W - ${summary.draws ?? 0}D - ${summary.losses}L`}
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
            value={`${evaluatedCareer.boardConfidence}%`}
            tone={boardConfidenceTone(evaluatedCareer.boardConfidence)}
          />
          <ManagerInfoRow
            label="Club Status"
            value={`${clubStars}-star · ${formatSquadRatingStars(clubStars)}`}
            tone="gold"
          />
          <ManagerInfoRow label="Board Verdict" value={summary.boardVerdict} tone="default" />
          {!sacked && (
            <ManagerInfoRow
              label="Club Funds (on continue)"
              value={`+${formatWage(summary.budgetChange)}`}
              tone="gold"
            />
          )}
          {trophies.length > 0 && (
            <ManagerInfoRow
              label="Trophies"
              value={trophies.join(", ")}
              tone="gold"
            />
          )}
        </div>
      </ManagerSectionCard>

      {!evaluatedCareer.managerProtection?.noSacking && (
        <ManagerBoostsPanel
          career={evaluatedCareer}
          stage="manager-end-season"
          onApplied={onCareerUpdate}
        />
      )}

      {evaluatedCareer.managerProtection?.noSacking && (
        <ManagerSectionCard accent="gold">
          <p className="text-sm text-accent-gold">
            Sacking Protection Active — board expectations and confidence still apply,
            but you cannot be dismissed.
          </p>
        </ManagerSectionCard>
      )}

      <ManagerSeasonRecapCard
        club={evaluatedCareer.club}
        seasonYear={evaluatedCareer.seasonYear}
        summary={summary}
      />

      {!loading && !isLoggedIn && (
        <GuestSaveNudge context="manager-season" />
      )}

      {sacked ? (
        <GameButton
          variant="theme"
          onClick={() => {
            playUiClick();
            onChooseNextClub();
          }}
        >
          Choose Next Club
        </GameButton>
      ) : (
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
      )}
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
