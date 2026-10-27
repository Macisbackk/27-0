"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameDifficulty, GameMode, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { SquadReviewSection } from "./SquadReviewSection";
import { generateSeasonAwards } from "@/lib/season-awards";
import Link from "next/link";
import { buildEndOfSeasonAwards, buildSeasonHeadlines } from "@/lib/game/season-headlines";
import {
  getSeasonGradeFromSquad,
  getSeasonReviewStoryBio,
  getSeasonStoryHeading,
} from "@/lib/grades";
import { getSeasonReviewLabel } from "@/lib/mode-labels";
import { getSquadValue } from "@/lib/positions";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { formatChemistryBonus } from "@/lib/game/chemistry";
import { getHalfwayCallLabel } from "@/lib/game/halfway-call";
import { getSeasonTryTotal } from "@/lib/game/season-tries";
import { playGradeSound, playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { MatchReviewActions } from "./MatchReviewActions";
import { ShareSeasonButton } from "./ShareSeasonButton";
import { ShareResultButton } from "./ShareResultButton";
import { buildShareResultText } from "@/lib/share-result";
import {
  getWeeklyChallengeHref,
  getWeeklyChallengeScenario,
  getWeeklyChallengeWeekKey,
} from "@/lib/weekly-challenge";
import { formatCountdown, msUntilUkMidnight } from "@/lib/daily-bonus";
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
import { REVIEW_STAT_GRID } from "@/lib/ui/design-system";
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
  getDailyChallengeHref,
  getDailyChallengeStreak,
} from "@/lib/daily-challenge";
import type { ChallengePayload } from "@/lib/challenge-link";
import { RunSocialPanel, useDailyPickRarity, type RunOutcome } from "./RunSocial";
import { PitchMark } from "@/components/ui/PitchHero";
import { BallGlyph, CupGlyph } from "@/components/icons/rugby-icons";

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
  /** Daily Challenge: false for a practice run after today's counted attempt. */
  dailyAttemptCounts?: boolean;
  dailyScenario?: DailyChallengeScenario | null;
  /** Weekly Challenge run: scored for the Weekly board (see lib/weekly-challenge.ts). */
  weeklyChallengeMode?: boolean;
  /** Weekly Challenge: this run's score so far (regular season), null until worked out. */
  weeklyScore?: number | null;
  /** Weekly Challenge: false for a practice run after this week's ranked attempt. */
  weeklyAttemptCounts?: boolean;
  runRank?: number;
  submittedOnline?: boolean;
  boostedRun?: boolean;
  clubFundsPayout?: ClubFundsPayoutResult | null;
  /** Cards this run put in the Squad Book for the first time. */
  newSquadBookCards?: number;
  onContinuePlayoffs?: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  onFinalizeSeason?: () => void;
  onReturnHome?: () => void;
  /** Set when this run came from a "Challenge a mate" link: shows the head-to-head. */
  challenge?: ChallengePayload | null;
}

export function SeasonReview({
  squad,
  mode,
  seasonResult,
  seed,
  difficulty = "NORMAL",
  dailyAttemptCounts = true,
  joeMellorMode = false,
  superSamHallasMode = false,
  normalEraMode = false,
  dailyChallengeMode = false,
  dailyScenario = null,
  weeklyChallengeMode = false,
  weeklyScore = null,
  weeklyAttemptCounts = true,
  runRank: _runRank,
  submittedOnline = false,
  boostedRun = false,
  clubFundsPayout = null,
  newSquadBookCards = 0,
  onContinuePlayoffs,
  onPlayAgain,
  onClose,
  onFinalizeSeason,
  onReturnHome,
  challenge = null,
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
  const endOfSeasonAwards = useMemo(() => {
    const poty = awards.find((a) => a.title === "Player of the Season");
    return buildEndOfSeasonAwards(
      squad,
      seasonResult,
      poty ? { playerName: poty.playerName } : null
    );
  }, [awards, squad, seasonResult]);
  const headlines = useMemo(
    () => buildSeasonHeadlines(seasonResult, dreamTeamTablePosition),
    [seasonResult, dreamTeamTablePosition]
  );
  const isPerfect = seasonResult.isPerfect;
  const isSuperSquad = gradeInfo.grade === "S" || gradeInfo.grade === "S+";
  const isSpecialMode = joeMellorMode || superSamHallasMode;
  const reviewLabel = superSamHallasMode
    ? "Super Sam Season Review"
    : joeMellorMode
      ? "GOAT Mode Season Review"
      : getSeasonReviewLabel(
          mode,
          "NORMAL",
          normalEraMode,
          Boolean(SHOW_DAILY_CHALLENGE_UI && dailyChallengeMode)
        );
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
  const chemistryBonus = seasonResult.chemistryBonus ?? 0;
  // Only when a halfway call was actually made (the fork opens only for an unbeaten side).
  const halfwayCallLabel =
    seasonResult.halfwayCall && seasonResult.halfwayCall !== "none"
      ? getHalfwayCallLabel(seasonResult.halfwayCall)
      : null;
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

  // Social: Daily pick rarity, "Challenge a mate" and the head-to-head (play-off review when qualified).
  const pickRarity = useDailyPickRarity(seed, squad, !showPlayoffPrompt && !joeMellorMode && !superSamHallasMode);
  const socialOutcome = useMemo<RunOutcome>(
    () => ({
      results: seasonResult.fixtures.map((fixture) => fixture.result),
      position: dreamTeamTablePosition,
      finish: missedPlayoffs ? "Missed Play-Offs" : null,
    }),
    [seasonResult.fixtures, dreamTeamTablePosition, missedPlayoffs]
  );

  const showDailyPresentation =
    SHOW_DAILY_CHALLENGE_UI && dailyChallengeMode;
  const dailyStreakNow = showDailyPresentation ? getDailyChallengeStreak() : 0;
  const [nextDailyIn, setNextDailyIn] = useState<string | null>(null);
  useEffect(() => {
    if (!showDailyPresentation) return;
    const tick = () => setNextDailyIn(formatCountdown(msUntilUkMidnight()));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, [showDailyPresentation]);
  const shareCardData = useMemo(() => {
    if (showDailyPresentation && dailyScenario) {
      const streak = getDailyChallengeStreak();
      // This run's result (not the day's best, which may come from an earlier attempt).
      const detailLines = [
        `${dailyScenario.eraMode ? "Era" : "Current"} · ${getDailyChallengeDateKey()}`,
        formatRecordWithPercentage(seasonResult.wins, seasonResult.losses),
        dreamTeamTablePosition === 1 ? "League Leaders" : `League position ${leaguePositionLabel}`,
        streak > 0 ? `Streak ${streak}` : undefined,
      ].filter((line): line is string => Boolean(line));

      return {
        title: `Daily: ${dailyScenario.ruleTitle}`,
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
    dreamTeamTablePosition,
    averageTeamRating,
  ]);

  // Wordle-style spoiler-free text: the main share. The image card stays as a smaller extra.
  const shareResultText = useMemo(() => {
    const results = seasonResult.fixtures.map((fixture) => fixture.result);
    const modeLabel = superSamHallasMode
      ? "Super Sam"
      : joeMellorMode
        ? "GOAT Mode"
        : mode === "DRAFT"
          ? "Draft"
          : undefined;
    const base = {
      results,
      leaguePosition: dreamTeamTablePosition,
      playoffFinish: missedPlayoffs ? ("Missed Play-Offs" as const) : null,
    };
    if (showDailyPresentation && dailyScenario) {
      return buildShareResultText({
        ...base,
        kind: "daily",
        era: dailyScenario.eraMode,
        dateKey: getDailyChallengeDateKey(),
        ruleTitle: dailyScenario.ruleTitle,
        practice: dailyAttemptCounts === false,
        streak: getDailyChallengeStreak(),
        href: getDailyChallengeHref(),
        rarestPick: pickRarity.rarest,
      });
    }
    if (weeklyChallengeMode) {
      const scenario = getWeeklyChallengeScenario();
      return buildShareResultText({
        ...base,
        kind: "weekly",
        era: scenario.eraMode,
        weekKey: getWeeklyChallengeWeekKey(),
        ruleTitle: scenario.ruleTitle,
        practice: weeklyAttemptCounts === false,
        weeklyScore,
        href: getWeeklyChallengeHref(),
      });
    }
    return buildShareResultText({
      ...base,
      kind: "classic",
      era: normalEraMode,
      modeLabel,
    });
  }, [
    seasonResult.fixtures,
    superSamHallasMode,
    joeMellorMode,
    mode,
    dreamTeamTablePosition,
    missedPlayoffs,
    showDailyPresentation,
    dailyScenario,
    dailyAttemptCounts,
    weeklyChallengeMode,
    weeklyAttemptCounts,
    weeklyScore,
    normalEraMode,
    pickRarity.rarest,
  ]);

  const shareAction = (
    <ShareResultButton
      text={shareResultText}
      secondary={
        <ShareSeasonButton
          data={shareCardData}
          variant="ghost"
          size="sm"
          fullWidth={false}
          label="Share as image"
          filename={
            showDailyPresentation ? "daily-challenge.png" : "27-0-quick-season.png"
          }
        />
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
      // Phones always get a sticky main action (Play again / Play-offs) at the bottom.
      className="fl-review pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pb-[calc(var(--mobile-button-height)+1.25rem+env(safe-area-inset-bottom))]"
    >
        {showCelebration && <Confetti />}

          <div className="relative flex w-full min-w-0 flex-col items-center py-2 sm:py-4">
            <div className="mx-auto flex w-full min-w-0 max-w-[var(--layout-page-compact)] flex-col gap-3 sm:gap-4">
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full min-w-0 text-center"
            >
              <section className="pitch-surface pitch-hero pitch-hero--feature" aria-label="Season result">
                <PitchMark>{isPerfect ? <CupGlyph /> : <BallGlyph />}</PitchMark>
                <div className="relative min-w-0">
                  <p className="pitch-eyebrow">
                    {reviewLabel}
                    {isPerfect ? null : (
                      <span className="pitch-pill">
                        {seasonResult.wins}-{seasonResult.losses}
                      </span>
                    )}
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="pitch-title fl-stamp !text-[48px] sm:!text-[56px]">
                      {gradeInfo.grade} Grade
                    </p>
                    {isPerfect && (
                      <motion.h1
                        className="pitch-title mt-1 !text-[30px] sm:!text-[36px]"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        27-0 achieved
                      </motion.h1>
                    )}
                    <p className="pitch-eyebrow mt-3 !text-[13px] !leading-tight">
                      {getSeasonStoryHeading(mode)}
                    </p>
                    <p className="pitch-sub !mt-0.5 !text-[17px] !font-bold !leading-snug">
                      {gradeInfo.label}
                    </p>
                    <p className="pitch-sub hidden !font-medium sm:block">
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
                </div>
              </section>

              <ReviewSubmissionNotice
                submittedOnline={submittedOnline}
                specialRun={isSpecialMode}
                boostedRun={boostedRun}
                dailyChallenge={showDailyPresentation}
                dailyPractice={showDailyPresentation && dailyAttemptCounts === false}
                ballKnower={difficulty === "HARD" && !showDailyPresentation && !weeklyChallengeMode}
                weeklyChallenge={weeklyChallengeMode && !showDailyPresentation}
                weeklyScore={showPlayoffPrompt ? null : weeklyScore}
                weeklyPractice={weeklyAttemptCounts === false}
              />
            </motion.header>

            {showPlayoffPrompt ? (
              <motion.div
                className="w-full px-1 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p className={TYPO.muted}>
                  Play-offs unlocked — finish the knockout stage to earn more
                  Club Funds
                </p>
              </motion.div>
            ) : null}

            <ClubFundsEarned payout={clubFundsPayout} />

            {!showPlayoffPrompt ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                {showDailyPresentation ? (
                  <p className="mb-2 text-center text-sm text-[color:var(--fl-muted)]">
                    {dailyStreakNow > 0 ? `🔥 ${dailyStreakNow}-day streak` : "No streak yet"}
                    {nextDailyIn ? ` · Next Daily in ${nextDailyIn}` : ""}
                  </p>
                ) : null}
                <MatchReviewActions
                  compact
                  onPlayAgain={handlePlayAgain}
                  onReturnHome={onReturnHome}
                  leaderboardHref={showDailyPresentation ? "/leaderboard?tracker=daily_streak" : weeklyChallengeMode ? "/leaderboard?tracker=weekly" : "/leaderboard"}
                  shareAction={shareAction}
                />
              </motion.div>
            ) : null}

            {!showPlayoffPrompt ? (
              <RunSocialPanel
                seed={seed}
                era={normalEraMode}
                squad={squad}
                outcome={socialOutcome}
                challenge={challenge}
                rarity={pickRarity.rarity}
                canChallenge={mode === "CLASSIC" && !isSpecialMode && difficulty !== "HARD"}
              />
            ) : null}

            {newSquadBookCards > 0 ? (
              <p className="text-center text-sm">
                <Link
                  href="/squad-book"
                  onClick={() => playUiClick()}
                  className="font-semibold text-theme-primary underline-offset-2 hover:underline"
                >
                  +{newSquadBookCards} new {newSquadBookCards === 1 ? "card" : "cards"} in your Squad Book →
                </Link>
              </p>
            ) : null}

            {headlines.length > 0 || endOfSeasonAwards.length > 0 ? (
              <motion.section
                className="w-full rounded-card bg-pitch-900 px-4 py-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.31 }}
                aria-labelledby="season-awards-title"
              >
                <h2 id="season-awards-title" className={`${TYPO.eyebrow} text-accent-gold`}>
                  End of season
                </h2>
                {headlines.length > 0 ? (
                  <ul className="mt-2 space-y-1.5" aria-label="Headlines">
                    {headlines.map((h) => (
                      <li key={h.id} className="font-display text-[15px] font-bold leading-snug text-white">
                        “{h.text}”
                      </li>
                    ))}
                  </ul>
                ) : null}
                {endOfSeasonAwards.length > 0 ? (
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Awards">
                    {endOfSeasonAwards.map((a) => (
                      <li key={a.id} className="rounded-tile bg-pitch-950 px-3 py-2 text-left">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--fl-muted)]">
                          {a.title}
                        </p>
                        <p className="mt-0.5 break-words text-[15px] font-bold leading-tight text-white">
                          {a.playerName}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">{a.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </motion.section>
            ) : null}

            <CollapsibleReviewSection title="Season Summary" delay={0.32}>
              <div className={`${REVIEW_STAT_GRID} mx-auto max-w-lg`}>
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
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                {halfwayCallLabel ? (
                  <p className={TYPO.label}>
                    Halfway call:{" "}
                    <span className="text-white">{halfwayCallLabel}</span>
                  </p>
                ) : null}
                {chemistryBonus > 0 ? (
                  <p className={TYPO.label}>
                    Chemistry{" "}
                    <span className="text-lime-300">{formatChemistryBonus(chemistryBonus)}</span>
                  </p>
                ) : null}
              </div>
              {missedPlayoffs ? (
                <p className={`mt-3 text-center ${TYPO.label}`}>
                  Missed the play-offs
                </p>
              ) : null}
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="Squad Review" delay={0.34} collapsed>
              <SquadReviewSection
                squad={squad}
                awards={playerAwards}
                tryScorers={seasonResult.tryScorers}
                expectedTotalTries={expectedTries}
                totalMatches={seasonResult.fixtures.length}
              />
            </CollapsibleReviewSection>

            <CollapsibleReviewSection title="League Table" delay={0.36} collapsed>
              <LeagueTable rows={leagueTable} />
            </CollapsibleReviewSection>

            <CollapsibleReviewSection
              title="Match Results"
              delay={0.38}
              collapsed
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
              className="mt-1 w-full space-y-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <div className="space-y-3">
                {!authLoading &&
                !isLoggedIn &&
                !showPlayoffPrompt &&
                !submittedOnline &&
                !showDailyPresentation ? (
                  <GuestSaveNudge context="quick-season" />
                ) : null}
                {!authLoading &&
                !isLoggedIn &&
                !showPlayoffPrompt &&
                showDailyPresentation ? (
                  <GuestSaveNudge context="daily-challenge" />
                ) : null}
                {!showPlayoffPrompt ? (
                  <MatchReviewActions compact onPlayAgain={handlePlayAgain} onReturnHome={onReturnHome} hideEndOfRunNav />
                ) : null}
              </div>
            </motion.footer>
            </div>
          </div>

        {!showPlayoffPrompt && (
          // Phones: keep the main action in reach without scrolling past the review.
          <div className="sticky bottom-0 z-[1] mt-4 border-t border-white/[0.06] bg-[rgba(10,17,14,0.96)] px-[var(--layout-page-pad-inline)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
            <div className="mx-auto w-full max-w-[var(--layout-page-compact)]">
              <GameButton
                variant="theme"
                className="w-full"
                onClick={() => {
                  playUiClick();
                  handlePlayAgain();
                }}
              >
                Play again
              </GameButton>
            </div>
          </div>
        )}
        {showPlayoffPrompt && (
          <div className="sticky bottom-0 z-[1] mt-4 border-t border-white/[0.06] bg-[rgba(10,17,14,0.96)] px-[var(--layout-page-pad-inline)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-[var(--layout-page-compact)]">
              <GameButton
                variant="theme"
                className="w-full"
                onClick={() => {
                  playUiClick();
                  onContinuePlayoffs?.();
                }}
              >
                <span className="sm:hidden">Play-offs</span>
                <span className="hidden sm:inline">Continue to play-offs →</span>
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
