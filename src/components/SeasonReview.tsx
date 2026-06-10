"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameDifficulty, GameMode, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { getSeasonSummaryMessage } from "@/lib/game/season-simulation";
import { getSeasonGradeFromSquad } from "@/lib/grades";
import { getSeasonReviewLabel } from "@/lib/mode-labels";
import { getClubBreakdownSummary } from "@/lib/squad-analysis";
import { generateSeasonAwards } from "@/lib/season-awards";
import { getSquadValue } from "@/lib/positions";
import { formatValue } from "@/lib/players";
import {
  getTeamComparisonSummary,
} from "@/lib/team-value-comparison";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getSeasonTryTotal } from "@/lib/game/season-tries";
import { formatSeasonWinPercentageOrDash } from "@/lib/stats-views";
import { playGradeSound, playPanelExpand } from "@/lib/sound";
import { ReviewPlayAgain } from "./ReviewPlayAgain";
import { FixtureResultRow } from "./FixtureResultRow";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { Confetti } from "./Confetti";
import { HardModeBadge } from "./HardModeBadge";
import { ClubRepresentation } from "./ClubRepresentation";
import { RLAwardCard } from "./cards/RLAwardCard";
import { ReviewSubmissionNotice } from "./ReviewSubmissionNotice";
import { TeamComparisonBox } from "./TeamComparisonBox";
import { TopTryScorersCard } from "./TopTryScorersCard";
import { SquadSummaryPanel } from "./SquadSummaryPanel";

interface SeasonReviewProps {
  squad: SquadSlot[];
  mode: GameMode;
  seasonResult: SeasonResult;
  seed: string;
  difficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  runRank?: number;
  submittedOnline?: boolean;
  onPlayAgain: () => void;
  onClose: () => void;
}

export function SeasonReview({
  squad,
  mode,
  seasonResult,
  seed,
  difficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  runRank,
  submittedOnline = false,
  onPlayAgain,
  onClose,
}: SeasonReviewProps) {
  const totalValue = getSquadValue(squad);
  const gradeInfo = getSeasonGradeFromSquad(squad, seasonResult, totalValue);
  const filledCount = squad.filter((s) => s.player).length;
  const clubSummary = getClubBreakdownSummary(squad, filledCount, {
    joeMellorMode,
    superSamHallasMode,
  });
  const awards = generateSeasonAwards(squad, seasonResult, {
    joeMellorMode,
    superSamHallasMode,
  });
  const teamComparison = getTeamComparisonSummary(
    "Dream Team",
    getAverageSquadRating(squad),
    totalValue,
    seasonResult.fixtures,
    seed
  );
  const isPerfect = seasonResult.isPerfect;
  const isSuperSquad = gradeInfo.grade === "S" || gradeInfo.grade === "S+";
  const isHardMode = difficulty === "HARD";
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(
    null
  );
  const selectedRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFixture && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedFixture]);
  const showCelebration = isPerfect || isSuperSquad;

  const handlePlayAgain = () => {
    onClose();
    onPlayAgain();
  };

  const gradeSoundPlayed = useRef(false);
  useEffect(() => {
    if (gradeSoundPlayed.current) return;
    gradeSoundPlayed.current = true;
    playGradeSound(gradeInfo.grade);
  }, [gradeInfo.grade]);

  const leaguePositionLabel = formatLeaguePosition(
    seasonResult.leaguePosition
  );
  const summaryMessage = getSeasonSummaryMessage(
    seasonResult.leaguePosition,
    seasonResult.losses,
    seasonResult.wins,
    gradeInfo.grade,
    seasonResult
  );

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
            {getSeasonReviewLabel(mode, difficulty)}
          </p>

          <ReviewSubmissionNotice submittedOnline={submittedOnline} />

          {isHardMode && (
            <div className="mt-3 flex justify-center">
              <HardModeBadge />
            </div>
          )}

          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p
              className="font-display text-5xl font-black uppercase tracking-tight sm:text-6xl"
              style={{
                color: gradeInfo.color,
                fontFamily: "var(--font-display)",
              }}
            >
              {gradeInfo.grade} Grade
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-300">
              {gradeInfo.label}
            </p>
          </motion.div>

          {isPerfect && (
            <>
              <motion.h1
                className="mt-4 font-display text-3xl font-black text-accent-gold sm:text-5xl"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                27-0 ACHIEVED
              </motion.h1>
              {!joeMellorMode && !superSamHallasMode && (
                <motion.p
                  className="mt-2 font-display text-sm font-bold uppercase tracking-[0.25em] text-accent-green"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  Hall of Fame Entry Unlocked
                </motion.p>
              )}
            </>
          )}

          <motion.div
            className="mx-auto mt-5 inline-flex flex-col items-center gap-1 text-sm text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p>
              Record:{" "}
              <span className="font-semibold text-white">
                {seasonResult.wins}-{seasonResult.losses}
              </span>
            </p>
            <p>
              Win Rate:{" "}
              <span className="font-semibold text-white">
                {formatSeasonWinPercentageOrDash(
                  seasonResult.wins,
                  seasonResult.losses
                )}
              </span>
            </p>
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
          </motion.div>

          <motion.p
            className="mx-auto mt-4 max-w-md text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {summaryMessage}
          </motion.p>
        </motion.header>

        <motion.div
          className="mt-6 w-full max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ReviewPlayAgain
            onPlayAgain={handlePlayAgain}
            leaderboardHref={`/leaderboard${isHardMode ? "?difficulty=hard" : ""}`}
            compact
          />
        </motion.div>

        <ReviewSection title="Season Awards" delay={0.35}>
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {awards
              .filter((award) => award.title !== "Top 3 Try Scorers")
              .map((award) => (
                <RLAwardCard
                  key={award.title}
                  title={award.title}
                  variant={award.variant}
                  playerName={award.playerName}
                  club={award.club}
                  detail={award.detail}
                  positionNote={award.positionNote}
                  ratingNote={award.ratingNote}
                  narrative={award.narrative}
                />
              ))}
            <div className="sm:col-span-2">
              <TopTryScorersCard
                tryScorers={seasonResult.tryScorers}
                expectedTotalTries={getSeasonTryTotal(seasonResult.fixtures)}
              />
            </div>
          </div>
        </ReviewSection>

        <ReviewSection title="Results" delay={0.42}>
          <TeamComparisonBox summary={teamComparison} />
          <p className="mb-3 mt-4 text-center text-xs text-gray-500">
            Click any result to view full match details.
          </p>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1 text-left">
            {seasonResult.fixtures.map((fixture) => {
              const isSelected = selectedFixture?.round === fixture.round;
              return (
                <div
                  key={fixture.round}
                  ref={isSelected ? selectedRowRef : undefined}
                >
                  <FixtureResultRow
                    fixture={fixture}
                    onClick={() => {
                      if (!isSelected) playPanelExpand();
                      setSelectedFixture(isSelected ? null : fixture);
                    }}
                    selected={isSelected}
                  />
                  <AnimatePresence initial={false}>
                    {isSelected && (
                      <MatchDetailsPanel
                        key={fixture.round}
                        fixture={fixture}
                        seed={seed}
                        userSquad={squad}
                        onClose={() => setSelectedFixture(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </ReviewSection>

        <ReviewSection title="Squad Summary" delay={0.5}>
          <SquadSummaryPanel squad={squad} revealRatings />
        </ReviewSection>

        <ReviewSection title="Club Representation" delay={0.55}>
          <div className="text-left">
            <ClubRepresentation summary={clubSummary} />
          </div>
        </ReviewSection>

        <motion.footer
          className="mt-8 w-full max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <ReviewPlayAgain
            onPlayAgain={handlePlayAgain}
            leaderboardHref={`/leaderboard${isHardMode ? "?difficulty=hard" : ""}`}
          />
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
