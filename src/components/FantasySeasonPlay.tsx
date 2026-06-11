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
  playSeasonStart,
  playUiClick,
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

  const lastFixture = state.fixtures[state.fixtures.length - 1] ?? null;
  const partialResult = useMemo(
    () => getPartialSeasonResult(state),
    [state]
  );
  const leagueTable = useMemo(
    () => buildLeagueTable(partialResult, state.seed),
    [partialResult, state.seed]
  );

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
    playUiClick();
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
    playUiClick();
    setSimulating(true);
    const next = simulateAllFantasyRounds(state);
    setState(next);
    setSimulating(false);
    finishIfDone(next);
  };

  if (state.currentRound === 0) {
    return (
      <div className={`${CARD.panel} ${SPACING.cardPadding} text-center`}>
        <p className={TYPO.sectionLabel}>Ready to kick off</p>
        <h2 className="mt-2 font-display text-2xl font-black">
          Super League Season
        </h2>
        <p className="mt-3 text-sm text-gray-400">
          {FANTASY_SEASON_ROUNDS} rounds · Simulate one round at a time or play
          out the full season.
        </p>
        <button
          type="button"
          onClick={() => {
            playSeasonStart();
            handleNextRound();
          }}
          className={`mt-6 ${BTN.base} ${BTN.primary}`}
        >
          Start Round 1 →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={TYPO.sectionLabel}>
              Round {Math.min(state.currentRound + 1, FANTASY_SEASON_ROUNDS)} of{" "}
              {FANTASY_SEASON_ROUNDS}
            </p>
            <div className="mt-2 flex gap-6">
              <div>
                <p className="text-xs text-gray-500">Wins</p>
                <p className="font-display text-2xl font-black text-accent-green">
                  {state.wins}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Losses</p>
                <p className="font-display text-2xl font-black text-red-400">
                  {state.losses}
                </p>
              </div>
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
          </div>
        )}
      </div>

      <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <div className="flex items-center justify-between gap-2 md:hidden">
          <h3 className={TYPO.cardTitle}>League Table</h3>
          <button
            type="button"
            onClick={() => {
              playUiClick();
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setShowFixtures((v) => !v);
          }}
          className={`${BTN.base} ${showFixtures ? BTN.primary : BTN.secondary}`}
        >
          {showFixtures ? "Hide" : "View"} Match Results
        </button>
      </div>

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
                    setSelectedFixture((current) =>
                      current?.round === fixture.round ? null : fixture
                    )
                  }
                />
                <AnimatePresence>
                  {selectedFixture?.round === fixture.round && (
                    <MatchDetailsPanel
                      fixture={fixture}
                      seed={state.seed}
                      userSquad={squad}
                      onClose={() => setSelectedFixture(null)}
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
