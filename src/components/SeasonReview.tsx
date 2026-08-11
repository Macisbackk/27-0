"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameDifficulty, GameMode, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { getSeasonSummaryMessage } from "@/lib/game/season-simulation";
import { SquadReviewSection } from "./SquadReviewSection";
import { generateSeasonAwards } from "@/lib/season-awards";
import {
  getSeasonGradeFromSquad,
  getSeasonReviewStoryBio,
  getSeasonStoryHeading,
} from "@/lib/grades";
import { getSeasonReviewLabel } from "@/lib/mode-labels";
import { getSquadValue } from "@/lib/positions";
import { formatValue } from "@/lib/players";
import { getSeasonTryTotal } from "@/lib/game/season-tries";
import { formatSeasonWinPercentageOrDash } from "@/lib/stats-views";
import { playGradeSound, playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { MatchReviewActions } from "./MatchReviewActions";
import { ShareSeasonButton } from "./ShareSeasonButton";
import { GameButton } from "./ui/GameButton";
import { ClubFundsEarned } from "./ClubFundsEarned";
import { FixtureResultRow } from "./FixtureResultRow";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { Confetti } from "./Confetti";
import { ReviewSubmissionNotice } from "./ReviewSubmissionNotice";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { buildLeagueTable } from "@/lib/game/league-table";
import { userQualifiedForPlayoffs } from "@/lib/game/playoff-simulation";
import { formatRecordWithPercentage } from "@/lib/lifetime-stats";
import { LeagueTable } from "./LeagueTable";
import { runSeasonReviewValidation } from "@/lib/validation/season-review-validation";
import { NORMAL } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { useAuth } from "@/lib/auth-context";
import { DocumentPageShell } from "@/components/ui/DocumentPageShell";
import { clearStaleBodyScrollLocks } from "@/lib/ui/document-page-scroll";
import { resolveSquadClubColorOverride } from "@/lib/players/squad-club-accent";
import type { DailyChallengeScenario } from "@/lib/daily-challenge";
import {
  getDailyChallengeDateKey,
  getDailyChallengeProgress,
  getDailyChallengeStreak,
} from "@/lib/daily-challenge";

interface SeasonReviewProps {
  squad: SquadSlot[];
  mode: GameMode;
  seasonResult: SeasonResult;
  seed: string;
  difficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  normalEraMode?: boolean;
  dailyChallengeMode?: boolean;
  dailyScenario?: DailyChallengeScenario | null;
  runRank?: number;
  submittedOnline?: boolean;
  boostedRun?: boolean;
  clubFundsPayout?: ClubFundsPayoutResult | null;
  onContinuePlayoffs?: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  onFinalizeSeason?: () => void;
  onReturnHome?: () => void;
}

export function SeasonReview({
  squad,
  mode,
  seasonResult,
  seed,
  difficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  normalEraMode = false,
  dailyChallengeMode = false,
  dailyScenario = null,
  runRank,
  submittedOnline = false,
  boostedRun = false,
  clubFundsPayout = null,
  onContinuePlayoffs,
  onPlayAgain,
  onClose,
  onFinalizeSeason,
  onReturnHome,
}: SeasonReviewProps) {
  const { isLoggedIn, loading } = useAuth();
  const totalValue = getSquadValue(squad);
  const leagueTable = useMemo(
    () => buildLeagueTable(seasonResult, seed),
    [seasonResult, seed]
  );
  const dreamTeamTablePosition =
    leagueTable.find((row) => row.isUserTeam)?.position ??
    seasonResult.leaguePosition;
  const seasonResultForReview = useMemo(
    () =>
      dreamTeamTablePosition === seasonResult.leaguePosition
        ? seasonResult
        : { ...seasonResult, leaguePosition: dreamTeamTablePosition },
    [seasonResult, dreamTeamTablePosition]
  );
  const gradeInfo = getSeasonGradeFromSquad(
    squad,
    seasonResultForReview,
    totalValue
  );
  const awards = useMemo(
    () =>
      generateSeasonAwards(squad, seasonResult, {
        joeMellorMode,
        superSamHallasMode,
      }),
    [squad, seasonResult, joeMellorMode, superSamHallasMode]
  );
  const playerAwards = useMemo(
    () =>
      awards.filter(
        (award) =>
          award.title !== "Top 3 Try Scorers" &&
          award.title !== "Top Try Scorers"
      ),
    [awards]
  );
  const isPerfect = seasonResult.isPerfect;
  const isSuperSquad = gradeInfo.grade === "S" || gradeInfo.grade === "S+";
  const isSpecialMode = joeMellorMode || superSamHallasMode;
  const reviewLabel = superSamHallasMode
    ? "Super Sam Hallas Mode Season Review"
    : joeMellorMode
      ? "Joe Mellor GOAT Mode Season Review"
      : getSeasonReviewLabel(mode, "NORMAL", normalEraMode);
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(
    null
  );
  const selectedRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFixture && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto",
      });
    }
  }, [selectedFixture]);
  const showCelebration = isPerfect || isSuperSquad;
  const dreamTeamColorClub = useMemo(
    () => resolveSquadClubColorOverride(squad),
    [squad]
  );

  const handlePlayAgain = () => {
    onFinalizeSeason?.();
    onClose();
    onPlayAgain();
  };

  const gradeSoundPlayed = useRef(false);
  useEffect(() => {
    if (gradeSoundPlayed.current) return;
    gradeSoundPlayed.current = true;
    playGradeSound(gradeInfo.grade);
  }, [gradeInfo.grade]);

  const seasonFinalizedRef = useRef(false);
  useEffect(() => {
    if (seasonFinalizedRef.current) return;
    seasonFinalizedRef.current = true;
    onFinalizeSeason?.();
  }, [onFinalizeSeason]);

  useEffect(() => {
    clearStaleBodyScrollLocks();
  }, []);

  const leaguePositionLabel = formatLeaguePosition(dreamTeamTablePosition);
  const summaryMessage = getSeasonSummaryMessage(
    dreamTeamTablePosition,
    seasonResult.losses,
    seasonResult.wins,
    gradeInfo.grade,
    seasonResultForReview
  );
  const expectedTries = getSeasonTryTotal(seasonResult.fixtures);

  const qualifiedForPlayoffs = userQualifiedForPlayoffs(dreamTeamTablePosition);
  const showPlayoffPrompt =
    qualifiedForPlayoffs &&
    mode === "CLASSIC" &&
    !joeMellorMode &&
    !superSamHallasMode;
  const missedPlayoffs =
    !qualifiedForPlayoffs &&
    mode === "CLASSIC" &&
    !joeMellorMode &&
    !superSamHallasMode;

  const hideEndOfRunNav = showPlayoffPrompt;

  const shareCardData = useMemo(() => {
    if (dailyChallengeMode && dailyScenario) {
      const progress = getDailyChallengeProgress();
      const streak = getDailyChallengeStreak();
      const detailLines = [
        `${dailyScenario.eraMode ? "Era" : "Current"} · ${getDailyChallengeDateKey()}`,
        formatRecordWithPercentage(seasonResult.wins, seasonResult.losses),
        progress.leagueLeaders ? "League Leaders" : `League position ${leaguePositionLabel}`,
        progress.playoffTitle ? "Champions" : undefined,
        streak > 0 ? `Streak ${streak}` : undefined,
      ].filter((line): line is string => Boolean(line));

      return {
        title: `Daily · All ${dailyScenario.forceOpponentClub}`,
        subtitle: dailyScenario.eraMode ? "Era Daily Challenge" : "Daily Challenge",
        recordLine: formatRecordWithPercentage(
          seasonResult.wins,
          seasonResult.losses
        ),
        detailLines,
      };
    }

    return {
      title: `Grade ${gradeInfo.grade}`,
      subtitle: reviewLabel,
      recordLine: formatRecordWithPercentage(
        seasonResult.wins,
        seasonResult.losses
      ),
      detailLines: [
        `League position ${leaguePositionLabel}`,
        `Team value ${formatValue(totalValue)}`,
        summaryMessage,
      ].filter(Boolean),
    };
  }, [
    dailyChallengeMode,
    dailyScenario,
    gradeInfo.grade,
    reviewLabel,
    seasonResult.wins,
    seasonResult.losses,
    leaguePositionLabel,
    totalValue,
    summaryMessage,
  ]);

  const shareAction = (
    <ShareSeasonButton
      data={shareCardData}
      filename={
        dailyChallengeMode ? "27-0-daily.png" : "27-0-quick-season.png"
      }
    />
  );

  useEffect(() => {
    runSeasonReviewValidation({
      squad,
      seasonResult,
      seed,
      joeMellorMode,
      superSamHallasMode,
    });
  }, [squad, seasonResult, seed, joeMellorMode, superSamHallasMode]);

  return (
    <DocumentPageShell
      diagnoseLabel="QuickModeSeasonReview"
      className={
        showPlayoffPrompt
          ? "pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pb-[calc(var(--mobile-button-height)+1.25rem+env(safe-area-inset-bottom))]"
          : "pb-[max(1rem,env(safe-area-inset-bottom))]"
      }
    >
        {showCelebration && <Confetti />}

          <div className="relative flex w-full min-w-0 flex-col items-center py-2 sm:py-6">
            <div className="manager-section w-full items-center px-0">
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full min-w-0 text-center"
            >
              <p
                className={`font-display text-[10px] font-semibold uppercase tracking-wider sm:text-xs sm:tracking-[0.3em] ${NORMAL.reviewAccent}`}
              >
                {reviewLabel}
              </p>

              <ReviewSubmissionNotice
                submittedOnline={submittedOnline}
                specialRun={isSpecialMode}
                boostedRun={boostedRun}
              />

              <motion.div
                className="mt-3 sm:mt-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p
                  className="font-display text-2xl font-black uppercase tracking-tight sm:text-5xl"
                  style={{
                    color: gradeInfo.color,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {gradeInfo.grade} Grade
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-accent-gold sm:mt-2 sm:text-xs">
                  {getSeasonStoryHeading(mode)}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-300">
                  {gradeInfo.label}
                </p>
                <p className="mx-auto mt-2 hidden max-w-md text-sm leading-relaxed text-gray-500 sm:mt-3 sm:block">
                  {getSeasonReviewStoryBio(
                    mode,
                    gradeInfo.grade,
                    {
                      wins: seasonResult.wins,
                      losses: seasonResult.losses,
                      leaguePosition: dreamTeamTablePosition,
                      pointsDifference: seasonResult.pointsDifference,
                      isPerfect: seasonResult.isPerfect,
                    },
                    dreamTeamTablePosition
                  )}
                </p>
              </motion.div>

              {isPerfect && (
                <motion.h1
                  className="mt-3 font-display text-xl font-black text-accent-gold sm:mt-4 sm:text-4xl"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  27-0 ACHIEVED
                </motion.h1>
              )}
            </motion.header>

            <motion.div
              className="mt-6 w-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {showPlayoffPrompt ? (
                <div className="text-center">
                  <p className={TYPO.bodySm}>
                    Play-offs unlocked — finish the knockout stage.
                  </p>
                </div>
              ) : null}
              {clubFundsPayout ? (
                <div className="mt-4">
                  <ClubFundsEarned payout={clubFundsPayout} />
                </div>
              ) : null}
            </motion.div>

            <CollapsibleReviewSection title="Season Summary" delay={0.32} defaultOpen>
              <div className={`mx-auto max-w-md space-y-2 text-center ${TYPO.body}`}>
                <p>
                  Regular Season Record:{" "}
                  <span className="font-semibold text-white">
                    {formatRecordWithPercentage(
                      seasonResult.wins,
                      seasonResult.losses
                    )}
                  </span>
                </p>
                {missedPlayoffs && (
                  <p className="font-semibold text-gray-500">Missed Play-Offs</p>
                )}
                <p>
                  League Position:{" "}
                  <span className="font-semibold text-white">
                    {leaguePositionLabel}
                  </span>
                </p>
                <p>
                  National Rank:{" "}
                  <span className="font-semibold text-white">
                    {runRank ? `#${runRank}` : "—"}
                  </span>
                </p>
                <p>
                  Total Team Value:{" "}
                  <span className="font-semibold text-accent-gold">
                    {formatValue(totalValue)}
                  </span>
                </p>
                <p className="pt-2 text-gray-500">{summaryMessage}</p>
                {seasonResult.insights.length > 0 && (
                  <div className="border-t border-pitch-700/40 pt-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Season Highlights
                    </p>
                    <ul className="mx-auto mt-2 max-w-md space-y-1.5 text-sm text-gray-400">
                      {seasonResult.insights.map((insight) => (
                        <li
                          key={insight}
                          className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-3 py-2 text-center leading-relaxed"
                        >
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="League Table" delay={0.34} defaultOpen>
              <LeagueTable rows={leagueTable} />
            </CollapsibleReviewSection>

            <CollapsibleReviewSection
              title="Match Results"
              delay={0.36}
              defaultOpen={false}
              helper="Tap a result for details."
            >
              <div className="min-w-0 space-y-2 text-left">
                {seasonResult.fixtures.map((fixture) => {
                  const isSelected = selectedFixture?.round === fixture.round;
                  return (
                    <div
                      key={fixture.round}
                      ref={isSelected ? selectedRowRef : undefined}
                      className="min-w-0"
                    >
                      <FixtureResultRow
                        fixture={fixture}
                        onClick={() => {
                          if (!isSelected) playPanelExpand();
                          else playPanelClose();
                          setSelectedFixture(isSelected ? null : fixture);
                        }}
                        selected={isSelected}
                      />
                      <AnimatePresence initial={false}>
                        {isSelected && (
                          <div className="mt-1">
                            <MatchDetailsPanel
                              key={fixture.round}
                              fixture={fixture}
                              seed={seed}
                              userSquad={squad}
                              userClubColorOverride={dreamTeamColorClub}
                              currentSeasonOnly={!normalEraMode}
                              hideMatchStory
                              onClose={() => {
                                playPanelClose();
                                setSelectedFixture(null);
                              }}
                            />
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="Squad Review" delay={0.38} defaultOpen={false}>
              <SquadReviewSection
                squad={squad}
                awards={playerAwards}
                tryScorers={seasonResult.tryScorers}
                expectedTotalTries={expectedTries}
                totalMatches={seasonResult.fixtures.length}
              />
            </CollapsibleReviewSection>

            <motion.footer
              className="mt-8 w-full space-y-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <div className="space-y-3">
                {!loading && !isLoggedIn && !showPlayoffPrompt && (
                  <GuestSaveNudge context="quick-season" />
                )}
                {!showPlayoffPrompt ? (
                  <MatchReviewActions
                    onPlayAgain={handlePlayAgain}
                    onReturnHome={onReturnHome}
                    leaderboardHref="/leaderboard"
                    shareAction={shareAction}
                  />
                ) : null}
              </div>
            </motion.footer>
            </div>
          </div>

        {showPlayoffPrompt && (
          <div className="sticky bottom-0 z-[1] mt-4 border-t border-theme-tertiary/25 bg-[rgba(5,10,9,0.98)] px-[var(--layout-page-pad-inline)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.45)]">
            <div className="mx-auto w-full max-w-[var(--layout-page-compact)]">
              <GameButton
                variant="theme"
                className="w-full"
                onClick={() => {
                  playUiClick();
                  onContinuePlayoffs?.();
                }}
              >
                Continue to Play-Offs →
              </GameButton>
            </div>
          </div>
        )}
    </DocumentPageShell>
  );
}

function formatLeaguePosition(position: number): string {
  const v = position % 100;
  const suffix =
    v >= 11 && v <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}
