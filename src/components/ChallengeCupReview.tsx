"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  CupRunRankingResult,
  GameDifficulty,
  SquadSlot,
} from "@/lib/types";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import {
  formatCupFixtureScore,
  getCupRoundLabel,
} from "@/lib/game/challenge-cup-simulation";
import { getChallengeCupCommentary } from "@/lib/game/challenge-cup-commentary";
import {
  getTournamentPotyNarrative,
  getTournamentWorstNarrative,
} from "@/lib/game/tournament-awards";
import { getClubBreakdownSummary } from "@/lib/squad-analysis";
import { generateSeasonAwards } from "@/lib/season-awards";
import { playGradeSound } from "@/lib/sound";
import { FixtureResultRow } from "./FixtureResultRow";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import type { MatchFixture, SeasonResult } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { ClubRepresentation } from "./ClubRepresentation";
import { Confetti } from "./Confetti";
import { HardModeBadge } from "./HardModeBadge";
import { RLAwardCard } from "./cards/RLAwardCard";
import { BracketRecap } from "./BracketRecap";

interface ChallengeCupReviewProps {
  squad: SquadSlot[];
  cupResult: ChallengeCupResult;
  difficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  cupRankingResult?: CupRunRankingResult;
  onPlayAgain: () => void;
  onClose: () => void;
}

export function ChallengeCupReview({
  squad,
  cupResult,
  difficulty = "NORMAL",
  joeMellorMode = false,
  cupRankingResult,
  onPlayAgain,
  onClose,
}: ChallengeCupReviewProps) {
  const filledCount = squad.filter((s) => s.player).length;
  const clubSummary = getClubBreakdownSummary(squad, filledCount, {
    joeMellorMode,
  });
  const isHardMode = difficulty === "HARD";
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(
    null
  );
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const commentary = getChallengeCupCommentary(cupResult);
  const showCelebration = cupResult.isWinner;
  const userTeamName = cupResult.userClub ?? DREAM_TEAM_NAME;

  const seasonLikeResult: SeasonResult = {
    wins: cupResult.wins,
    losses: cupResult.losses,
    tryScorers: cupResult.tryScorers,
    fixtures: cupResult.fixtures,
    squadStrength: cupResult.squadStrength,
    pointsFor: cupResult.pointsFor,
    pointsAgainst: cupResult.pointsAgainst,
    pointsDifference: cupResult.pointsFor - cupResult.pointsAgainst,
    leaguePosition: 1,
    isPerfect: false,
    longestWinStreak: cupResult.wins,
    longestLosingStreak: cupResult.losses > 0 ? 1 : 0,
    gameResults: cupResult.fixtures.map((f) => f.result),
    insights: [],
  };

  const CUP_AWARD_TITLES: Record<string, string> = {
    "Player of the Season": "Player Of The Tournament",
    "Worst Player of the Season": "Worst Player Of The Tournament",
    "Top 3 Try Scorers": "Top Try Scorers",
  };

  const awards = generateSeasonAwards(squad, seasonLikeResult)
    .filter((a) => a.title in CUP_AWARD_TITLES)
    .map((a) => {
      const title = CUP_AWARD_TITLES[a.title] ?? a.title;
      let narrative = a.narrative;
      if (a.title === "Player of the Season") {
        narrative = getTournamentPotyNarrative(cupResult, a.playerName);
      } else if (a.title === "Worst Player of the Season") {
        narrative = getTournamentWorstNarrative(cupResult, a.playerName);
      }
      return { ...a, title, narrative };
    });

  useEffect(() => {
    if (selectedFixture && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedFixture]);

  useEffect(() => {
    playGradeSound(cupResult.isWinner ? "S+" : cupResult.finish === "Runners-Up" ? "A" : "C");
  }, [cupResult.isWinner, cupResult.finish]);

  const handlePlayAgain = () => {
    onClose();
    onPlayAgain();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md">
      {showCelebration && <Confetti />}

      <div className="stadium-lights pointer-events-none fixed inset-0" />
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-8 sm:py-12">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl text-center"
        >
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
            Challenge Cup Review
          </p>

          {isHardMode && (
            <div className="mt-3 flex justify-center">
              <HardModeBadge />
            </div>
          )}

          <h1 className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-accent-gold sm:text-5xl">
            Challenge Cup Review
          </h1>

          <p className="mt-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-accent-green">
            {cupResult.isWinner ? "Winner" : "Tournament Finish"}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
            {cupResult.resultLabel}
          </p>

          <motion.div
            className="mx-auto mt-5 inline-flex flex-col items-center gap-1 text-sm text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>
              Tournament Record:{" "}
              <span className="font-semibold text-white">
                {cupResult.wins}-{cupResult.losses}
              </span>
            </p>
            <p>
              Matches Played:{" "}
              <span className="font-semibold text-white">
                {cupResult.matchesPlayed}
              </span>
            </p>
            <p>
              Current Cup Ranking:{" "}
              <span className="font-semibold text-white">
                {cupRankingResult?.cupWinsRank
                  ? `#${cupRankingResult.cupWinsRank}`
                  : "—"}
              </span>
            </p>
            {(cupRankingResult?.newPersonalBests.length ?? 0) > 0 && (
              <p className="font-display text-xs font-bold uppercase tracking-wider text-accent-green">
                ▲ New Personal Best
                {cupRankingResult!.newPersonalBests.length > 1
                  ? "s"
                  : ""}
                {cupRankingResult!.newPersonalBests.length > 1 && (
                  <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-gray-400">
                    {cupRankingResult!.newPersonalBests.join(" · ")}
                  </span>
                )}
              </p>
            )}
            {(cupRankingResult?.newRecords.length ?? 0) > 0 && (
              <p className="font-display text-xs font-bold uppercase tracking-wider text-accent-gold">
                🏆 New Challenge Cup Record
                {cupRankingResult!.newRecords.length > 1 && (
                  <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-gray-400">
                    {cupRankingResult!.newRecords.join(" · ")}
                  </span>
                )}
              </p>
            )}
          </motion.div>

          <motion.p
            className="mx-auto mt-4 max-w-md text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {commentary}
          </motion.p>
        </motion.header>

        <ReviewSection title="Tournament Awards" delay={0.35}>
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {awards.map((award) => (
              <RLAwardCard
                key={award.title}
                title={award.title}
                variant={award.variant}
                playerName={award.playerName}
                club={award.club}
                detail={award.detail}
                narrative={award.narrative}
                rankedLines={award.rankedLines}
                className={
                  award.title === "Top Try Scorers" ? "sm:col-span-2" : ""
                }
              />
            ))}
          </div>
        </ReviewSection>

        <ReviewSection title="Tournament Results" delay={0.45}>
          <p className="mb-3 text-center text-xs text-gray-500">
            Click any result to view full match details.
          </p>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1 text-left">
            {cupResult.fixtures.map((fixture) => {
              const isSelected = selectedFixture?.round === fixture.round;
              const displayFixture = {
                ...fixture,
                round: fixture.round,
              };
              return (
                <div
                  key={fixture.round}
                  ref={isSelected ? selectedRowRef : undefined}
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent-green/80">
                    {getCupRoundLabel(fixture.round)}
                  </p>
                  <FixtureResultRow
                    fixture={displayFixture}
                    showRound={false}
                    userTeamName={userTeamName}
                    onClick={() =>
                      setSelectedFixture(isSelected ? null : fixture)
                    }
                    selected={isSelected}
                  />
                  <AnimatePresence initial={false}>
                    {isSelected && (
                      <MatchDetailsPanel
                        key={fixture.round}
                        fixture={fixture}
                        userTeamName={userTeamName}
                        onClose={() => setSelectedFixture(null)}
                        roundLabel={getCupRoundLabel(fixture.round)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </ReviewSection>

        {cupResult.bracketMatches && cupResult.bracketMatches.length > 0 && (
          <ReviewSection title="Bracket Recap" delay={0.5}>
            <BracketRecap
              matches={cupResult.bracketMatches}
              userClub={userTeamName}
              byeTeams={cupResult.byeTeams}
            />
          </ReviewSection>
        )}

        <ReviewSection title="Club Representation" delay={0.55}>
          <ClubRepresentation summary={clubSummary} />
        </ReviewSection>

        <motion.footer
          className="mt-8 w-full max-w-xl space-y-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <button
            type="button"
            onClick={handlePlayAgain}
            className="btn-play-again w-full py-4 text-lg"
          >
            Play Again
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/" className="btn-secondary text-center">
              Return Home
            </Link>
            <Link href="/leaderboard" className="btn-secondary text-center">
              Leaderboard
            </Link>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <motion.section
      className="mt-6 w-full max-w-2xl matchday-panel p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <h3 className="mb-4 text-center font-display text-sm font-bold uppercase tracking-wider text-accent-green">
        {title}
      </h3>
      {children}
    </motion.section>
  );
}
