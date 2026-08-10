"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
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
import { mergeClubFundsPayouts } from "@/lib/club-funds";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { SquadReviewSection } from "./SquadReviewSection";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { PlayoffBracketDisplay } from "./PlayoffBracketDisplay";
import { Confetti } from "./Confetti";
import { TYPO } from "@/lib/ui/typography";
import { NORMAL } from "@/lib/ui/design-system";
import { DocumentPageShell } from "@/components/ui/DocumentPageShell";
import { clearStaleBodyScrollLocks } from "@/lib/ui/document-page-scroll";
import { ShareSeasonButton } from "./ShareSeasonButton";
import type { DailyChallengeScenario } from "@/lib/daily-challenge";
import {
  getDailyChallengeDateKey,
  getDailyChallengeProgress,
  getDailyChallengeStreak,
} from "@/lib/daily-challenge";

const PLAYOFF_AWARD_TITLES: Record<string, string> = {
  "Player of the Season": "Best Player of the Play-Offs",
  "Worst Player of the Season": "Worst Player of the Play-Offs",
};

interface PlayoffReviewProps {
  squad: SquadSlot[];
  seasonResult: SeasonResult;
  playoffResult: PlayoffResult;
  playoffBracketState?: PlayoffBracketState | null;
  playoffFundsPayout?: ClubFundsPayoutResult | null;
  clubFundsPayout?: ClubFundsPayoutResult | null;
  dailyChallengeMode?: boolean;
  dailyScenario?: DailyChallengeScenario | null;
  onFinalizeRun?: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  onReturnHome?: () => void;
}

export function PlayoffReview({
  squad,
  seasonResult,
  playoffResult,
  playoffBracketState = null,
  playoffFundsPayout = null,
  clubFundsPayout = null,
  dailyChallengeMode = false,
  dailyScenario = null,
  onFinalizeRun,
  onPlayAgain,
  onReturnHome,
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

  const fundsPayout = useMemo(
    () => mergeClubFundsPayouts(clubFundsPayout, playoffFundsPayout),
    [clubFundsPayout, playoffFundsPayout]
  );

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

  const shareAction = useMemo(() => {
    if (!dailyChallengeMode || !dailyScenario) return null;
    const progress = getDailyChallengeProgress();
    const streak = getDailyChallengeStreak();
    const overallWins = seasonResult.wins + playoffResult.wins;
    const overallLosses = seasonResult.losses + playoffResult.losses;
    const detailLines = [
      `${dailyScenario.eraMode ? "Era" : "Current"} · ${getDailyChallengeDateKey()}`,
      formatRecordWithPercentage(overallWins, overallLosses),
      progress.leagueLeaders ? "League Leaders" : undefined,
      playoffResult.isChampion || progress.playoffTitle
        ? "Champions"
        : playoffResult.finish,
      streak > 0 ? `Streak ${streak}` : undefined,
    ].filter((line): line is string => Boolean(line));

    return (
      <ShareSeasonButton
        data={{
          title: `Daily · All ${dailyScenario.forceOpponentClub}`,
          subtitle: dailyScenario.eraMode
            ? "Era Daily Challenge"
            : "Daily Challenge",
          recordLine: formatRecordWithPercentage(overallWins, overallLosses),
          detailLines,
        }}
        filename="27-0-daily.png"
      />
    );
  }, [
    dailyChallengeMode,
    dailyScenario,
    seasonResult.wins,
    seasonResult.losses,
    playoffResult.wins,
    playoffResult.losses,
    playoffResult.isChampion,
    playoffResult.finish,
  ]);

  return (
    <DocumentPageShell
      diagnoseLabel="QuickModePlayoffReview"
      className="pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {isChampion && <Confetti />}

      <div className="relative flex w-full flex-col items-center py-4 sm:py-8">
        <div className="manager-section w-full items-center px-0">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center"
        >
          <p
            className={`font-display text-xs font-semibold uppercase tracking-[0.3em] ${NORMAL.reviewAccent}`}
          >
            Super League Play-Off Review
          </p>
          <h1 className="mt-4 font-display text-2xl font-black text-accent-gold sm:text-3xl">
            {playoffResult.finish}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
            {titleBio}
          </p>
          {isChampion && (
            <p className="mt-2 text-sm font-semibold text-theme-primary">
              Super League Champions.
            </p>
          )}
        </motion.header>

        <motion.div
          className="mt-6 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <MatchReviewActions
            compact
            onPlayAgain={onPlayAgain}
            onReturnHome={onReturnHome}
            leaderboardHref={
              dailyChallengeMode
                ? "/leaderboard?tracker=daily_streak"
                : "/leaderboard"
            }
            shareAction={shareAction}
          />
        </motion.div>

        <motion.div
          className="mt-4 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ClubFundsEarned payout={fundsPayout} />
        </motion.div>

        <CollapsibleReviewSection title="Play-Off Summary" delay={0.2} defaultOpen>
          <div className={`mx-auto max-w-md space-y-2 text-center ${TYPO.body}`}>
            <p>
              Play-Off Record:{" "}
              <span className="font-semibold text-white">
                {formatRecordWithPercentage(
                  playoffResult.wins,
                  playoffResult.losses
                )}
              </span>
            </p>
            <p>
              Regular Season:{" "}
              <span className="font-semibold text-gray-300">
                {formatRecordWithPercentage(
                  seasonResult.wins,
                  seasonResult.losses
                )}
              </span>
            </p>
            <p>
              Overall Season:{" "}
              <span className="font-semibold text-theme-primary">
                {formatRecordWithPercentage(
                  seasonResult.wins + playoffResult.wins,
                  seasonResult.losses + playoffResult.losses
                )}
              </span>
            </p>
            <p>
              Regular Season Finish:{" "}
              <span className="font-semibold text-white">
                {formatLeaguePosition(playoffResult.leaguePosition)}
              </span>
            </p>
          </div>
        </CollapsibleReviewSection>

        {playoffBracketState && (
          <CollapsibleReviewSection
            title="Play-Off Bracket"
            delay={0.25}
            defaultOpen
            helper="Tap a match for details."
          >
            <PlayoffBracketDisplay
              state={playoffBracketState}
              embedded
              championLabel={
                bracketChampion ??
                (playoffResult.isChampion ? "Dream Team" : playoffResult.finish)
              }
            />
          </CollapsibleReviewSection>
        )}

        <CollapsibleReviewSection
          title="Playoff Squad Review"
          delay={0.32}
          defaultOpen={false}
        >
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

        <motion.footer
          className="mt-8 w-full"
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
