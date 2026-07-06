"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  getMatchesForRound,
  getActiveRound,
  getPlayoffRoundLabel,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { PlayoffMatchDetailsPanel } from "./PlayoffMatchDetailsPanel";
import {
  PLAYOFF_ROUND_SHORT,
  PlayoffBracketDesktop,
  PlayoffBracketHeader,
  PlayoffBracketProgressStrip,
  PlayoffChampionBanner,
  PlayoffMatchCard,
  PlayoffRoundTitle,
} from "./PlayoffBracketVisuals";

const ROUNDS = [1, 2, 3] as const;

interface PlayoffBracketDisplayProps {
  state: PlayoffBracketState;
  championLabel?: string;
  /** Hide the large hero header — use compact progress inside the panel (manager embeds). */
  embedded?: boolean;
}

export function PlayoffBracketDisplay({
  state,
  championLabel,
  embedded = false,
}: PlayoffBracketDisplayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeRound = getActiveRound(state);
  const [viewRound, setViewRound] = useState(activeRound);
  const userClub = state.userClub ?? DREAM_TEAM_NAME;

  useEffect(() => {
    setViewRound((prev) => (prev < activeRound ? activeRound : prev));
  }, [activeRound]);

  const selectedMatch = selectedId
    ? state.matches.find((m) => m.id === selectedId)
    : null;

  const champion = useMemo(() => {
    const final = state.matches.find(
      (m) => m.round === 3 && m.status === "complete"
    );
    return final?.winner ?? championLabel ?? null;
  }, [state.matches, championLabel]);

  const tournamentComplete = state.tournamentComplete;

  const renderMatchCard = (
    match: (typeof state.matches)[number],
    round: number,
    mobile: boolean
  ) => (
    <PlayoffMatchCard
      key={match.id}
      match={match}
      selected={selectedId === match.id}
      userClub={userClub}
      onSelect={() => {
        if (match.status !== "complete") return;
        playUiClick();
        setSelectedId((prev) => (prev === match.id ? null : match.id));
      }}
      isActiveRound={round === activeRound}
      interactive
      mobile={mobile}
    />
  );

  const mobileRoundMatches = getMatchesForRound(state, viewRound);

  return (
    <div className="w-full">
      {champion && <PlayoffChampionBanner champion={champion} />}

      {!embedded && (
        <PlayoffBracketHeader
          activeRound={activeRound}
          tournamentComplete={tournamentComplete}
        />
      )}

      <div className="playoff-bracket-panel p-3 sm:p-4 lg:p-5">
        {embedded && (
          <div className="mb-4 border-b border-pitch-700/40 pb-4">
            <PlayoffBracketProgressStrip
              activeRound={activeRound}
              tournamentComplete={tournamentComplete}
              compact
            />
            <p className="mt-3 text-center text-xs text-pitch-400">
              {tournamentComplete
                ? "Tap a completed tie for match details"
                : `${getPlayoffRoundLabel(activeRound)} in progress — tap finished ties for details`}
            </p>
          </div>
        )}

        <BracketMobileRoundNav
          rounds={ROUNDS}
          viewRound={viewRound}
          activeRound={activeRound}
          onViewRoundChange={setViewRound}
          getLabel={getPlayoffRoundLabel}
          getShortLabel={(round) =>
            PLAYOFF_ROUND_SHORT[round] ?? getPlayoffRoundLabel(round)
          }
          activeClassName="border-theme-primary/55 bg-theme-primary/12 text-theme-primary shadow-[0_0_16px_rgba(34,197,94,0.12)]"
        />

        <div className="mt-4 md:hidden">
          <PlayoffRoundTitle round={viewRound} activeRound={activeRound} />
          <div className="mt-3 space-y-3">
            {mobileRoundMatches.map((match) =>
              renderMatchCard(match, viewRound, true)
            )}
          </div>
          {viewRound < activeRound && (
            <p className="mt-3 text-center text-xs text-pitch-500">
              Round complete — use the tabs above to review earlier ties
            </p>
          )}
        </div>

        <PlayoffBracketDesktop
          rounds={ROUNDS}
          activeRound={activeRound}
          getMatches={(round) => getMatchesForRound(state, round)}
          renderMatch={(match, round) => renderMatchCard(match, round, false)}
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
