"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Player, SquadSlot } from "@/lib/types";
import { DraftPositionsRemaining } from "./DraftPositionsRemaining";
import { POSITION_LABELS } from "@/lib/positions";
import {
  playGoatAppears,
  playHistoricPlayerAppears,
  playLegendAppears,
} from "@/lib/sound";
import { isGoatPlayer } from "@/lib/players/goat";
import { DRAFT_MODE_RULE } from "@/lib/mode-labels";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";
import { PlayerCard } from "./PlayerCard";
import { PlayerDetailModal } from "./PlayerDetailModal";

interface PlayerChoiceProps {
  playerA: Player;
  playerB: Player;
  positionLabel: string;
  onChoose: (player: Player) => void;
  onReroll?: () => void;
  rerollAvailable?: boolean;
  rerollsRemaining?: number;
  disabled?: boolean;
  hardMode?: boolean;
  draftMode?: boolean;
  showDraftRule?: boolean;
  draftSquad?: SquadSlot[];
}

export function PlayerChoice({
  playerA,
  playerB,
  positionLabel,
  onChoose,
  onReroll,
  rerollAvailable,
  rerollsRemaining = 0,
  disabled,
  hardMode,
  draftMode,
  showDraftRule,
  draftSquad,
}: PlayerChoiceProps) {
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const appearSoundPlayed = useRef(false);

  useEffect(() => {
    appearSoundPlayed.current = false;
  }, [playerA.id, playerB.id]);

  useEffect(() => {
    if (appearSoundPlayed.current) return;
    const players = [playerA, playerB];
    const hasGoat = players.some((p) => isGoatPlayer(p));
    const hasLegend = players.some((p) => p.category === "legend");
    const hasHistoric = players.some((p) => p.category === "historic");
    if (hasGoat) {
      playGoatAppears();
      appearSoundPlayed.current = true;
    } else if (hasLegend) {
      playLegendAppears();
      appearSoundPlayed.current = true;
    } else if (hasHistoric) {
      playHistoricPlayerAppears();
      appearSoundPlayed.current = true;
    }
  }, [playerA, playerB]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full"
    >
      <header className="mb-3 border-b border-pitch-600/40 pb-3 text-center sm:mb-6 sm:pb-5">
        <p className={`${RL_SECTION_TITLE_CLASS} text-[10px] sm:text-xs`}>
          {draftMode ? "Draft Pick" : "Recruitment"}
        </p>
        <h2 className="mt-1 font-display text-lg font-black uppercase tracking-tight text-white sm:mt-2 sm:text-3xl">
          {draftMode ? positionLabel : positionLabel}
        </h2>
        <p className="mt-1 hidden text-sm text-gray-400 sm:mt-2 sm:block">
          {draftMode
            ? "Pick a player, then choose where to place them on the team sheet."
            : "Pick one signing — the other walks away forever"}
        </p>
        {showDraftRule && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-pitch-600/50 bg-pitch-900/60 px-3 py-2 text-left text-xs text-gray-400">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-green">
              Draft Mode
            </span>
            <span className="mt-1 block">{DRAFT_MODE_RULE}</span>
          </p>
        )}

        {draftMode && draftSquad && (
          <div className="mx-auto mt-3 max-w-md sm:mt-4">
            <DraftPositionsRemaining squad={draftSquad} compact />
          </div>
        )}

        {!hardMode && (
          <div className="mx-auto mt-2 inline-flex items-center gap-2 rounded-lg border border-pitch-600/50 bg-pitch-900/60 px-3 py-1.5 sm:mt-4 sm:gap-3 sm:px-4 sm:py-2">
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500 sm:text-[10px] sm:tracking-[0.2em]">
              Rerolls Remaining
            </span>
            <span
              className={`font-display text-xs font-bold sm:text-sm ${
                rerollsRemaining > 0 ? "text-accent-green" : "text-gray-500"
              }`}
            >
              {rerollsRemaining}
            </span>
          </div>
        )}
      </header>

      {!hardMode && onReroll && (
        <div className="mb-3 flex justify-center sm:mb-5">
          <button
            type="button"
            onClick={onReroll}
            disabled={disabled || !rerollAvailable || rerollsRemaining <= 0}
            className={`rounded-lg border px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition sm:px-5 sm:py-2.5 sm:text-xs sm:tracking-[0.18em] ${
              rerollAvailable && rerollsRemaining > 0 && !disabled
                ? "border-accent-green/50 bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
                : "cursor-not-allowed border-pitch-700/60 bg-pitch-900/50 text-gray-600"
            }`}
          >
            Reroll
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-5 md:gap-6">
        <ChoiceCard
          player={playerA}
          label="A"
          onChoose={() => onChoose(playerA)}
          onViewDetails={() => setDetailPlayer(playerA)}
          disabled={disabled}
          hardMode={hardMode}
        />
        <ChoiceCard
          player={playerB}
          label="B"
          onChoose={() => onChoose(playerB)}
          onViewDetails={() => setDetailPlayer(playerB)}
          disabled={disabled}
          hardMode={hardMode}
        />
      </div>

      {detailPlayer && (
        <PlayerDetailModal
          player={detailPlayer}
          onClose={() => setDetailPlayer(null)}
        />
      )}
    </motion.div>
  );
}

function ChoiceCard({
  player,
  label,
  onChoose,
  onViewDetails,
  disabled,
  hardMode,
}: {
  player: Player;
  label: string;
  onChoose: () => void;
  onViewDetails: () => void;
  disabled?: boolean;
  hardMode?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="group flex h-full w-full min-w-0 flex-col text-left"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-1 flex min-h-[16px] items-center justify-between px-0.5 sm:mb-2 sm:min-h-[22px] sm:px-1">
        <span className="font-display text-[9px] font-bold uppercase tracking-wider text-gray-500 sm:text-[11px]">
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          {!hardMode && (
            <span
              role="button"
              tabIndex={0}
              className="rounded-full border border-pitch-600/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 transition hover:border-accent-green/40 hover:text-accent-green sm:text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onViewDetails();
                }
              }}
            >
              Info
            </span>
          )}
          <span className="hidden rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] font-semibold text-accent-green opacity-0 transition group-hover:opacity-100 sm:inline">
            Sign →
          </span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg transition sm:min-h-[400px] group-hover:opacity-95">
        <PlayerCard
          player={player}
          selectable
          hardMode={hardMode}
          equalHeight
          compactMobile
        />
      </div>
      <p className="mt-1 hidden min-h-[16px] text-center text-[11px] text-gray-500 sm:block">
        {POSITION_LABELS[player.position]} · Tap to sign
      </p>
    </motion.button>
  );
}
