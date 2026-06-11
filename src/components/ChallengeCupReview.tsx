"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  CupRunRankingResult,
  GameDifficulty,
  SquadSlot,
} from "@/lib/types";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-simulation";
import { getChallengeCupCommentary } from "@/lib/game/challenge-cup-commentary";
import {
  getTournamentPotyNarrative,
  getTournamentWorstNarrative,
} from "@/lib/game/tournament-awards";
import { getSquadValue } from "@/lib/positions";
import {
  getAverageSquadRating,
  getClubBreakdownSummary,
} from "@/lib/squad-analysis";
import { generateSeasonAwards } from "@/lib/season-awards";
import { getExtendedTeamComparison } from "@/lib/team-value-comparison";
import { formatValue } from "@/lib/players";
import { getSeasonTryTotal } from "@/lib/game/season-tries";
import { playGradeSound, playPanelExpand } from "@/lib/sound";
import { ReviewPlayAgain } from "./ReviewPlayAgain";
import { FixtureResultRow } from "./FixtureResultRow";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import type { MatchFixture, SeasonResult } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { ClubRepresentation } from "./ClubRepresentation";
import { Confetti } from "./Confetti";
import { HardModeBadge } from "./HardModeBadge";
import { RLAwardCard } from "./cards/RLAwardCard";
import { BracketRecap } from "./BracketRecap";
import { ReviewSubmissionNotice } from "./ReviewSubmissionNotice";
import { TeamComparisonBox } from "./TeamComparisonBox";
import { TeamStatisticsBox } from "./TeamStatisticsBox";
import { CollapsibleReviewSection } from "./CollapsibleReviewSection";
import { TryScorersSection } from "./TryScorersSection";
import { runChallengeCupReviewValidation } from "@/lib/validation/challenge-cup-review-validation";
import { HARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface ChallengeCupReviewProps {
  squad: SquadSlot[];
  cupResult: ChallengeCupResult;
  seed: string;
  difficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  cupRankingResult?: CupRunRankingResult;
  submittedOnline?: boolean;
  onPlayAgain: () => void;
  onClose: () => void;
}

const CUP_AWARD_TITLES: Record<string, string> = {
  "Player of the Season": "Player Of The Tournament",
  "Worst Player of the Season": "Worst Player Of The Tournament",
  "Top 3 Try Scorers": "Top Try Scorers",
};

export function ChallengeCupReview({
  squad,
  cupResult,
  seed,
  difficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  cupRankingResult,
  submittedOnline = false,
  onPlayAgain,
  onClose,
}: ChallengeCupReviewProps) {
  const totalValue = getSquadValue(squad);
  const filledCount = squad.filter((s) => s.player).length;
  const clubSummary = getClubBreakdownSummary(squad, filledCount, {
    joeMellorMode,
    superSamHallasMode,
  });
  const isHardMode = difficulty === "HARD";
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(
    null
  );
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const commentary = getChallengeCupCommentary(cupResult);
  const showCelebration = cupResult.isWinner;
  const userTeamName = cupResult.userClub ?? DREAM_TEAM_NAME;

  const seasonLikeResult: SeasonResult = useMemo(
    () => ({
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
      insights: cupResult.insights ?? [],
      replacedTeam: "",
    }),
    [cupResult]
  );

  const teamComparison = useMemo(
    () =>
      getExtendedTeamComparison(
        userTeamName,
        getAverageSquadRating(squad),
        totalValue,
        cupResult.fixtures,
        seed,
        {
          squad,
          wins: cupResult.wins,
          losses: cupResult.losses,
        }
      ),
    [
      userTeamName,
      squad,
      totalValue,
      cupResult.fixtures,
      cupResult.wins,
      cupResult.losses,
      seed,
    ]
  );

  const awards = useMemo(
    () =>
      generateSeasonAwards(squad, seasonLikeResult, {
        joeMellorMode,
        superSamHallasMode,
      })
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
        })
        .filter(
          (award) =>
            award.title !== "Top Try Scorers" &&
            award.title !== "Top 3 Try Scorers"
        ),
    [squad, seasonLikeResult, joeMellorMode, superSamHallasMode, cupResult]
  );

  useEffect(() => {
    if (selectedFixture && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedFixture]);

  const gradeSoundPlayed = useRef(false);
  useEffect(() => {
    if (gradeSoundPlayed.current) return;
    gradeSoundPlayed.current = true;
    playGradeSound(
      cupResult.isWinner ? "S+" : cupResult.finish === "Runners-Up" ? "A" : "C"
    );
  }, [cupResult.isWinner, cupResult.finish]);

  const handlePlayAgain = () => {
    onClose();
    onPlayAgain();
  };

  const expectedTries = getSeasonTryTotal(cupResult.fixtures);

  useEffect(() => {
    runChallengeCupReviewValidation({
      squad,
      cupResult,
      joeMellorMode,
      superSamHallasMode,
    });
  }, [squad, cupResult, joeMellorMode, superSamHallasMode]);

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

          <ReviewSubmissionNotice submittedOnline={submittedOnline} />

          {isHardMode && (
            <div className={`mt-3 flex justify-center ${HARD.banner} rounded-xl px-4 py-2`}>
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
        </motion.header>

        <motion.div
          className="mt-6 w-full max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ReviewPlayAgain
            onPlayAgain={handlePlayAgain}
            hardMode={isHardMode}
            compact
          />
        </motion.div>

        <CollapsibleReviewSection title="Challenge Cup Summary" delay={0.32}>
          <div className={`mx-auto max-w-md space-y-2 text-center ${TYPO.body}`}>
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
                {cupRankingResult!.newPersonalBests.length > 1 ? "s" : ""}
              </p>
            )}
            <p>
              Total Team Value:{" "}
              <span className="font-semibold text-accent-gold">
                {formatValue(totalValue)}
              </span>
            </p>
            {(cupRankingResult?.newRecords.length ?? 0) > 0 && (
              <p className="font-display text-xs font-bold uppercase tracking-wider text-accent-gold">
                🏆 New Challenge Cup Record
              </p>
            )}
            <p className="pt-2 text-gray-500">{commentary}</p>
          </div>
        </CollapsibleReviewSection>

        {cupResult.bracketMatches && cupResult.bracketMatches.length > 0 && (
          <CollapsibleReviewSection title="Challenge Cup Journey" delay={0.34}>
            <BracketRecap
              matches={cupResult.bracketMatches}
              userClub={userTeamName}
              byeTeams={cupResult.byeTeams}
            />
          </CollapsibleReviewSection>
        )}

        <CollapsibleReviewSection
          title="Tournament Results"
          delay={0.36}
          helper="Click any result to view full match details."
        >
          <div className="max-h-[28rem] space-y-2 overflow-y-auto overflow-x-hidden pr-1 text-left">
            {cupResult.fixtures.map((fixture) => {
              const isSelected = selectedFixture?.round === fixture.round;
              const displayFixture = { ...fixture, round: fixture.round };
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
        </CollapsibleReviewSection>

        <CollapsibleReviewSection title="Team Statistics" delay={0.37}>
          <TeamStatisticsBox
            squad={squad}
            totalValue={totalValue}
            mostExpensiveTeam={teamComparison.mostExpensiveTeam}
            userTeamName={userTeamName}
          />
        </CollapsibleReviewSection>

        <CollapsibleReviewSection
          title="Your Team vs Best Opposition"
          helper="Comparing your final squad against the strongest team you faced this season."
          variant="featured"
          delay={0.38}
        >
          <TeamComparisonBox comparison={teamComparison} />
        </CollapsibleReviewSection>

        <CollapsibleReviewSection title="Player Awards" delay={0.4}>
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {awards.map((award) => (
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

        {cupResult.tryScorers.length > 0 && (
          <CollapsibleReviewSection title="Try Scorers" delay={0.42}>
            <TryScorersSection
              tryScorers={cupResult.tryScorers}
              expectedTotalTries={expectedTries}
            />
          </CollapsibleReviewSection>
        )}

        <CollapsibleReviewSection title="Club Representation" delay={0.46}>
          <ClubRepresentation summary={clubSummary} />
        </CollapsibleReviewSection>

        {(cupRankingResult?.newRecords.length ?? 0) > 0 && (
          <CollapsibleReviewSection title="Records" delay={0.54}>
            <ul className="space-y-2 text-left text-sm text-gray-400">
              {cupRankingResult!.newRecords.map((record) => (
                <li
                  key={record}
                  className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-3 py-2"
                >
                  🏆 {record}
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
            hardMode={isHardMode}
          />
        </motion.footer>
      </div>
    </div>
  );
}
