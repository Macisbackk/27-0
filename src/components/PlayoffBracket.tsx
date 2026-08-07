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
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
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
import { DocumentPageShell } from "@/components/ui/DocumentPageShell";
import { clearStaleBodyScrollLocks } from "@/lib/ui/document-page-scroll";
import { MOBILE } from "@/lib/ui/design-system";
import {
  PLAYOFF_ROUND_SHORT,
  PlayoffBracketDesktop,
  PlayoffBracketHeader,
  PlayoffMatchCard,
} from "./PlayoffBracketVisuals";
import { resolveSquadClubColorOverride } from "@/lib/players/squad-club-accent";

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
  const dreamTeamColorClub = useMemo(
    () => resolveSquadClubColorOverride(squad),
    [squad]
  );
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
    matchDetailsRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId, state.matches]);

  useEffect(() => {
    clearStaleBodyScrollLocks();
  }, []);

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
    setState(next);
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

  const userClub = state.userClub ?? DREAM_TEAM_NAME;

  return (
    <DocumentPageShell diagnoseLabel="QuickModePlayoffBracket" className={`${MOBILE.actionBarPad} md:pb-8`}>
      <div className="relative w-full py-3 sm:py-8">
        <PlayoffBracketHeader
          activeRound={activeRound}
          tournamentComplete={state.tournamentComplete}
        />

        <div className="playoff-bracket-panel mx-auto mt-2 w-full max-w-[var(--layout-page-compact)] p-1.5 sm:mt-5 sm:p-4 md:mt-6 md:p-5">
        <div className="mx-auto w-full">
          <BracketMobileRoundNav
            rounds={ROUNDS}
            viewRound={mobileViewRound}
            activeRound={activeRound}
            onViewRoundChange={setMobileViewRound}
            getLabel={getPlayoffRoundLabel}
            getShortLabel={(round) =>
              PLAYOFF_ROUND_SHORT[round] ?? getPlayoffRoundLabel(round)
            }
            activeClassName="border-theme-primary/55 bg-theme-primary/12 text-theme-primary"
          />
        </div>

        <div className="mx-auto mt-2 w-full space-y-2.5 md:hidden sm:mt-5 sm:space-y-3">
          {getMatchesForRound(state, mobileViewRound).map((match) => (
            <PlayoffMatchCard
              key={match.id}
              match={match}
              userClub={userClub}
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
              userClub={userClub}
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
                userClubColorOverride={dreamTeamColorClub}
                onClose={() => {
                  playPanelClose();
                  setSelectedId(null);
                  clearStaleBodyScrollLocks();
                }}
              />
            </div>
          )}
        </AnimatePresence>

        <div className="bracket-sticky-actions bracket-actions-center mt-4">
          <div className="bracket-actions-center__group">
            {showProceedToNextRound && (
              <GameButton
                variant="theme"
                size="md"
                fullWidth={false}
                onClick={handleProceedToNextRound}
                className="w-full min-w-[12rem] sm:w-auto md:hidden"
              >
                Proceed to {getPlayoffRoundLabel(activeRound)}
              </GameButton>
            )}
            <GameButton
              variant="secondary"
              size="md"
              fullWidth={false}
              disabled={!canSimRound}
              onClick={handleSimulateRound}
              className={`w-full min-w-[12rem] sm:w-auto disabled:opacity-40 ${
                showProceedToNextRound ? "hidden md:inline-flex" : ""
              }`}
            >
              Simulate Round
            </GameButton>
          </div>
        </div>
      </div>
    </DocumentPageShell>
  );
}
