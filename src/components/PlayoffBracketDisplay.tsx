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
  PlayoffBracketDesktop,
  PlayoffChampionBanner,
  PlayoffMatchCard,
  PlayoffRoundTitle,
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

  const renderMatchCard = (match: (typeof state.matches)[number]) => (
    <PlayoffMatchCard
      match={match}
      selected={selectedId === match.id}
      onSelect={() => {
        if (match.status !== "complete") return;
        playUiClick();
        setSelectedId((prev) => (prev === match.id ? null : match.id));
      }}
      isActiveRound={false}
      interactive
      mobile
    />
  );

  return (
    <div className="w-full">
      {champion && <PlayoffChampionBanner champion={champion} />}

      <div className="playoff-bracket-panel p-3 sm:p-4">
        <div className="space-y-5 md:hidden">
          {ROUNDS.map((round) => (
            <section key={round}>
              <PlayoffRoundTitle round={round} activeRound={activeRound} />
              <div className="mt-3 space-y-3">
                {getMatchesForRound(state, round).map((match) => (
                  <div key={match.id}>{renderMatchCard(match)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <PlayoffBracketDesktop
          rounds={ROUNDS}
          activeRound={activeRound}
          getMatches={(round) => getMatchesForRound(state, round)}
          renderMatch={(match) => renderMatchCard(match)}
        />
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
