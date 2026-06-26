"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  getMatchesForRound,
  getActiveRound,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { PlayoffMatchDetailsPanel } from "./PlayoffMatchDetailsPanel";
import {
  PlayoffBracketColumnShell,
  PlayoffChampionBanner,
  PlayoffMatchCard,
} from "./PlayoffBracketVisuals";

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

  const activeRound = getActiveRound(state);

  return (
    <div className="w-full">
      {champion && <PlayoffChampionBanner champion={champion} />}

      <div className="playoff-bracket-panel p-3 sm:p-4">
        <div className="overflow-x-auto pb-2 md:overflow-x-visible md:pb-0">
          <div className="mx-auto flex w-full min-w-[min(100%,640px)] max-w-4xl items-stretch justify-between gap-3 sm:gap-4 md:min-w-0 md:max-w-full md:gap-5">
            {ROUNDS.map((round) => (
              <PlayoffBracketColumnShell
                key={round}
                round={round}
                activeRound={activeRound}
              >
                <div
                  className="flex flex-1 flex-col justify-around gap-4"
                  style={{ minHeight: `${Math.max(6, 8 - round) * 60}px` }}
                >
                  {getMatchesForRound(state, round).map((match) => (
                    <PlayoffMatchCard
                      key={match.id}
                      match={match}
                      selected={selectedId === match.id}
                      onSelect={() => {
                        if (match.status !== "complete") return;
                        playUiClick();
                        setSelectedId((prev) =>
                          prev === match.id ? null : match.id
                        );
                      }}
                      isActiveRound={false}
                      interactive
                    />
                  ))}
                </div>
              </PlayoffBracketColumnShell>
            ))}
          </div>
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
