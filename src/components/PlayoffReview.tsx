"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import { formatRecordWithPercentage } from "@/lib/lifetime-stats";
import { formatFixtureScore } from "@/lib/game/season-simulation";
import { ReviewPlayAgain } from "./ReviewPlayAgain";
import { ClubFundsEarned } from "./ClubFundsEarned";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { TryScorersSection } from "./TryScorersSection";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { Confetti } from "./Confetti";
import { TYPO } from "@/lib/ui/typography";
import { NORMAL } from "@/lib/ui/design-system";

interface PlayoffReviewProps {
  squad: SquadSlot[];
  seasonResult: SeasonResult;
  playoffResult: PlayoffResult;
  playoffFundsPayout?: ClubFundsPayoutResult | null;
  isHardMode?: boolean;
  onPlayAgain: () => void;
  onClose: () => void;
}

export function PlayoffReview({
  squad,
  seasonResult,
  playoffResult,
  playoffFundsPayout = null,
  isHardMode = false,
  onPlayAgain,
  onClose,
}: PlayoffReviewProps) {
  const isChampion = playoffResult.isChampion;
  const topScorers = useMemo(
    () =>
      [...playoffResult.tryScorers]
        .sort((a, b) => b.tries - a.tries)
        .slice(0, 5),
    [playoffResult.tryScorers]
  );
  const bestScorer = topScorers[0];
  const worstScorer =
    topScorers.length > 1 ? topScorers[topScorers.length - 1] : null;

  const handlePlayAgain = () => {
    onPlayAgain();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md">
      {isChampion && <Confetti />}

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-8 sm:py-12">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl text-center"
        >
          <p
            className={`font-display text-xs font-semibold uppercase tracking-[0.3em] ${NORMAL.reviewAccent}`}
          >
            Super League Play-Off Review
          </p>
          <h1 className="mt-4 font-display text-3xl font-black text-accent-gold sm:text-4xl">
            {playoffResult.finish}
          </h1>
          {isChampion && (
            <p className="mt-2 text-sm font-semibold text-accent-green">
              Super League Champions — your squad lifted the trophy.
            </p>
          )}
        </motion.header>

        <motion.div
          className="mt-6 w-full max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ReviewPlayAgain
            onPlayAgain={handlePlayAgain}
            leaderboardHref={`/leaderboard${isHardMode ? "?difficulty=hard" : ""}`}
            hardMode={isHardMode}
            compact
          />
          <ClubFundsEarned payout={playoffFundsPayout} />
        </motion.div>

        <CollapsibleReviewSection title="Play-Off Summary" delay={0.2}>
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
              <span className="font-semibold text-accent-green">
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

        <CollapsibleReviewSection title="Play-Off Bracket" delay={0.25}>
          <div className="space-y-3 text-left text-sm">
            {playoffResult.rounds.map((round) => (
              <div
                key={`${round.round}-${round.roundIndex}`}
                className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-3 py-2"
              >
                <p className="font-display text-xs font-bold uppercase tracking-wider text-accent-green">
                  {round.round}
                </p>
                {round.userPlayed ? (
                  <>
                    <p className="mt-1 text-gray-300">
                      vs {round.opponent}{" "}
                      {round.isNeutral
                        ? "(Neutral)"
                        : round.isHome
                          ? "(Home)"
                          : "(Away)"}
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {formatFixtureScore(round.fixture)} —{" "}
                      <span
                        className={
                          round.userWon ? "text-accent-green" : "text-red-400"
                        }
                      >
                        {round.userWon ? "Progress" : "Eliminated"}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-gray-500">Bye — straight to semi-finals</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleReviewSection>

        {topScorers.length > 0 && (
          <CollapsibleReviewSection title="Play-Off Try Scorers" delay={0.3}>
            <TryScorersSection
              tryScorers={playoffResult.tryScorers}
              expectedTotalTries={playoffResult.tryScorers.reduce(
                (sum, row) => sum + row.tries,
                0
              )}
            />
          </CollapsibleReviewSection>
        )}

        {(bestScorer || worstScorer) && (
          <CollapsibleReviewSection title="Play-Off Performers" delay={0.32}>
            <div className="grid gap-3 sm:grid-cols-2">
              {bestScorer && (
                <div className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 p-4 text-left">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Best Performer
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {bestScorer.name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {bestScorer.tries} play-off {bestScorer.tries === 1 ? "try" : "tries"}
                  </p>
                </div>
              )}
              {worstScorer && worstScorer.playerId !== bestScorer?.playerId && (
                <div className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 p-4 text-left">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Quietest Performer
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {worstScorer.name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {worstScorer.tries} play-off {worstScorer.tries === 1 ? "try" : "tries"}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleReviewSection>
        )}
      </div>
    </div>
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
