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
      <header className="mb-6 border-b border-pitch-600/40 pb-5 text-center">
        <p className={RL_SECTION_TITLE_CLASS}>Recruitment</p>
        <h2 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          {positionLabel}
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Pick one signing — the other walks away forever
        </p>

        {!hardMode && (
          <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-lg border border-pitch-600/50 bg-pitch-900/60 px-4 py-2">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Position Rerolls
            </span>
            {rerollUsed ? (
              <span className="font-display text-xs font-bold uppercase tracking-wider text-gray-500">
                Used
              </span>
            ) : (
              <span className="font-display text-sm font-bold text-accent-green">
                1 Available
              </span>
            )}
          </div>
        )}
      </header>

      {!hardMode && onReroll && (
        <div className="mb-5 flex justify-center">
          <button
            type="button"
            onClick={onReroll}
            disabled={disabled || !rerollAvailable || rerollUsed}
            className={`rounded-lg border px-5 py-2.5 font-display text-xs font-bold uppercase tracking-[0.18em] transition ${
              rerollAvailable && !rerollUsed && !disabled
                ? "border-accent-green/50 bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
                : "cursor-not-allowed border-pitch-700/60 bg-pitch-900/50 text-gray-600"
            }`}
          >
            {rerollUsed ? "Reroll Used" : "Reroll Position"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-6">
        <ChoiceCard
          player={playerA}
          label="Option A"
          onChoose={() => onChoose(playerA)}
          disabled={disabled}
          hardMode={hardMode}
        />
        <ChoiceCard
          player={playerB}
          label="Option B"
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
      className="group flex h-full w-full flex-col text-left"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.995 }}
    >
      <div className="mb-2 flex min-h-[22px] items-center justify-between px-1">
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <span className="rounded-full bg-accent-green/20 px-2.5 py-0.5 text-[10px] font-semibold text-accent-green opacity-0 transition group-hover:opacity-100">
          Sign →
        </span>
      </div>
      <div className="flex min-h-[380px] flex-1 flex-col overflow-hidden rounded-lg transition sm:min-h-[400px] group-hover:opacity-95">
        <PlayerCard
          player={player}
          selectable
          hardMode={hardMode}
          equalHeight
        />
      </div>
      <p className="mt-2 min-h-[16px] text-center text-[11px] text-gray-500">
        {POSITION_LABELS[player.position]} · Tap to sign
      </p>
    </motion.button>
  );
}
