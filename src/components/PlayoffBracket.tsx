"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import {
  buildPlayoffResult,
  canSimulatePlayoffMatch,
  createPlayoffBracket,
  getActiveRound,
  getMatchesForRound,
  getPlayoffRoundLabel,
  simulatePlayoffBracketMatch,
  simulatePlayoffBracketRound,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playPanelClose,
  playSimulateRound,
  playUiClick,
} from "@/lib/sound";
import { PlayoffMatchDetailsPanel } from "./PlayoffMatchDetailsPanel";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { GameButton } from "./ui/GameButton";
import {
  PLAYOFF_ROUND_SHORT,
  PlayoffBracketDesktop,
  PlayoffBracketHeader,
  PlayoffMatchCard,
} from "./PlayoffBracketVisuals";

interface PlayoffBracketProps {
  squad: SquadSlot[];
  seed: string;
  leagueTable: import("@/lib/game/league-table").LeagueTableRow[];
  leaguePosition: number;
  onComplete: (result: PlayoffResult, finalState: PlayoffBracketState) => void;
  initialState?: PlayoffBracketState;
}

const ROUNDS = [1, 2, 3] as const;

function isPlayoffRoundComplete(
  state: PlayoffBracketState,
  round: number
): boolean {
  const matches = getMatchesForRound(state, round);
  return matches.length > 0 && matches.every((m) => m.status === "complete");
}

function pickMatchForDetails(
  state: PlayoffBracketState,
  round: number
): string | null {
  const roundMatches = getMatchesForRound(state, round);
  const userMatch = roundMatches.find(
    (m) => m.isUserMatch && m.status === "complete"
  );
  if (userMatch) return userMatch.id;
  const lastCompleted = [...roundMatches]
    .reverse()
    .find((m) => m.status === "complete");
  return lastCompleted?.id ?? null;
}

export function PlayoffBracket({
  squad,
  seed,
  leagueTable,
  leaguePosition,
  onComplete,
  initialState,
}: PlayoffBracketProps) {
  const [state, setState] = useState<PlayoffBracketState>(
    () =>
      initialState ??
      createPlayoffBracket(seed, leagueTable, leaguePosition)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileViewRound, setMobileViewRound] = useState(() => getActiveRound(state));
  const matchDetailsRef = useRef<HTMLDivElement>(null);
  const activeRound = getActiveRound(state);

  const selectedMatch = selectedId
    ? state.matches.find((m) => m.id === selectedId)
    : null;

  const finishIfComplete = useCallback(
    (next: PlayoffBracketState) => {
      if (next.tournamentComplete) {
        onComplete(buildPlayoffResult(next, squad), next);
      }
    },
    [onComplete, squad]
  );

  const showProceedToNextRound = useMemo(
    () =>
      !state.tournamentComplete &&
      activeRound > mobileViewRound &&
      isPlayoffRoundComplete(state, mobileViewRound),
    [state, activeRound, mobileViewRound]
  );

  const handleProceedToNextRound = useCallback(() => {
    playUiClick();
    setSelectedId(null);
    setMobileViewRound(activeRound);
  }, [activeRound]);

  useEffect(() => {
    if (!selectedId) return;
    const match = state.matches.find((m) => m.id === selectedId);
    if (match?.status !== "complete") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    matchDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId, state.matches]);

  const handleSimulateMatch = useCallback(
    (matchId: string) => {
      if (!canSimulatePlayoffMatch(state, matchId)) return;
      playSimulateRound();
      const simulatedRound = state.matches.find((m) => m.id === matchId)?.round;
      const next = simulatePlayoffBracketMatch(state, matchId, squad);
      const completed = next.matches.find((m) => m.id === matchId);

      if (completed?.status === "complete" && completed.isUserMatch) {
        const uf = completed.userFixture;
        if (uf?.result === "W") {
          const margin = uf.pointsFor - uf.pointsAgainst;
          if (uf.isThrashing || margin >= 16) playMatchBigWin();
          else playMatchNarrowWin();
        } else {
          playMatchDefeat();
        }
      }

      setState(next);
      setSelectedId(matchId);
      finishIfComplete(next);

      if (
        simulatedRound !== undefined &&
        isPlayoffRoundComplete(next, simulatedRound) &&
        getActiveRound(next) > simulatedRound &&
        window.matchMedia("(max-width: 767px)").matches
      ) {
        // Keep mobile on the finished round until the player taps Proceed.
        setMobileViewRound(simulatedRound);
      }
    },
    [state, squad, finishIfComplete]
  );

  const handleSimulateRound = useCallback(() => {
    playSimulateRound();
    const next = simulatePlayoffBracketRound(state, activeRound, squad);
    const detailsId = pickMatchForDetails(next, activeRound);
    setState(next);
    if (detailsId) setSelectedId(detailsId);
    finishIfComplete(next);

    if (
      isPlayoffRoundComplete(next, activeRound) &&
      getActiveRound(next) > activeRound &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setMobileViewRound(activeRound);
    }
  }, [state, activeRound, squad, finishIfComplete]);

  const canSimRound = useMemo(
    () =>
      !state.tournamentComplete &&
      getMatchesForRound(state, activeRound).some((m) => m.status === "ready"),
    [state, activeRound]
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md">
      <div className="stadium-lights pointer-events-none fixed inset-0" />
      <div className="relative mx-auto w-full max-w-5xl px-2 py-5 pb-28 sm:px-4 sm:py-8 md:pb-8">
        <PlayoffBracketHeader
          activeRound={activeRound}
          tournamentComplete={state.tournamentComplete}
        />

        <div className="playoff-bracket-panel mx-auto mt-5 max-w-4xl p-3 sm:p-4 md:mt-6 md:p-5">
        <div className="mx-auto max-w-3xl">
          <BracketMobileRoundNav
            rounds={ROUNDS}
            viewRound={mobileViewRound}
            activeRound={activeRound}
            onViewRoundChange={setMobileViewRound}
            getLabel={getPlayoffRoundLabel}
            getShortLabel={(round) =>
              PLAYOFF_ROUND_SHORT[round] ?? getPlayoffRoundLabel(round)
            }
            activeClassName="border-mode-current/55 bg-mode-current/12 text-mode-current shadow-[0_0_20px_rgba(34,197,94,0.12)]"
          />
        </div>

        <div className="mx-auto mt-5 max-w-3xl space-y-3 md:hidden">
          {getMatchesForRound(state, mobileViewRound).map((match) => (
            <PlayoffMatchCard
              key={match.id}
              match={match}
              selected={selectedId === match.id}
              onSelect={() => {
                if (
                  match.status === "ready" &&
                  canSimulatePlayoffMatch(state, match.id)
                ) {
                  handleSimulateMatch(match.id);
                  return;
                }
                if (match.status === "complete") {
                  setSelectedId((prev) => {
                    const next = prev === match.id ? null : match.id;
                    if (next !== null) playUiClick();
                    return next;
                  });
                }
              }}
              isActiveRound={mobileViewRound === activeRound}
              mobile
            />
          ))}
        </div>

        <PlayoffBracketDesktop
          rounds={ROUNDS}
          activeRound={activeRound}
          getMatches={(round) => getMatchesForRound(state, round)}
          renderMatch={(match, round) => (
            <PlayoffMatchCard
              key={match.id}
              match={match}
              selected={selectedId === match.id}
              onSelect={() => {
                if (
                  match.status === "ready" &&
                  canSimulatePlayoffMatch(state, match.id)
                ) {
                  handleSimulateMatch(match.id);
                  return;
                }
                if (match.status === "complete") {
                  setSelectedId((prev) => {
                    const next = prev === match.id ? null : match.id;
                    if (next !== null) playUiClick();
                    return next;
                  });
                }
              }}
              isActiveRound={round === activeRound}
            />
          )}
        />
        </div>

        <AnimatePresence>
          {selectedMatch && selectedMatch.status === "complete" && (
            <div ref={matchDetailsRef} className="max-md:mb-4">
              <PlayoffMatchDetailsPanel
                match={selectedMatch}
                onClose={() => {
                  playPanelClose();
                  setSelectedId(null);
                }}
              />
            </div>
          )}
        </AnimatePresence>

        <div className="bracket-sticky-actions mx-auto max-w-3xl md:mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {showProceedToNextRound && (
              <GameButton
                variant="current"
                size="md"
                onClick={handleProceedToNextRound}
                className="w-full sm:w-auto md:hidden"
              >
                Proceed to {getPlayoffRoundLabel(activeRound)}
              </GameButton>
            )}
            <GameButton
              variant="secondary"
              size="md"
              disabled={!canSimRound}
              onClick={handleSimulateRound}
              className={`w-full sm:w-auto disabled:opacity-40 ${
                showProceedToNextRound ? "hidden md:inline-flex" : ""
              }`}
            >
              Simulate Round
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}
