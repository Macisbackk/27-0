"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Player } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import { playHistoricPlayerAppears, playLegendAppears } from "@/lib/sound";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";
import { PlayerCard } from "./PlayerCard";

interface PlayerChoiceProps {
  playerA: Player;
  playerB: Player;
  positionLabel: string;
  onChoose: (player: Player) => void;
  onReroll?: () => void;
  rerollAvailable?: boolean;
  rerollUsed?: boolean;
  disabled?: boolean;
  hardMode?: boolean;
  draftMode?: boolean;
}

export function PlayerChoice({
  playerA,
  playerB,
  positionLabel,
  onChoose,
  onReroll,
  rerollAvailable,
  rerollUsed,
  disabled,
  hardMode,
  draftMode,
}: PlayerChoiceProps) {
  const appearSoundPlayed = useRef(false);

  useEffect(() => {
    appearSoundPlayed.current = false;
  }, [playerA.id, playerB.id]);

  useEffect(() => {
    if (appearSoundPlayed.current) return;
    const hasLegend = [playerA, playerB].some((p) => p.category === "legend");
    const hasHistoric = [playerA, playerB].some((p) => p.category === "historic");
    if (hasLegend) {
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
          {draftMode ? `Recruiting: ${positionLabel}` : positionLabel}
        </h2>
        <p className="mt-1 hidden text-sm text-gray-400 sm:mt-2 sm:block">
          Pick one signing — the other walks away forever
        </p>

        {!hardMode && (
          <div className="mx-auto mt-2 inline-flex items-center gap-2 rounded-lg border border-pitch-600/50 bg-pitch-900/60 px-3 py-1.5 sm:mt-4 sm:gap-3 sm:px-4 sm:py-2">
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500 sm:text-[10px] sm:tracking-[0.2em]">
              Rerolls
            </span>
            {rerollUsed ? (
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:text-xs">
                Used
              </span>
            ) : (
              <span className="font-display text-xs font-bold text-accent-green sm:text-sm">
                1
              </span>
            )}
          </div>
        )}
      </header>

      {!hardMode && onReroll && (
        <div className="mb-3 flex justify-center sm:mb-5">
          <button
            type="button"
            onClick={onReroll}
            disabled={disabled || !rerollAvailable || rerollUsed}
            className={`rounded-lg border px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition sm:px-5 sm:py-2.5 sm:text-xs sm:tracking-[0.18em] ${
              rerollAvailable && !rerollUsed && !disabled
                ? "border-accent-green/50 bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
                : "cursor-not-allowed border-pitch-700/60 bg-pitch-900/50 text-gray-600"
            }`}
          >
            {rerollUsed ? "Used" : "Reroll"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-5 md:gap-6">
        <ChoiceCard
          player={playerA}
          label="A"
          onChoose={() => onChoose(playerA)}
          disabled={disabled}
          hardMode={hardMode}
        />
        <ChoiceCard
          player={playerB}
          label="B"
          onChoose={() => onChoose(playerB)}
          disabled={disabled}
          hardMode={hardMode}
        />
      </div>
    </motion.div>
  );
}

function ChoiceCard({
  player,
  label,
  onChoose,
  disabled,
  hardMode,
}: {
  player: Player;
  label: string;
  onChoose: () => void;
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
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.995 }}
    >
      <div className="mb-1 flex min-h-[16px] items-center justify-between px-0.5 sm:mb-2 sm:min-h-[22px] sm:px-1">
        <span className="font-display text-[9px] font-bold uppercase tracking-wider text-gray-500 sm:text-[11px]">
          {label}
        </span>
        <span className="hidden rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] font-semibold text-accent-green opacity-0 transition group-hover:opacity-100 sm:inline">
          Sign →
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
