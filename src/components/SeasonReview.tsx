"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameDifficulty, GameMode, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { getSeasonSummaryMessage } from "@/lib/game/season-simulation";
import { getGradeReviewBio, getSeasonGradeFromSquad } from "@/lib/grades";
import { getSeasonReviewLabel } from "@/lib/mode-labels";
import { getClubBreakdownSummary } from "@/lib/squad-analysis";
import { generateSeasonAwards } from "@/lib/season-awards";
import { getSquadValue } from "@/lib/positions";
import { formatValue } from "@/lib/players";
import { getExtendedTeamComparison } from "@/lib/team-value-comparison";
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
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { TryScorersSection } from "./TryScorersSection";
import { buildLeagueTable } from "@/lib/game/league-table";
import { LeagueTable } from "./LeagueTable";
import { runSeasonReviewValidation } from "@/lib/validation/season-review-validation";
import { HARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
  const awards = useMemo(
    () =>
      generateSeasonAwards(squad, seasonResult, {
        joeMellorMode,
        superSamHallasMode,
      }),
    [squad, seasonResult, joeMellorMode, superSamHallasMode]
  );
  const teamComparison = useMemo(
    () =>
      getExtendedTeamComparison(
        "Dream Team",
        getAverageSquadRating(squad),
        totalValue,
        seasonResult.fixtures,
        seed,
        {
          squad,
          wins: seasonResult.wins,
          losses: seasonResult.losses,
        }
      ),
    [squad, totalValue, seasonResult.fixtures, seasonResult.wins, seasonResult.losses, seed]
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
  const expectedTries = getSeasonTryTotal(seasonResult.fixtures);
  const leagueTable = useMemo(
    () => buildLeagueTable(seasonResult, seed),
    [seasonResult, seed]
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
          <p
            className={`font-display text-xs font-semibold uppercase tracking-[0.3em] ${
              isHardMode ? HARD.reviewAccent : "text-gray-500"
            }`}
          >
            {getSeasonReviewLabel(mode, difficulty)}
          </p>

          <ReviewSubmissionNotice submittedOnline={submittedOnline} />

          {isHardMode && (
            <div className={`mt-3 flex justify-center ${HARD.banner} rounded-xl px-4 py-2`}>
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
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
              {getGradeReviewBio(
                gradeInfo.grade,
                seasonResult.wins,
                seasonResult.losses
              )}
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

        <CollapsibleReviewSection title="Season Summary" delay={0.32}>
          <div className={`mx-auto max-w-md space-y-2 text-center ${TYPO.body}`}>
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
            <p className="pt-2 text-gray-500">{summaryMessage}</p>
          </div>
        </CollapsibleReviewSection>

        <CollapsibleReviewSection title="League Table" delay={0.34}>
          <LeagueTable rows={leagueTable} />
        </CollapsibleReviewSection>

        <CollapsibleReviewSection
          title="Match History"
          delay={0.36}
          helper="Click any result to view full match details."
        >
          <div className="max-h-[28rem] space-y-2 overflow-y-auto overflow-x-hidden pr-1 text-left">
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
        </CollapsibleReviewSection>

        <CollapsibleReviewSection
          title="Team Comparison"
          variant="featured"
          delay={0.38}
        >
          <TeamComparisonBox comparison={teamComparison} />
        </CollapsibleReviewSection>

        <CollapsibleReviewSection title="Player Awards" delay={0.4}>
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {playerAwards.map((award) => (
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
          </div>
        </CollapsibleReviewSection>

        {seasonResult.tryScorers.length > 0 && (
          <CollapsibleReviewSection title="Try Scorers" delay={0.42}>
            <TryScorersSection
              tryScorers={seasonResult.tryScorers}
              expectedTotalTries={expectedTries}
            />
          </CollapsibleReviewSection>
        )}

        <CollapsibleReviewSection title="Club Representation" delay={0.46}>
          <div className="text-left">
            <ClubRepresentation summary={clubSummary} />
          </div>
        </CollapsibleReviewSection>

        {seasonResult.insights.length > 0 && (
          <CollapsibleReviewSection title="Records" delay={0.52}>
            <ul className="space-y-2 text-left text-sm text-gray-400">
              {seasonResult.insights.map((insight) => (
                <li
                  key={insight}
                  className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-3 py-2"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </CollapsibleReviewSection>
        )}

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
