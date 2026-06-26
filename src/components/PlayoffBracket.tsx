"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  type PlayoffBracketMatch,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playPanelClose,
  playSimulateRound,
  playUiClick,
} from "@/lib/sound";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { PlayoffMatchDetailsPanel } from "./PlayoffMatchDetailsPanel";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { GameButton } from "./ui/GameButton";

const PLAYOFF_ROUND_SHORT: Record<number, string> = {
  1: "EF",
  2: "SF",
  3: "GF",
};

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

  const canSimSelected =
    selectedId !== null && canSimulatePlayoffMatch(state, selectedId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md">
      <div className="stadium-lights pointer-events-none fixed inset-0" />
      <div className="relative mx-auto w-full max-w-5xl px-2 py-5 pb-28 sm:px-4 sm:py-8 md:pb-8">
        <div className="bracket-header-panel rounded-xl border border-pitch-600/45 bg-pitch-900/55 px-4 py-4 text-center backdrop-blur-sm sm:py-5">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green">
            Super League Play-Offs
          </p>
          <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">
            Knockout Bracket
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {state.tournamentComplete
              ? "Play-offs complete"
              : `${getPlayoffRoundLabel(activeRound)} — simulate matches to advance`}
          </p>
          <div className="mx-auto mt-3 flex max-w-lg flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-[10px] font-semibold text-accent-green">
              1st & 2nd — Semi-Final Bye
            </span>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-3xl">
          <BracketMobileRoundNav
            rounds={ROUNDS}
            viewRound={mobileViewRound}
            activeRound={activeRound}
            onViewRoundChange={setMobileViewRound}
            getLabel={getPlayoffRoundLabel}
            getShortLabel={(round) =>
              PLAYOFF_ROUND_SHORT[round] ?? getPlayoffRoundLabel(round)
            }
            activeClassName="border-accent-green/55 bg-accent-green/12 text-accent-green"
          />
        </div>

        <div className="mx-auto mt-5 max-w-3xl space-y-3 md:hidden">
          <p className="text-center font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {getPlayoffRoundLabel(mobileViewRound)}
          </p>
          {getMatchesForRound(state, mobileViewRound).map((match) => (
            <BracketMatchCard
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

        <div className="mt-6 hidden overflow-x-auto pb-4 md:block">
          <div className="mx-auto flex min-w-0 max-w-4xl items-stretch justify-between gap-2 sm:gap-4">
            {ROUNDS.map((round) => (
              <BracketRoundColumn
                key={round}
                round={round}
                matches={getMatchesForRound(state, round)}
                selectedId={selectedId}
                state={state}
                onSelect={(id) =>
                  setSelectedId((prev) => {
                    const next = prev === id ? null : id;
                    if (next !== null) playUiClick();
                    return next;
                  })
                }
                onSimulateMatch={handleSimulateMatch}
                activeRound={activeRound}
              />
            ))}
          </div>
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
              variant="current"
              size="md"
              disabled={!canSimSelected}
              onClick={() => selectedId && handleSimulateMatch(selectedId)}
              className={`w-full sm:w-auto disabled:opacity-40 ${
                showProceedToNextRound ? "hidden md:inline-flex" : ""
              }`}
            >
              Simulate Selected Match
            </GameButton>
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

function BracketRoundColumn({
  round,
  matches,
  selectedId,
  onSelect,
  onSimulateMatch,
  state,
  activeRound,
}: {
  round: number;
  matches: PlayoffBracketMatch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSimulateMatch: (id: string) => void;
  state: PlayoffBracketState;
  activeRound: number;
}) {
  return (
    <div className="cup-bracket-column relative flex flex-1 flex-col px-1">
      <p
        className={`mb-3 text-center font-display text-[10px] font-bold uppercase tracking-wider sm:text-xs ${
          round === activeRound ? "text-accent-green" : "text-gray-500"
        }`}
      >
        {getPlayoffRoundLabel(round)}
      </p>
      <div
        className="flex flex-1 flex-col justify-around gap-3"
        style={{ minHeight: `${Math.max(6, 8 - round) * 56}px` }}
      >
        {matches.map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            selected={selectedId === match.id}
            onSelect={() => {
              if (
                match.status === "ready" &&
                canSimulatePlayoffMatch(state, match.id)
              ) {
                onSimulateMatch(match.id);
                return;
              }
              if (match.status === "complete") {
                onSelect(match.id);
              }
            }}
            isActiveRound={round === activeRound}
          />
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  selected,
  onSelect,
  isActiveRound,
  mobile = false,
}: {
  match: PlayoffBracketMatch;
  selected: boolean;
  onSelect: () => void;
  isActiveRound: boolean;
  mobile?: boolean;
}) {
  const isComplete = match.status === "complete";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className={`cup-bracket-match w-full rounded-xl border text-left transition ${
        mobile ? "min-h-[88px] shadow-sm" : "rounded-lg"
      } ${
        selected
          ? "border-accent-green/50 bg-accent-green/10 ring-1 ring-accent-green/30"
          : isReady && isActiveRound
            ? "border-accent-green/30 bg-pitch-900/60 hover:border-accent-green/50"
            : "border-pitch-600/40 bg-pitch-900/40 hover:border-pitch-500/50"
      } ${isPending ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      <BracketTeamRow
        team={match.homeTeam}
        score={match.homeScore}
        isWinner={isComplete && match.winner === match.homeTeam}
        isLoser={isComplete && match.loser === match.homeTeam}
        isUser={match.homeTeam === DREAM_TEAM_NAME}
        isPending={isPending && !match.homeTeam}
        mobile={mobile}
      />
      <div className="border-t border-pitch-600/30" />
      <BracketTeamRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={isComplete && match.winner === match.awayTeam}
        isLoser={isComplete && match.loser === match.awayTeam}
        isUser={match.awayTeam === DREAM_TEAM_NAME}
        isPending={isPending && !match.awayTeam}
        mobile={mobile}
      />
      {isPending && (
        <p className="border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-gray-500">
          Pending
        </p>
      )}
      {isReady && match.isUserMatch && (
        <p className="border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-accent-green">
          Your Match
        </p>
      )}
      {match.isNeutral && isComplete && (
        <p className="border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-gray-500">
          Neutral
        </p>
      )}
    </button>
  );
}

function BracketTeamRow({
  team,
  score,
  isWinner,
  isLoser,
  isUser,
  isPending,
  mobile = false,
}: {
  team: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isUser: boolean;
  isPending: boolean;
  mobile?: boolean;
}) {
  const label = isPending ? "TBD" : (team ?? "TBD");
  const swatchClub = team && team !== DREAM_TEAM_NAME ? team : "Wigan Warriors";

  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        mobile ? "px-3 py-2.5" : "px-2 py-1.5 sm:px-3 sm:py-2"
      } ${isWinner ? "bg-accent-green/10" : isLoser ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!isPending && team && (
          <ClubDualSwatch club={swatchClub} size="xs" />
        )}
        <span
          className={`min-w-0 break-words font-semibold leading-snug ${
            mobile ? "text-xs" : "truncate text-[10px] sm:text-xs"
          } ${isUser ? "text-accent-green" : isPending ? "text-gray-500" : "text-gray-200"}`}
        >
          {label}
        </span>
      </div>
      <span
        className={`shrink-0 font-display text-sm font-bold ${
          isWinner ? "text-accent-green" : "text-gray-400"
        }`}
      >
        {score !== null ? score : "—"}
      </span>
    </div>
  );
}
