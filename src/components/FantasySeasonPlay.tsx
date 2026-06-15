"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { MatchFixture, SeasonResult } from "@/lib/game/season-simulation";
import {
  buildFantasySeasonResult,
  formatFantasyRoundResult,
  getPartialSeasonResult,
  simulateAllFantasyRounds,
  simulateNextFantasyRound,
  type FantasySeasonState,
} from "@/lib/game/fantasy-season";
import { buildLeagueTable } from "@/lib/game/league-table";
import { FANTASY_SEASON_ROUNDS } from "@/lib/game/fantasy-mode";
import type { SquadSlot } from "@/lib/types";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playPanelClose,
  playPanelExpand,
  playSimulateAll,
  playSimulateRound,
  playTabChange,
} from "@/lib/sound";
import { LeagueTable } from "./LeagueTable";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import { FixtureResultRow } from "./FixtureResultRow";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface FantasySeasonPlayProps {
  initialState: FantasySeasonState;
  squad: SquadSlot[];
  onComplete: (result: SeasonResult) => void;
}

export function FantasySeasonPlay({
  initialState,
  squad,
  onComplete,
}: FantasySeasonPlayProps) {
  const [state, setState] = useState(initialState);
  const [showTableMobile, setShowTableMobile] = useState(true);
  const [showFixtures, setShowFixtures] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<MatchFixture | null>(
    null
  );
  const [simulating, setSimulating] = useState(false);

  const roundsPlayed = state.fixtures.length;
  const lastFixture = state.fixtures[state.fixtures.length - 1] ?? null;
  const partialResult = useMemo(
    () => getPartialSeasonResult(state),
    [state]
  );
  const leagueTable = useMemo(
    () => buildLeagueTable(partialResult, state.seed),
    [partialResult, state.seed]
  );
  const dreamTeamRow = leagueTable.find((row) => row.isUserTeam);

  const playResultSound = (fixture: MatchFixture) => {
    if (fixture.result === "W") {
      const margin = fixture.pointsFor - fixture.pointsAgainst;
      if (fixture.isUpset) playMatchUpsetVictory();
      else if (fixture.isThrashing || margin >= 20) playMatchBigWin();
      else playMatchNarrowWin();
    } else {
      playMatchDefeat();
    }
  };

  const finishIfDone = (next: FantasySeasonState) => {
    if (next.isComplete) {
      onComplete(buildFantasySeasonResult(next));
    }
  };

  const handleNextRound = () => {
    if (state.isComplete || simulating) return;
    playSimulateRound();
    setSimulating(true);
    const next = simulateNextFantasyRound(state);
    const fixture = next.fixtures[next.fixtures.length - 1];
    if (fixture) playResultSound(fixture);
    setState(next);
    setSimulating(false);
    finishIfDone(next);
  };

  const handleSimulateAll = () => {
    if (state.isComplete || simulating) return;
    playSimulateAll();
    setSimulating(true);
    const next = simulateAllFantasyRounds(state);
    setState(next);
    setSimulating(false);
    finishIfDone(next);
  };

  return (
    <div className="space-y-4">
      <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={TYPO.sectionLabel}>
              {roundsPlayed === 0
                ? `Round 0 of ${FANTASY_SEASON_ROUNDS}`
                : state.isComplete
                  ? `Season complete · ${FANTASY_SEASON_ROUNDS} rounds`
                  : `Round ${roundsPlayed} of ${FANTASY_SEASON_ROUNDS} played`}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 sm:gap-6">
              <StatPill label="Played" value={String(roundsPlayed)} />
              <StatPill
                label="Wins"
                value={String(state.wins)}
                accent="text-accent-green"
              />
              <StatPill
                label="Losses"
                value={String(state.losses)}
                accent="text-red-400"
              />
              <StatPill label="PF" value={String(state.pointsFor)} />
              <StatPill label="PA" value={String(state.pointsAgainst)} />
              <StatPill
                label="Pts"
                value={String(dreamTeamRow?.leaguePoints ?? 0)}
                accent="text-accent-gold"
              />
            </div>
          </div>
          {!state.isComplete && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={simulating}
                onClick={handleNextRound}
                className={`${BTN.base} ${BTN.primary}`}
              >
                Simulate Next Round
              </button>
              <button
                type="button"
                disabled={simulating}
                onClick={handleSimulateAll}
                className={`${BTN.base} ${BTN.secondary}`}
              >
                Simulate All Remaining
              </button>
            </div>
          )}
        </div>

        {roundsPlayed === 0 && (
          <p className="mt-4 text-sm text-gray-400">
            No matches played yet. Simulate the next round to kick off your
            season.
          </p>
        )}

        {lastFixture && (
          <div className="mt-4 rounded-lg border border-pitch-700/50 bg-pitch-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Round {lastFixture.round} Result
            </p>
            <p
              className={`mt-1 font-display text-lg font-bold ${
                lastFixture.result === "W" ? "text-accent-green" : "text-red-400"
              }`}
            >
              {formatFantasyRoundResult(lastFixture)}
            </p>
            {lastFixture.matchBio && (
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                {lastFixture.matchBio}
              </p>
            )}
            {lastFixture.manOfTheMatch && (
              <p className="mt-2 text-sm text-gray-400">
                <span className="font-medium text-accent-gold">
                  Man of the Match:
                </span>{" "}
                {lastFixture.manOfTheMatch.playerName} —{" "}
                {lastFixture.manOfTheMatch.teamName}
                {lastFixture.manOfTheMatch.performanceSummary && (
                  <span className="text-gray-500">
                    {" "}
                    · {lastFixture.manOfTheMatch.performanceSummary}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <div className="flex items-center justify-between gap-2 md:hidden">
          <h3 className={TYPO.cardTitle}>League Table</h3>
          <button
            type="button"
            onClick={() => {
              playTabChange();
              setShowTableMobile((v) => !v);
            }}
            className={`${BTN.base} ${BTN.secondary} px-2 py-1 text-xs`}
          >
            {showTableMobile ? "Hide" : "Show"}
          </button>
        </div>
        <h3 className={`${TYPO.cardTitle} hidden md:block`}>League Table</h3>
        <div
          className={`mt-4 ${showTableMobile ? "block" : "hidden md:block"}`}
        >
          <LeagueTable rows={leagueTable} />
        </div>
      </div>

      {roundsPlayed > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              playTabChange();
              setShowFixtures((v) => !v);
            }}
            className={`${BTN.base} ${showFixtures ? BTN.primary : BTN.secondary}`}
          >
            {showFixtures ? "Hide" : "View"} Match Results
          </button>
        </div>
      )}

      {showFixtures && state.fixtures.length > 0 && (
        <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
          <h3 className={TYPO.cardTitle}>Match Results</h3>
          <ul className="mt-4 space-y-1">
            {state.fixtures.map((fixture) => (
              <li key={fixture.round}>
                <FixtureResultRow
                  fixture={fixture}
                  selected={selectedFixture?.round === fixture.round}
                  onClick={() =>
                    setSelectedFixture((current) => {
                      if (current?.round === fixture.round) {
                        playPanelClose();
                        return null;
                      }
                      playPanelExpand();
                      return fixture;
                    })
                  }
                />
                {fixture.matchBio && selectedFixture?.round !== fixture.round && (
                  <p className="mt-1 px-1 text-xs text-gray-500">
                    {fixture.matchBio}
                  </p>
                )}
                <AnimatePresence>
                  {selectedFixture?.round === fixture.round && (
                    <MatchDetailsPanel
                      fixture={fixture}
                      seed={state.seed}
                      userSquad={squad}
                      onClose={() => {
                        playPanelClose();
                        setSelectedFixture(null);
                      }}
                    />
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-display text-xl font-black sm:text-2xl ${accent}`}>
        {value}
      </p>
    </div>
  );
}
