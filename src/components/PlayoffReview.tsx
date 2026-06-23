"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import type { PlayoffBracketState } from "@/lib/game/playoff-bracket";
import { formatRecordWithPercentage } from "@/lib/lifetime-stats";
import { getPlayoffReviewBio } from "@/lib/playoff-review-bio";
import { ReviewPlayAgain } from "./ReviewPlayAgain";
import { ReturnHomeButton } from "./ReturnHomeButton";
import { ClubFundsEarned } from "./ClubFundsEarned";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { TryScorersSection } from "./TryScorersSection";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { PlayoffBracketDisplay } from "./PlayoffBracketDisplay";
import { Confetti } from "./Confetti";
import { TYPO } from "@/lib/ui/typography";
import { NORMAL } from "@/lib/ui/design-system";

interface PlayoffReviewProps {
  squad: SquadSlot[];
  seasonResult: SeasonResult;
  playoffResult: PlayoffResult;
  playoffBracketState?: PlayoffBracketState | null;
  playoffFundsPayout?: ClubFundsPayoutResult | null;
  isHardMode?: boolean;
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
  isHardMode = false,
  onPlayAgain,
  onReturnHome,
}: PlayoffReviewProps) {
  const isChampion = playoffResult.isChampion;
  const titleBio = useMemo(
    () => getPlayoffReviewBio(playoffResult, seasonResult.wins),
    [playoffResult, seasonResult.wins]
  );

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
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
            {titleBio}
          </p>
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
            onPlayAgain={onPlayAgain}
            leaderboardHref={`/leaderboard${isHardMode ? "?difficulty=hard" : ""}`}
            hardMode={isHardMode}
            compact
            hideReturnHome
          />
          <ClubFundsEarned payout={playoffFundsPayout} />
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

        {playoffBracketState && (
          <CollapsibleReviewSection
            title="Play-Off Bracket"
            delay={0.25}
            defaultOpen
            helper="Tap a completed match for scorers and match story."
          >
            <PlayoffBracketDisplay
              state={playoffBracketState}
              championLabel={
                playoffResult.isChampion ? "Dream Team" : playoffResult.finish
              }
            />
          </CollapsibleReviewSection>
        )}

        {topScorers.length > 0 && (
          <CollapsibleReviewSection
            title="Play-Off Try Scorers"
            delay={0.3}
            defaultOpen={false}
          >
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
          <CollapsibleReviewSection
            title="Play-Off Performers"
            delay={0.32}
            defaultOpen={false}
          >
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
                    {bestScorer.tries} play-off{" "}
                    {bestScorer.tries === 1 ? "try" : "tries"}
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
                    {worstScorer.tries} play-off{" "}
                    {worstScorer.tries === 1 ? "try" : "tries"}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleReviewSection>
        )}

        <motion.footer
          className="mt-8 w-full max-w-xl space-y-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ReviewPlayAgain
            onPlayAgain={onPlayAgain}
            leaderboardHref={`/leaderboard${isHardMode ? "?difficulty=hard" : ""}`}
            hardMode={isHardMode}
            hideReturnHome
          />
          <ReturnHomeButton onBeforeNavigate={onReturnHome} />
        </motion.footer>
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
