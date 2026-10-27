"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { getPlayoffFinishLabel, type PlayoffResult } from "@/lib/game/playoff-simulation";
import type { PlayoffBracketState } from "@/lib/game/playoff-bracket";
import { formatRecordWithPercentage } from "@/lib/lifetime-stats";
import { getPlayoffReviewBio } from "@/lib/playoff-review-bio";
import { generateSeasonAwards } from "@/lib/season-awards";
import {
  getPlayoffPotyNarrative,
  getPlayoffWorstNarrative,
} from "@/lib/game/tournament-awards";
import { MatchReviewActions } from "./MatchReviewActions";
import { ClubFundsEarned } from "./ClubFundsEarned";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { SquadReviewSection } from "./SquadReviewSection";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { PlayoffBracketDisplay } from "./PlayoffBracketDisplay";
import { Confetti } from "./Confetti";
import { MANAGER } from "@/lib/ui/design-system";
import { DocumentPageShell } from "@/components/ui/DocumentPageShell";
import { GameStatCard } from "@/components/ui/GameStatCard";
import { clearStaleBodyScrollLocks } from "@/lib/ui/document-page-scroll";
import { ShareSeasonButton } from "./ShareSeasonButton";
import { ShareResultButton } from "./ShareResultButton";
import { buildShareResultText } from "@/lib/share-result";
import {
  getWeeklyChallengeHref,
  getWeeklyChallengeScenario,
  getWeeklyChallengeWeekKey,
} from "@/lib/weekly-challenge";
import type { DailyChallengeScenario } from "@/lib/daily-challenge";
import {
  getDailyChallengeDateKey,
  getDailyChallengeHref,
  getDailyChallengeStreak,
} from "@/lib/daily-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { getQuickModeLabel } from "@/lib/mode-labels";
import type { GameDifficulty } from "@/lib/types";
import { ReviewSubmissionNotice } from "./ReviewSubmissionNotice";
import type { ChallengePayload } from "@/lib/challenge-link";
import { RunSocialPanel, useDailyPickRarity, type RunOutcome } from "./RunSocial";
import { PitchHero } from "@/components/ui/PitchHero";
import { CupGlyph } from "@/components/icons/rugby-icons";

const PLAYOFF_AWARD_TITLES: Record<string, string> = {
  "Player of the Season": "Player of the Play-offs",
  "Worst Player of the Season": "Worst Player of the Play-offs",
};

interface PlayoffReviewProps {
  squad: SquadSlot[];
  seasonResult: SeasonResult;
  playoffResult: PlayoffResult;
  playoffBracketState?: PlayoffBracketState | null;
  playoffFundsPayout?: ClubFundsPayoutResult | null;
  dailyChallengeMode?: boolean;
  dailyScenario?: DailyChallengeScenario | null;
  /** Daily: false when today's counted attempt was already used (practice run). */
  dailyAttemptCounts?: boolean;
  /** Weekly Challenge run: scored for the Weekly board (see lib/weekly-challenge.ts). */
  weeklyChallengeMode?: boolean;
  /** Weekly Challenge: this run's final score, null until worked out. */
  weeklyScore?: number | null;
  /** Weekly Challenge: false for a practice run after this week's ranked attempt. */
  weeklyAttemptCounts?: boolean;
  /** Era squads (Classic) — picks the share-card subtitle. */
  normalEraMode?: boolean;
  difficulty?: GameDifficulty;
  /** From recordPlayoffCompletion: whether the run reached the online board, and its rank there. */
  submittedOnline?: boolean;
  runRank?: number;
  onFinalizeRun?: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  onReturnHome?: () => void;
  /** The run's spin seed (challenge links, Daily pick rarity). */
  seed?: string;
  /** Set when this run came from a "Challenge a mate" link: shows the head-to-head. */
  challenge?: ChallengePayload | null;
}

export function PlayoffReview({
  squad,
  seasonResult,
  playoffResult,
  playoffBracketState = null,
  playoffFundsPayout = null,
  dailyChallengeMode = false,
  dailyScenario = null,
  dailyAttemptCounts = true,
  weeklyChallengeMode = false,
  weeklyScore = null,
  weeklyAttemptCounts = true,
  normalEraMode = false,
  difficulty = "NORMAL",
  submittedOnline = false,
  runRank,
  onFinalizeRun,
  onPlayAgain,
  onReturnHome,
  seed = "",
  challenge = null,
}: PlayoffReviewProps) {
  const playoffFinalizedRef = useRef(false);
  useEffect(() => {
    if (playoffFinalizedRef.current) return;
    playoffFinalizedRef.current = true;
    onFinalizeRun?.();
  }, [onFinalizeRun]);

  useEffect(() => {
    clearStaleBodyScrollLocks();
  }, []);

  const isChampion = playoffResult.isChampion;
  const titleBio = useMemo(
    () => getPlayoffReviewBio(playoffResult, seasonResult.wins),
    [playoffResult, seasonResult.wins]
  );

  // Only show funds earned in this playoff run — don't re-popup regular-season awards.
  const playoffFundsToShow = useMemo(() => {
    if (
      !playoffFundsPayout ||
      !playoffFundsPayout.awarded ||
      playoffFundsPayout.total <= 0 ||
      playoffFundsPayout.lines.length === 0
    ) {
      return null;
    }
    return playoffFundsPayout;
  }, [playoffFundsPayout]);

  const playoffLikeResult: SeasonResult = useMemo(() => {
    const pointsFor = playoffResult.userFixtures.reduce(
      (sum, fixture) => sum + fixture.pointsFor,
      0
    );
    const pointsAgainst = playoffResult.userFixtures.reduce(
      (sum, fixture) => sum + fixture.pointsAgainst,
      0
    );

    return {
      wins: playoffResult.wins,
      losses: playoffResult.losses,
      tryScorers: playoffResult.tryScorers,
      fixtures: playoffResult.userFixtures,
      squadStrength: seasonResult.squadStrength,
      pointsFor,
      pointsAgainst,
      pointsDifference: pointsFor - pointsAgainst,
      leaguePosition: playoffResult.leaguePosition,
      isPerfect: playoffResult.losses === 0 && playoffResult.wins > 0,
      longestWinStreak: playoffResult.wins,
      longestLosingStreak: playoffResult.losses > 0 ? 1 : 0,
      gameResults: playoffResult.userFixtures.map((fixture) => fixture.result),
      insights: [],
      replacedTeam: seasonResult.replacedTeam,
    };
  }, [playoffResult, seasonResult]);

  const playoffMatchCount = playoffResult.userFixtures.length;

  const playerAwards = useMemo(() => {
    if (playoffMatchCount === 0) return [];

    return generateSeasonAwards(squad, playoffLikeResult)
      .filter((award) => award.title in PLAYOFF_AWARD_TITLES)
      .map((award) => {
        const title = PLAYOFF_AWARD_TITLES[award.title] ?? award.title;
        let narrative = award.narrative;
        if (award.title === "Player of the Season") {
          narrative = getPlayoffPotyNarrative(playoffResult, award.playerName);
        } else if (award.title === "Worst Player of the Season") {
          narrative = getPlayoffWorstNarrative(playoffResult, award.playerName);
        }
        return { ...award, title, narrative };
      });
  }, [squad, playoffLikeResult, playoffResult, playoffMatchCount]);

  const bracketChampion = useMemo(() => {
    const final = playoffBracketState?.matches.find((m) => m.id === "gf");
    return final?.status === "complete" ? final.winner : null;
  }, [playoffBracketState]);

  const showDailyPresentation =
    SHOW_DAILY_CHALLENGE_UI && dailyChallengeMode && Boolean(dailyScenario);

  const imageShareAction = useMemo(() => {
    const imageButtonProps = {
      variant: "ghost" as const,
      size: "sm" as const,
      fullWidth: false,
      label: "Share as image",
    };
    const overallWins = seasonResult.wins + playoffResult.wins;
    const overallLosses = seasonResult.losses + playoffResult.losses;
    const recordLine = formatRecordWithPercentage(overallWins, overallLosses);
    const finishLabel = playoffResult.isChampion
      ? "Super League Champions"
      : getPlayoffFinishLabel(playoffResult.finish);

    if (!SHOW_DAILY_CHALLENGE_UI || !dailyChallengeMode || !dailyScenario) {
      return (
        <ShareSeasonButton
          data={{
            title: finishLabel,
            subtitle: getQuickModeLabel(normalEraMode),
            recordLine,
            detailLines: [
              `League position ${formatLeaguePosition(playoffResult.leaguePosition)}`,
              finishLabel,
            ],
          }}
          filename="27-0-play-offs.png"
          {...imageButtonProps}
        />
      );
    }
    const streak = getDailyChallengeStreak();
    const detailLines = [
      `${dailyScenario.eraMode ? "Era" : "Current"} · ${getDailyChallengeDateKey()}`,
      formatRecordWithPercentage(overallWins, overallLosses),
      playoffResult.leaguePosition === 1 ? "League Leaders" : undefined,
      playoffResult.isChampion
        ? "Champions"
        : getPlayoffFinishLabel(playoffResult.finish),
      streak > 0 ? `Streak ${streak}` : undefined,
    ].filter((line): line is string => Boolean(line));

    return (
      <ShareSeasonButton
        data={{
          title: `Daily: ${dailyScenario.ruleTitle}`,
          subtitle: dailyScenario.eraMode
            ? "Era Daily Challenge"
            : "Daily Challenge",
          recordLine,
          detailLines,
        }}
        filename="27-0-daily.png"
        {...imageButtonProps}
      />
    );
  }, [
    dailyChallengeMode,
    dailyScenario,
    normalEraMode,
    seasonResult.wins,
    seasonResult.losses,
    playoffResult.wins,
    playoffResult.losses,
    playoffResult.isChampion,
    playoffResult.finish,
    playoffResult.leaguePosition,
  ]);

  const pickRarity = useDailyPickRarity(seed, squad, Boolean(seed));
  const socialOutcome = useMemo<RunOutcome>(
    () => ({
      results: seasonResult.fixtures.map((fixture) => fixture.result),
      position: playoffResult.leaguePosition,
      finish: playoffResult.finish,
      playoffResults: playoffResult.userFixtures.map((fixture) => fixture.result),
    }),
    [seasonResult.fixtures, playoffResult.leaguePosition, playoffResult.finish, playoffResult.userFixtures]
  );

  // Wordle-style spoiler-free text: the main share. The image card stays as a smaller extra.
  const shareResultText = useMemo(() => {
    const base = {
      results: seasonResult.fixtures.map((fixture) => fixture.result),
      leaguePosition: playoffResult.leaguePosition,
      playoffResults: playoffResult.userFixtures.map((fixture) => fixture.result),
      playoffFinish: playoffResult.finish,
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
    return buildShareResultText({ ...base, kind: "classic", era: normalEraMode });
  }, [
    seasonResult.fixtures,
    playoffResult.leaguePosition,
    playoffResult.userFixtures,
    playoffResult.finish,
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
    <ShareResultButton text={shareResultText} secondary={imageShareAction} />
  );

  return (
    <DocumentPageShell
      diagnoseLabel="QuickModePlayoffReview"
      className="fl-review pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {isChampion && <Confetti />}

      <div className="relative flex w-full min-w-0 flex-col items-center py-2 sm:py-4">
        <div className="mx-auto flex w-full min-w-0 max-w-[var(--layout-page-compact)] flex-col gap-3 sm:gap-4">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full min-w-0 text-center"
        >
          <PitchHero
            size="feature"
            className="pitch-hero--centred"
            titleAs="h1"
            icon={<CupGlyph />}
            eyebrow={
              dailyChallengeMode && SHOW_DAILY_CHALLENGE_UI
                ? dailyScenario?.eraMode
                  ? "Era Daily Play-off Review"
                  : "Daily Play-off Review"
                : weeklyChallengeMode
                  ? "Weekly Challenge Play-off Review"
                  : "Super League Play-off Review"
            }
            badge={isChampion ? "Super League Champions." : undefined}
            title={getPlayoffFinishLabel(playoffResult.finish)}
            description={titleBio}
          />
          <ReviewSubmissionNotice
            submittedOnline={submittedOnline}
            dailyChallenge={showDailyPresentation}
            dailyPractice={showDailyPresentation && dailyAttemptCounts === false}
            ballKnower={difficulty === "HARD" && !showDailyPresentation && !weeklyChallengeMode}
            weeklyChallenge={weeklyChallengeMode && !showDailyPresentation}
            weeklyScore={weeklyScore}
            weeklyPractice={weeklyAttemptCounts === false}
          />
          {submittedOnline && !showDailyPresentation && !weeklyChallengeMode && runRank ? (
            <p className="mt-1 text-center text-xs font-semibold text-accent-gold">
              Ranked #{runRank} nationally
            </p>
          ) : null}
        </motion.header>

        {/* Result (above) → share / challenge a mate → rewards (Club Funds sheet) → Play again. */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mx-auto w-full max-w-xl">{shareAction}</div>
        </motion.div>

        {seed ? (
          <RunSocialPanel
            seed={seed}
            era={normalEraMode}
            squad={squad}
            outcome={socialOutcome}
            challenge={challenge}
            rarity={pickRarity.rarity}
            canChallenge={difficulty !== "HARD"}
          />
        ) : null}

        <ClubFundsEarned payout={playoffFundsToShow} delayMs={1200} />

        <MatchReviewActions
          compact
          onPlayAgain={onPlayAgain}
          onReturnHome={onReturnHome}
          leaderboardHref={
            dailyChallengeMode && SHOW_DAILY_CHALLENGE_UI
              ? "/leaderboard?tracker=daily_streak"
              : weeklyChallengeMode
                ? "/leaderboard?tracker=weekly"
                : "/leaderboard"
          }
        />

        <CollapsibleReviewSection title="Play-off Summary" delay={0.2}>
          <div className={`${MANAGER.statGrid2} mx-auto max-w-lg`}>
            <GameStatCard
              label="Play-off Record"
              value={formatRecordWithPercentage(
                playoffResult.wins,
                playoffResult.losses
              )}
              neutral
              className="text-center"
            />
            <GameStatCard
              label="Regular Season"
              value={formatRecordWithPercentage(
                seasonResult.wins,
                seasonResult.losses
              )}
              neutral
              className="text-center"
            />
            <GameStatCard
              label="Overall Season"
              value={
                <span className="text-theme-primary">
                  {formatRecordWithPercentage(
                    seasonResult.wins + playoffResult.wins,
                    seasonResult.losses + playoffResult.losses
                  )}
                </span>
              }
              neutral
              className="text-center"
            />
            <GameStatCard
              label="Regular Season Finish"
              value={formatLeaguePosition(playoffResult.leaguePosition)}
              neutral
              className="text-center"
            />
          </div>
        </CollapsibleReviewSection>

        <CollapsibleReviewSection title="Play-off Squad Review" delay={0.24}>
          <SquadReviewSection
            squad={squad}
            awards={playerAwards}
            tryScorers={playoffResult.tryScorers}
            expectedTotalTries={playoffResult.tryScorers.reduce(
              (sum, row) => sum + row.tries,
              0
            )}
            totalMatches={
              playoffMatchCount > 0 ? playoffMatchCount : undefined
            }
            statsScope="playoff"
          />
        </CollapsibleReviewSection>

        {playoffBracketState && (
          <CollapsibleReviewSection
            title="Play-off Bracket"
            delay={0.28}
          >
            <PlayoffBracketDisplay
              state={playoffBracketState}
              embedded
              championLabel={
                bracketChampion ??
                (playoffResult.isChampion ? "Dream Team" : getPlayoffFinishLabel(playoffResult.finish))
              }
            />
          </CollapsibleReviewSection>
        )}

        <motion.footer
          className="mt-1 w-full"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <MatchReviewActions
            onPlayAgain={onPlayAgain}
            onReturnHome={onReturnHome}
            leaderboardHref="/leaderboard"
          />
        </motion.footer>
        </div>
      </div>
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
