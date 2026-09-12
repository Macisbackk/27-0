"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameDifficulty, GameMode, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { SquadReviewSection } from "./SquadReviewSection";
import { generateSeasonAwards } from "@/lib/season-awards";
import {
  getSeasonGradeFromSquad,
  getSeasonReviewStoryBio,
  getSeasonStoryHeading,
} from "@/lib/grades";
import { getSeasonReviewLabel } from "@/lib/mode-labels";
import { getSquadValue } from "@/lib/positions";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getSeasonTryTotal } from "@/lib/game/season-tries";
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
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { runSeasonReviewValidation } from "@/lib/validation/season-review-validation";
import { NORMAL, MANAGER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { useAuth } from "@/lib/auth-context";
import { DocumentPageShell } from "@/components/ui/DocumentPageShell";
import { GameStatCard } from "@/components/ui/GameStatCard";
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
  runRank: _runRank,
  submittedOnline = false,
  boostedRun = false,
  clubFundsPayout = null,
  onContinuePlayoffs,
  onPlayAgain,
  onClose,
  onFinalizeSeason,
  onReturnHome,
}: SeasonReviewProps) {
  const { isLoggedIn, loading: authLoading } = useAuth();
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
  const averageTeamRating = getAverageSquadRating(squad);
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

  const showDailyPresentation =
    SHOW_DAILY_CHALLENGE_UI && dailyChallengeMode;
  const shareCardData = useMemo(() => {
    if (showDailyPresentation && dailyScenario) {
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
        `Average team rating ${averageTeamRating.toFixed(1)}`,
      ].filter(Boolean),
    };
  }, [
    showDailyPresentation,
    dailyScenario,
    gradeInfo.grade,
    reviewLabel,
    seasonResult.wins,
    seasonResult.losses,
    leaguePositionLabel,
    averageTeamRating,
  ]);

  const shareAction = (
    <ShareSeasonButton
      data={shareCardData}
      filename={
        showDailyPresentation ? "daily-challenge.png" : "27-0-quick-season.png"
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

          <div className="relative flex w-full min-w-0 flex-col items-center py-2 sm:py-4">
            <div className="manager-section w-full items-center px-0">
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full min-w-0 text-center"
            >
              <p
                className={`${TYPO.eyebrow} ${NORMAL.reviewAccent}`}
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
                  }}
                >
                  {gradeInfo.grade} Grade
                </p>
                <p className={`mt-1 sm:mt-2 ${TYPO.eyebrow} text-accent-gold`}>
                  {getSeasonStoryHeading(mode)}
                </p>
                <p className={`mt-1 ${TYPO.body} font-semibold text-gray-300`}>
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

            {showPlayoffPrompt ? (
              <motion.div
                className="mt-4 w-full text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p className={TYPO.bodySm}>
                  Play-offs unlocked — finish the knockout stage to earn more
                  Club Funds
                </p>
              </motion.div>
            ) : null}

            <ClubFundsEarned payout={clubFundsPayout} />

            <CollapsibleReviewSection title="Season Summary" delay={0.32}>
              <div className={`${MANAGER.statGrid2} mx-auto max-w-lg`}>
                <GameStatCard
                  label="Regular Season Record"
                  value={`${Math.round(seasonResult.wins)}-${Math.round(seasonResult.losses)}`}
                  neutral
                  className="text-center"
                />
                <GameStatCard
                  label="League Position"
                  value={leaguePositionLabel}
                  neutral
                  className="text-center"
                />
                <GameStatCard
                  label="Average Team Rating"
                  value={
                    <span className="text-accent-gold">
                      {averageTeamRating.toFixed(1)}
                    </span>
                  }
                  neutral
                  className="text-center"
                />
              </div>
              {missedPlayoffs ? (
                <p className="mt-3.5 text-center text-sm font-semibold text-gray-500 sm:mt-4">
                  Missed Play-Offs
                </p>
              ) : null}
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="Squad Review" delay={0.34}>
              <SquadReviewSection
                squad={squad}
                awards={playerAwards}
                tryScorers={seasonResult.tryScorers}
                expectedTotalTries={expectedTries}
                totalMatches={seasonResult.fixtures.length}
              />
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="League Table" delay={0.36}>
              <LeagueTable rows={leagueTable} />
            </CollapsibleReviewSection>

            <CollapsibleReviewSection
              title="Match Results"
              delay={0.38}
            >
              <div
                className="fixture-results-list max-h-[min(48vh,22rem)] min-w-0 overflow-y-auto overscroll-contain text-left pr-0.5"
                data-scroll-lock-allow="true"
              >
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
                        compact
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

            <motion.footer
              className="mt-6 w-full space-y-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <div className="space-y-3">
                {!authLoading &&
                !isLoggedIn &&
                !showPlayoffPrompt &&
                !submittedOnline ? (
                  <GuestSaveNudge context="quick-season" />
                ) : null}
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
                <span className="sm:hidden">Playoffs</span>
                <span className="hidden sm:inline">Continue to Play-Offs →</span>
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
