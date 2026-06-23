"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  getMatchesForRound,
  getPlayoffRoundLabel,
  type PlayoffBracketMatch,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { PlayoffMatchDetailsPanel } from "./PlayoffMatchDetailsPanel";

const ROUNDS = [1, 2, 3] as const;

interface PlayoffBracketDisplayProps {
  state: PlayoffBracketState;
  championLabel?: string;
}

export function PlayoffBracketDisplay({
  state,
  championLabel,
}: PlayoffBracketDisplayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMatch = selectedId
    ? state.matches.find((m) => m.id === selectedId)
    : null;

  const champion = useMemo(() => {
    const final = state.matches.find(
      (m) => m.round === 3 && m.status === "complete"
    );
    return final?.winner ?? championLabel ?? null;
  }, [state.matches, championLabel]);

  return (
    <div className="w-full">
      {champion && (
        <p className="mb-4 text-center font-display text-sm font-bold text-accent-gold">
          Champion: {champion}
        </p>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex min-w-[640px] max-w-4xl items-stretch justify-between gap-2 sm:gap-4">
          {ROUNDS.map((round) => (
            <div key={round} className="cup-bracket-column relative flex flex-1 flex-col px-1">
              <p className="mb-3 text-center font-display text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:text-xs">
                {getPlayoffRoundLabel(round)}
              </p>
              <div
                className="flex flex-1 flex-col justify-around gap-3"
                style={{ minHeight: `${Math.max(6, 8 - round) * 56}px` }}
              >
                {getMatchesForRound(state, round).map((match) => (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    selected={selectedId === match.id}
                    onSelect={() => {
                      if (match.status !== "complete") return;
                      playUiClick();
                      setSelectedId((prev) => (prev === match.id ? null : match.id));
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
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
  );
}

function BracketMatchCard({
  match,
  selected,
  onSelect,
}: {
  match: PlayoffBracketMatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const isComplete = match.status === "complete";
  const isPending = match.status === "pending";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isComplete}
      className={`cup-bracket-match w-full rounded-lg border text-left transition ${
        selected
          ? "border-accent-green/50 bg-accent-green/10 ring-1 ring-accent-green/30"
          : isComplete
            ? "border-pitch-600/40 bg-pitch-900/40 hover:border-accent-green/40 hover:bg-pitch-900/60"
            : "cursor-default border-pitch-600/40 bg-pitch-900/40 opacity-50"
      }`}
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
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 ${
        isWinner ? "bg-accent-green/10" : isLoser ? "opacity-60" : ""
      }`}
    >
      {team && !isPending ? (
        <ClubDualSwatch club={team} size="xs" />
      ) : (
        <span className="h-3 w-3 shrink-0 rounded-full bg-pitch-700" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[10px] font-semibold sm:text-xs ${
          isUser ? "text-accent-green" : "text-gray-200"
        } ${isWinner ? "text-accent-green" : ""}`}
      >
        {isPending ? "TBD" : team}
      </span>
      {score !== null && (
        <span
          className={`shrink-0 font-display text-xs font-black tabular-nums ${
            isWinner ? "text-accent-green" : "text-gray-400"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}
