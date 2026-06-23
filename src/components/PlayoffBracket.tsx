"use client";

import { useCallback, useMemo, useState } from "react";
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

interface PlayoffBracketProps {
  squad: SquadSlot[];
  seed: string;
  leagueTable: import("@/lib/game/league-table").LeagueTableRow[];
  leaguePosition: number;
  onComplete: (result: PlayoffResult, finalState: PlayoffBracketState) => void;
  initialState?: PlayoffBracketState;
}

const ROUNDS = [1, 2, 3] as const;

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

  const handleSimulateMatch = useCallback(
    (matchId: string) => {
      if (!canSimulatePlayoffMatch(state, matchId)) return;
      playSimulateRound();
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
    },
    [state, squad, finishIfComplete]
  );

  const handleSimulateRound = useCallback(() => {
    playSimulateRound();
    const next = simulatePlayoffBracketRound(state, activeRound, squad);
    setState(next);
    finishIfComplete(next);
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
      <div className="relative mx-auto w-full max-w-5xl px-2 py-6 sm:px-4 sm:py-8">
        <div className="text-center">
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
        </div>

        <div className="mx-auto mt-3 flex max-w-lg flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-[10px] font-semibold text-accent-green">
            1st & 2nd — Semi-Final Bye
          </span>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!canSimSelected}
            onClick={() => selectedId && handleSimulateMatch(selectedId)}
            className="rounded-lg border border-accent-green/50 bg-accent-green/10 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
          >
            Simulate Selected Match
          </button>
          <button
            type="button"
            disabled={!canSimRound}
            onClick={handleSimulateRound}
            className="rounded-lg border border-pitch-600 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-gray-300 transition hover:border-accent-green/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
          >
            Simulate Round
          </button>
        </div>

        <div className="mt-6 overflow-x-auto pb-4">
          <div className="mx-auto flex min-w-[640px] max-w-4xl items-stretch justify-between gap-2 sm:gap-4">
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
            <PlayoffMatchDetailsPanel
              match={selectedMatch}
              onClose={() => {
                playPanelClose();
                setSelectedId(null);
              }}
            />
          )}
        </AnimatePresence>
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
}: {
  match: PlayoffBracketMatch;
  selected: boolean;
  onSelect: () => void;
  isActiveRound: boolean;
}) {
  const isComplete = match.status === "complete";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className={`cup-bracket-match w-full rounded-lg border text-left transition ${
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
      />
      <div className="border-t border-pitch-600/30" />
      <BracketTeamRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={isComplete && match.winner === match.awayTeam}
        isLoser={isComplete && match.loser === match.awayTeam}
        isUser={match.awayTeam === DREAM_TEAM_NAME}
        isPending={isPending && !match.awayTeam}
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
}: {
  team: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isUser: boolean;
  isPending: boolean;
}) {
  const label = isPending ? "TBD" : (team ?? "TBD");
  const swatchClub = team && team !== DREAM_TEAM_NAME ? team : "Wigan Warriors";

  return (
    <div
      className={`flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3 sm:py-2 ${
        isWinner ? "bg-accent-green/10" : isLoser ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {!isPending && team && (
          <ClubDualSwatch club={swatchClub} size="xs" />
        )}
        <span
          className={`truncate text-[10px] font-semibold sm:text-xs ${
            isUser ? "text-accent-green" : isPending ? "text-gray-500" : "text-gray-200"
          }`}
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
