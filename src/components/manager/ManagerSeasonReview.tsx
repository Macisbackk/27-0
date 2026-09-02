"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { getOrCreateBoardSeasonEvaluation } from "@/lib/manager/boardSeasonEvaluation";
import { getSeasonSummaryTrophyLabels } from "@/lib/manager/managerSeasonTrophies";
import { getSeasonOutcomeSummary } from "@/lib/manager/seasonOutcomeHeadline";
import { ShareSeasonButton } from "@/components/ShareSeasonButton";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { useAuth } from "@/lib/auth-context";
import { getPlayerById } from "@/lib/players";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { formatWage } from "@/lib/manager/managerContracts";
import { playSeasonReviewMajor, playUiClick } from "@/lib/sound";
import {
  ManagerInfoRow,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";
import { ManagerBoostsPanel } from "@/components/manager/ManagerBoostsPanel";
import { ManagerLeagueTable } from "@/components/manager/ManagerLeagueTable";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { POSITION_SHORT } from "@/lib/positions";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";

interface ManagerSeasonReviewProps {
  career: ManagerCareer;
  onViewRewards: () => void;
  onCareerUpdate: (career: ManagerCareer) => void;
  onHome: () => void;
}

type ReviewStep =
  | "summary"
  | "table"
  | "squad"
  | "players"
  | "postseason"
  | "finish";

const REVIEW_STEPS: { id: ReviewStep; label: string; short: string }[] = [
  { id: "summary", label: "Summary", short: "Sum" },
  { id: "table", label: "Table", short: "Table" },
  { id: "squad", label: "Team", short: "Team" },
  { id: "players", label: "Players", short: "Play" },
  { id: "postseason", label: "Cup & PO", short: "Cup" },
  { id: "finish", label: "Outcome", short: "End" },
];

function toneClass(tone: string): string {
  switch (tone) {
    case "gold":
      return "text-accent-gold";
    case "primary":
      return "text-theme-primary";
    case "amber":
      return "text-amber-300";
    case "red":
      return "text-red-300";
    default:
      return "text-pitch-200";
  }
}

export function ManagerSeasonReview({
  career,
  onViewRewards,
  onCareerUpdate,
  onHome,
}: ManagerSeasonReviewProps) {
  const { isLoggedIn, loading } = useAuth();
  const [step, setStep] = useState<ReviewStep>("summary");

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

  const summary = useMemo(
    () => buildSeasonSummary(evaluatedCareer),
    [evaluatedCareer]
  );
  const outcome = useMemo(
    () => getSeasonOutcomeSummary(evaluatedCareer),
    [evaluatedCareer]
  );
  const trophies = getSeasonSummaryTrophyLabels(summary);

  const reviewSoundRef = useRef(false);
  useEffect(() => {
    if (reviewSoundRef.current) return;
    reviewSoundRef.current = true;
    playSeasonReviewMajor();
  }, []);

  const bestPlayer = summary.bestPlayerId
    ? getManagerPlayer(evaluatedCareer, summary.bestPlayerId) ??
      getPlayerById(summary.bestPlayerId)
    : null;
  const bestAvg =
    summary.bestPlayerId != null
      ? evaluatedCareer.playerSeasonStats[summary.bestPlayerId]?.averageRating
      : null;
  const topScorer = summary.topTryScorerId
    ? getManagerPlayer(evaluatedCareer, summary.topTryScorerId) ??
      getPlayerById(summary.topTryScorerId)
    : null;

  const teamSheet = useMemo(() => {
    const ids = (evaluatedCareer.matchdayXiii ?? []).filter(Boolean) as string[];
    let source = ids.length >= 10 ? ids : [];
    if (source.length === 0) {
      source = evaluatedCareer.squad
        .filter((ps) => {
          const role = evaluatedCareer.contracts[ps.playerId]?.squadRole;
          return (
            role === "key-player" ||
            role === "first-team" ||
            role === "rotation"
          );
        })
        .map((ps) => ps.playerId)
        .slice(0, 13);
    }
    if (source.length === 0) {
      source = evaluatedCareer.squad.map((ps) => ps.playerId).slice(0, 13);
    }
    return source
      .map((id) => {
        const player = getManagerPlayer(evaluatedCareer, id) ?? getPlayerById(id);
        if (!player) return null;
        const stats = evaluatedCareer.playerSeasonStats[id];
        const pos = getPlayerEligiblePositions(player)[0];
        return {
          id,
          name: player.name,
          rating: player.peakRating,
          pos: pos ? POSITION_SHORT[pos] : "—",
          apps: stats?.appearances ?? 0,
          avg: stats?.averageRating,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [evaluatedCareer]);

  const playerRows = useMemo(
    () =>
      Object.entries(evaluatedCareer.playerSeasonStats)
        .filter(([, stats]) => (stats.appearances ?? 0) > 0)
        .sort(
          ([, a], [, b]) => (b.averageRating ?? 0) - (a.averageRating ?? 0)
        )
        .slice(0, 14),
    [evaluatedCareer.playerSeasonStats]
  );

  const stepIndex = REVIEW_STEPS.findIndex((s) => s.id === step);
  const goNext = () => {
    playUiClick();
    if (stepIndex >= REVIEW_STEPS.length - 1) {
      onViewRewards();
      return;
    }
    setStep(REVIEW_STEPS[stepIndex + 1]!.id);
  };
  const goBack = () => {
    playUiClick();
    if (stepIndex <= 0) {
      onHome();
      return;
    }
    setStep(REVIEW_STEPS[stepIndex - 1]!.id);
  };

  const boardDecisionLabel =
    evaluation.finalDecision === "sack"
      ? "Board Concern"
      : evaluation.recommendation === "retain"
        ? "Board Retain"
        : "Board Review";

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackMd}`}>
      <div className="flex items-center justify-between gap-2">
        <GameButton variant="secondary" fullWidth={false} size="sm" onClick={goBack}>
          {stepIndex <= 0 ? "Home" : "Back"}
        </GameButton>
        <p className={`${TYPO.meta} text-pitch-500`}>
          {stepIndex + 1}/{REVIEW_STEPS.length}
        </p>
      </div>

      <ManagerSubTabBar
        tabs={REVIEW_STEPS.map((s) => ({
          id: s.id,
          label: s.label,
          shortLabel: s.short,
        }))}
        active={step}
        onChange={(id) => {
          playUiClick();
          setStep(id as ReviewStep);
        }}
        ariaLabel="Season review sections"
      />

      {step === "summary" && (
        <ManagerSectionCard variant="featured">
          <p className={`${TYPO.sectionLabel} text-center`}>Season Review</p>
          <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>
            {evaluatedCareer.club} · {evaluatedCareer.seasonYear}
          </h1>
          <p
            className={`mt-3 text-center text-lg font-bold sm:text-xl ${toneClass(outcome.tone)}`}
          >
            {outcome.headline}
          </p>
          <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
            {summary.seasonVerdict}
          </p>
          <div className={`mt-4 ${SPACING.stackSm}`}>
            <ManagerInfoRow
              label="Record"
              value={`${summary.wins}W · ${summary.draws ?? 0}D · ${summary.losses}L`}
              tone="primary"
            />
            <ManagerInfoRow
              label="Points for / against"
              value={`${summary.pointsFor} / ${summary.pointsAgainst}`}
              tone={summary.pointsDifference >= 0 ? "primary" : "red"}
            />
            <ManagerInfoRow
              label="Board aim"
              value={evaluatedCareer.boardExpectation}
              tone="gold"
            />
            {trophies.length > 0 ? (
              <ManagerInfoRow
                label="Silverware"
                value={trophies.join(" · ")}
                tone="gold"
              />
            ) : null}
          </div>
        </ManagerSectionCard>
      )}

      {step === "table" && (
        <ManagerSectionCard title="Final league table" accent="primary">
          <div className="mt-2">
            <ManagerLeagueTable
              career={evaluatedCareer}
              subtitle={`Season ${evaluatedCareer.seasonYear}`}
              defaultExpanded
            />
          </div>
        </ManagerSectionCard>
      )}

      {step === "squad" && (
        <ManagerSectionCard title="Team sheet" accent="primary">
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            First-team focus from your matchday squad.
          </p>
          <ul className={`mt-3 ${SPACING.stackSm}`}>
            {teamSheet.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 border-b border-pitch-800/50 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-white">
                  <span className="mr-2 text-pitch-500">{row.pos}</span>
                  {row.name}
                </span>
                <span className="shrink-0 tabular-nums text-pitch-300">
                  {row.rating}
                  {row.avg != null ? ` · ${row.avg.toFixed(1)}` : ""}
                </span>
              </li>
            ))}
            {teamSheet.length === 0 ? (
              <li className={TYPO.bodySm}>No squad data available.</li>
            ) : null}
          </ul>
        </ManagerSectionCard>
      )}

      {step === "players" && (
        <>
          <ManagerSectionCard title="Season player ratings" accent="primary">
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Average match rating — not current ability.
            </p>
            <div className="mt-2">
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
                  {playerRows.map(([playerId, stats]) => (
                    <tr
                      key={playerId}
                      className="border-b border-pitch-800/40 text-pitch-200"
                    >
                      <td className="py-1.5 pr-2 font-medium text-white">
                        {getManagerPlayer(evaluatedCareer, playerId)?.name ??
                          getPlayerById(playerId)?.name ??
                          playerId}
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
          <ManagerSectionCard title="Standouts" accent="gold">
            <div className={`mt-2 ${SPACING.stackSm}`}>
              {bestPlayer ? (
                <ManagerInfoRow
                  label="Best performer"
                  value={`${bestPlayer.name}${
                    bestAvg != null ? ` · ${bestAvg.toFixed(1)} avg` : ""
                  }`}
                  tone="gold"
                />
              ) : null}
              {topScorer ? (
                <ManagerInfoRow
                  label="Top try scorer"
                  value={`${topScorer.name} (${summary.topTryScorerTries})`}
                  tone="primary"
                />
              ) : null}
              <ManagerInfoRow
                label="Biggest win"
                value={
                  summary.biggestWin
                    ? `${summary.biggestWin.pointsFor}–${summary.biggestWin.pointsAgainst} vs ${summary.biggestWin.opponent}`
                    : "—"
                }
                tone="primary"
              />
              <ManagerInfoRow
                label="Biggest defeat"
                value={
                  summary.biggestDefeat
                    ? `${summary.biggestDefeat.pointsFor}–${summary.biggestDefeat.pointsAgainst} vs ${summary.biggestDefeat.opponent}`
                    : "—"
                }
                tone="red"
              />
            </div>
          </ManagerSectionCard>
        </>
      )}

      {step === "postseason" && (
        <>
          <ManagerSectionCard title="Challenge Cup" accent="gold">
            <div className={`mt-2 ${SPACING.stackSm}`}>
              <ManagerInfoRow
                label="Result"
                value={summary.challengeCupResult}
                tone="gold"
              />
            </div>
          </ManagerSectionCard>
          {(outcome.playoffLabel || outcome.mpgLabel) && (
            <ManagerSectionCard title="After the league" accent="primary">
              <div className={`mt-2 ${SPACING.stackSm}`}>
                {outcome.playoffLabel ? (
                  <ManagerInfoRow
                    label="Play-offs"
                    value={outcome.playoffLabel}
                    tone="amber"
                  />
                ) : null}
                {outcome.mpgLabel ? (
                  <ManagerInfoRow
                    label="Million Pound Game"
                    value={outcome.mpgLabel}
                    tone={
                      evaluatedCareer.millionPoundGame?.winner ===
                      evaluatedCareer.club
                        ? "gold"
                        : evaluatedCareer.millionPoundGame?.loser ===
                            evaluatedCareer.club
                          ? "red"
                          : "default"
                    }
                  />
                ) : null}
              </div>
            </ManagerSectionCard>
          )}
          {!outcome.playoffLabel && !outcome.mpgLabel ? (
            <ManagerSectionCard title="After the league" accent="primary">
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
                No playoff or Million Pound Game involvement this season.
              </p>
            </ManagerSectionCard>
          ) : null}
        </>
      )}

      {step === "finish" && (
        <>
          <ManagerSectionCard variant="featured">
            <p className={`${TYPO.sectionLabel} text-center`}>Final outcome</p>
            <p
              className={`mt-2 text-center text-lg font-bold ${toneClass(outcome.tone)}`}
            >
              {outcome.headline}
            </p>
            <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
              {outcome.pathwayLabel}
            </p>
            <div className={`mt-4 ${SPACING.stackSm}`}>
              <ManagerInfoRow
                label="Board"
                value={boardDecisionLabel}
                tone="primary"
              />
              <ManagerInfoRow
                label="Performance"
                value={`${evaluation.performanceScore}/100`}
                tone={
                  evaluation.performanceScore >= 70
                    ? "primary"
                    : evaluation.performanceScore >= 50
                      ? "amber"
                      : "red"
                }
              />
              <ManagerInfoRow
                label="Funds boost"
                value={`+${formatWage(summary.budgetChange)}`}
                tone="gold"
              />
            </div>
            <ul className={`mt-3 ${SPACING.stackSm}`}>
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
          </ManagerSectionCard>

          <ManagerBoostsPanel
            career={evaluatedCareer}
            stage="manager-end-season"
            onApplied={onCareerUpdate}
          />

          <ShareSeasonButton
            data={{
              title: evaluatedCareer.club,
              subtitle: `${evaluatedCareer.seasonYear} Manager season`,
              recordLine: `${summary.wins}W-${summary.draws ?? 0}D-${summary.losses}L`,
              detailLines: [
                outcome.headline,
                trophies.length > 0
                  ? `Trophies: ${trophies.join(" · ")}`
                  : "No silverware this year",
                summary.boardVerdict,
              ],
            }}
            filename={`27-0-${evaluatedCareer.club}-${evaluatedCareer.seasonYear}.png`}
          />

          {!loading && !isLoggedIn ? (
            <GuestSaveNudge context="manager-season" />
          ) : null}
        </>
      )}

      <div className={`sticky bottom-2 z-10 ${SPACING.stackSm} pb-[env(safe-area-inset-bottom)]`}>
        <GameButton variant="theme" onClick={goNext}>
          {stepIndex >= REVIEW_STEPS.length - 1
            ? "Continue to Rewards"
            : "Next"}
        </GameButton>
      </div>
    </div>
  );
}
