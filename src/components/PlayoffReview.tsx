"use client";

import { useMemo } from "react";
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
import { ReviewPlayAgain } from "./ReviewPlayAgain";
import { ReturnHomeButton } from "./ReturnHomeButton";
import { ClubFundsEarned } from "./ClubFundsEarned";
import { mergeClubFundsPayouts } from "@/lib/club-funds";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { SquadReviewSection } from "./SquadReviewSection";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { PlayoffBracketDisplay } from "./PlayoffBracketDisplay";
import { Confetti } from "./Confetti";
import { TYPO } from "@/lib/ui/typography";
import { NORMAL } from "@/lib/ui/design-system";

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
  clubFundsPayout = null,
  isHardMode = false,
  onPlayAgain,
  onReturnHome,
}: PlayoffReviewProps) {
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
            <p className="mt-2 text-sm font-semibold text-theme-primary">
              Super League Champions — your squad lifted the trophy.
            </p>
          )}
        </motion.header>

        <motion.div
          className="mt-6 w-full max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ReturnHomeButton onBeforeNavigate={onReturnHome} />
        </motion.div>

        <motion.div
          className="mt-4 w-full max-w-xl"
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
            helper="Tap a completed match for scorers and match story."
          >
            <PlayoffBracketDisplay
              state={playoffBracketState}
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
            hardMode={isHardMode}
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
