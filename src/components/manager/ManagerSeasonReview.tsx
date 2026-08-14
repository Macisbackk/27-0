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
import { ShareSeasonButton } from "@/components/ShareSeasonButton";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { useAuth } from "@/lib/auth-context";
import { getPlayerById } from "@/lib/players";
import { formatWage } from "@/lib/manager/managerContracts";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { playSeasonComplete, playSeasonReviewMajor, playUiClick } from "@/lib/sound";
import {
  ManagerInfoRow,
  ManagerSectionCard,
  boardConfidenceTone,
} from "@/components/manager/manager-ui";
import { ManagerBoostsPanel } from "@/components/manager/ManagerBoostsPanel";
import { isUserInChampionship, getUserLeagueClubs } from "@/lib/manager/leagueMembership";
import { getChampionshipPlayoffWinner } from "@/lib/manager/managerChampionshipPlayoffs";

interface ManagerSeasonReviewProps {
  career: ManagerCareer;
  onViewRewards: () => void;
  onCareerUpdate: (career: ManagerCareer) => void;
  onHome: () => void;
}

export function ManagerSeasonReview({
  career,
  onViewRewards,
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
    if (
      persistedRef.current === evaluation.decisionId &&
      career.boardSeasonEvaluations?.[evaluation.seasonId]?.decisionId ===
        evaluation.decisionId
    ) {
      return;
    }
    if (evaluatedCareer !== career) {
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
  const mpgWon = evaluatedCareer.millionPoundGame?.winner === evaluatedCareer.club;
  const championshipPlayoffWinner =
    getChampionshipPlayoffWinner(evaluatedCareer.championshipPlayoffs) ===
    evaluatedCareer.club;
  const trophies = getSeasonSummaryTrophyLabels(summary);
  const clubStars = getCareerClubStars(evaluatedCareer);
  const reviewSoundRef = useRef(false);
  useEffect(() => {
    if (reviewSoundRef.current) return;
    reviewSoundRef.current = true;
    playSeasonReviewMajor();
  }, []);

  const bestPlayer = summary.bestPlayerId
    ? getPlayerById(summary.bestPlayerId)
    : null;
  const topScorer = summary.topTryScorerId
    ? getPlayerById(summary.topTryScorerId)
    : null;

  const boardDecisionLabel = "Board Retain";
  const boardDecisionTone = "primary" as const;

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
        {isUserInChampionship(evaluatedCareer) ? (
          <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-200`}>
            {summary.position === 1
              ? "Championship Champions · Automatic Promotion"
              : mpgWon
                ? "Promoted to Super League"
                : championshipPlayoffWinner
                  ? "Qualified for the Million Pound Game"
                  : summary.position >= 2 && summary.position <= 5
                    ? "Championship play-offs — Million Pound Game pathway"
                  : "Championship finish"}
          </p>
        ) : evaluatedCareer.millionPoundGame?.loser === evaluatedCareer.club ? (
          <p className={`mt-2 text-center ${TYPO.bodySm} text-red-300`}>
            Million Pound Game defeat — Championship next season
          </p>
        ) : summary.position === getUserLeagueClubs(evaluatedCareer).length ? (
          <p className={`mt-2 text-center ${TYPO.bodySm} text-red-300`}>
            Automatic relegation — Championship next season
          </p>
        ) : null}
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
          {summary.seasonVerdict}
        </p>
      </ManagerSectionCard>

      <ManagerSectionCard title="Season player ratings" accent="primary">
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-700/50 text-pitch-400">
                <th className="py-1.5 pr-2 font-medium">Player</th>
                <th className="px-2 py-1.5 text-center font-medium">Apps</th>
                <th className="px-2 py-1.5 text-center font-medium">Tries</th>
                <th className="py-1.5 pl-2 text-center font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(evaluatedCareer.playerSeasonStats)
                .filter(([, stats]) => (stats.appearances ?? 0) > 0)
                .sort(
                  ([, a], [, b]) =>
                    (b.averageRating ?? 0) - (a.averageRating ?? 0)
                )
                .slice(0, 12)
                .map(([playerId, stats]) => (
                  <tr
                    key={playerId}
                    className="border-b border-pitch-800/40 text-pitch-200"
                  >
                    <td className="py-1.5 pr-2 font-medium text-white">
                      {getPlayerById(playerId)?.name ?? playerId}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      {stats.appearances}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      {stats.tries}
                    </td>
                    <td
                      className={`py-1.5 pl-2 text-center tabular-nums font-semibold ${
                        (stats.averageRating ?? 0) >= 7
                          ? "text-theme-primary"
                          : "text-white"
                      }`}
                    >
                      {stats.averageRating != null
                        ? stats.averageRating.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ManagerSectionCard>

      {isUserInChampionship(evaluatedCareer) ? (
        <ManagerSectionCard
          title="Championship Pathway"
          accent={
            (summary.position === 1 || mpgWon) ? "gold" : "primary"
          }
        >
          <div className={`mt-2 ${SPACING.stackMd}`}>
            <ManagerInfoRow
              label="Board aim"
              value={evaluatedCareer.boardExpectation}
              tone="gold"
            />
            <ManagerInfoRow
              label="Promotion"
              value={
                summary.position === 1
                  ? "Earned — Super League next"
                  : mpgWon
                    ? "Earned — Million Pound Game won"
                    : championshipPlayoffWinner
                      ? "Play-off won — Million Pound Game next"
                      : summary.position >= 2 && summary.position <= 5
                        ? "Play-off route — Million Pound Game required"
                        : "Missed — finish first or win the pathway"
              }
              tone={
                summary.position === 1 || mpgWon
                  ? "gold"
                  : summary.position >= 2 && summary.position <= 5
                    ? "amber"
                    : "red"
              }
            />
            {evaluatedCareer.championshipPlayoffs?.tournamentComplete ? (
              <ManagerInfoRow
                label="Championship play-offs"
                value={
                  getChampionshipPlayoffWinner(
                    evaluatedCareer.championshipPlayoffs
                  ) ?? "Complete"
                }
                tone="amber"
              />
            ) : null}
            {evaluatedCareer.millionPoundGame?.status === "complete" ? (
              <ManagerInfoRow
                label="Million Pound Game"
                value={`${evaluatedCareer.millionPoundGame.slClub} vs ${evaluatedCareer.millionPoundGame.champClub} — ${evaluatedCareer.millionPoundGame.winner} won`}
                tone={mpgWon ? "gold" : "default"}
              />
            ) : null}
            <p className={`${TYPO.meta} text-pitch-400`}>
              First promotes automatically. Positions 2–5 enter the Championship play-offs, with the winner facing Super League 11th in the Million Pound Game.
            </p>
          </div>
        </ManagerSectionCard>
      ) : (
        <ManagerSectionCard title="Promotion & Relegation" accent="primary">
          <div className={`mt-2 ${SPACING.stackMd}`}>
            <ManagerInfoRow
              label="League finish"
              value={`${summary.position}${summary.position === 1 ? "st" : summary.position === 2 ? "nd" : summary.position === 3 ? "rd" : "th"}`}
              tone={
                summary.position <= 6
                  ? "amber"
                  : summary.position >= 12
                    ? "red"
                    : "default"
              }
            />
            <ManagerInfoRow
              label="Play-offs"
              value={
                evaluatedCareer.playoffs?.finish ??
                (summary.position <= 6 ? "Qualified" : "Missed")
              }
              tone={
                evaluatedCareer.playoffs?.finish === "Super League Champions"
                  ? "gold"
                  : "default"
              }
            />
            <ManagerInfoRow
              label="Million Pound Game"
              value={
                evaluatedCareer.millionPoundGame?.status === "complete"
                  ? `${evaluatedCareer.millionPoundGame.winner} won (${evaluatedCareer.millionPoundGame.slClub} vs ${evaluatedCareer.millionPoundGame.champClub})`
                  : summary.position === 11
                    ? "Entered as Super League 11th"
                    : "Not involved"
              }
              tone={
                evaluatedCareer.millionPoundGame?.winner === evaluatedCareer.club
                  ? "gold"
                  : summary.position === 11
                    ? "amber"
                    : "default"
              }
            />
            <ManagerInfoRow
              label="Relegation"
              value={
                summary.position >= 12
                  ? "Automatically relegated"
                  : evaluatedCareer.millionPoundGame?.loser ===
                      evaluatedCareer.club
                    ? "Relegated via Million Pound Game"
                    : "Safe"
              }
              tone={
                summary.position >= 12 ||
                evaluatedCareer.millionPoundGame?.loser === evaluatedCareer.club
                  ? "red"
                  : "primary"
              }
            />
          </div>
        </ManagerSectionCard>
      )}

      <ManagerSectionCard title="Board Decision" accent="primary">
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
            value={`${clubStars}-star · ${formatSquadRatingStars(
              clubStars,
              isUserInChampionship(evaluatedCareer)
                ? "championship"
                : "super-league"
            )}`}
            tone="gold"
          />
          <ManagerInfoRow label="Board Verdict" value={summary.boardVerdict} tone="default" />
          <ManagerInfoRow
            label="Club Funds (on continue)"
            value={`+${formatWage(summary.budgetChange)}`}
            tone="gold"
          />
          {trophies.length > 0 && (
            <ManagerInfoRow
              label="Trophies"
              value={trophies.join(", ")}
              tone="gold"
            />
          )}
        </div>
      </ManagerSectionCard>

      <ManagerBoostsPanel
        career={evaluatedCareer}
        stage="manager-end-season"
        onApplied={onCareerUpdate}
      />

      <ManagerSeasonRecapCard
        club={evaluatedCareer.club}
        seasonYear={evaluatedCareer.seasonYear}
        summary={summary}
      />

      <ShareSeasonButton
        data={{
          title: evaluatedCareer.club,
          subtitle: `${evaluatedCareer.seasonYear} Manager season`,
          recordLine: `${summary.wins}W-${summary.draws ?? 0}D-${summary.losses}L`,
          detailLines: [
            `Finished ${summary.position}${
              summary.position === 1
                ? "st"
                : summary.position === 2
                  ? "nd"
                  : summary.position === 3
                    ? "rd"
                    : "th"
            }`,
            trophies.length > 0
              ? `Trophies: ${trophies.join(" · ")}`
              : "No silverware this year",
            summary.boardVerdict,
          ],
        }}
        filename={`27-0-${evaluatedCareer.club}-${evaluatedCareer.seasonYear}.png`}
      />

      {!loading && !isLoggedIn && (
        <GuestSaveNudge context="manager-season" />
      )}

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
