"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { Player, SquadSlot } from "@/lib/types";
import { DraftPositionsRemaining } from "./DraftPositionsRemaining";
import {
  playGoatAppears,
  playHistoricPlayerAppears,
  playLegendAppears,
  playUiClick,
} from "@/lib/sound";
import { isGoatPlayer } from "@/lib/players/goat";
import { DRAFT_MODE_RULE } from "@/lib/mode-labels";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";
import {
  QuickModePlayerChoiceCard,
  quickPlayerChoiceGridClass,
} from "./QuickModePlayerChoiceCard";
import { GameButton } from "@/components/ui/GameButton";
import { MOBILE } from "@/lib/ui/design-system";

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
  /** When true, a selection boost guaranteed one of these options. */
  boosted?: boolean;
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
  boosted = false,
}: PlayerChoiceProps) {
  const appearSoundPlayed = useRef(false);
  const [displayA, displayB] = useMemo(() => {
    return playerA.peakRating >= playerB.peakRating
      ? [playerA, playerB]
      : [playerB, playerA];
  }, [playerA, playerB]);

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

  const canReroll =
    !hardMode &&
    !!onReroll &&
    !!rerollAvailable &&
    rerollsRemaining > 0 &&
    !disabled;

  const showRespin = !hardMode && !!onReroll;
  const respinLabel =
    rerollsRemaining > 0
      ? `Respin (${rerollsRemaining})`
      : "No respins";

  const handleRespin = () => {
    if (!canReroll || !onReroll) return;
    playUiClick();
    onReroll();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`w-full ${MOBILE.minZero}`}
    >
      <header className="mb-2 text-center sm:mb-3">
        <p className={`${RL_SECTION_TITLE_CLASS} text-[10px] sm:text-xs`}>
          {draftMode ? "Draft Pick" : "Recruitment"}
        </p>
        <h2 className="mt-0.5 font-display text-base font-black uppercase tracking-tight text-white sm:mt-1 sm:text-2xl">
          {positionLabel}
        </h2>
        <p className={`mt-1 ${MOBILE.secondaryCopy}`}>
          {draftMode
            ? "Pick one player — then choose where they play on your team sheet."
            : "Pick one signing — the other walks away forever"}
        </p>
        {showDraftRule && (
          <p className="mx-auto mt-2 hidden max-w-md rounded-lg border border-pitch-600/50 bg-pitch-900/60 px-3 py-2 text-left text-xs text-gray-400 sm:mt-3 sm:block">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-theme-primary">
              Draft Mode
            </span>
            <span className="mt-1 block">{DRAFT_MODE_RULE}</span>
          </p>
        )}

        {draftMode && draftSquad && (
          <div className="mx-auto mt-2 max-w-md sm:mt-3">
            <DraftPositionsRemaining squad={draftSquad} compact />
          </div>
        )}
      </header>

      <div className={quickPlayerChoiceGridClass(2)}>
        <motion.div
          className="h-full min-w-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <QuickModePlayerChoiceCard
            player={displayA}
            choiceLabel="A"
            hardMode={hardMode}
            ratingVisible={!hardMode}
            disabled={disabled}
            boosted={boosted}
            selectLabel="Select"
            onSelect={() => onChoose(displayA)}
          />
        </motion.div>
        <motion.div
          className="h-full min-w-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <QuickModePlayerChoiceCard
            player={displayB}
            choiceLabel="B"
            hardMode={hardMode}
            ratingVisible={!hardMode}
            disabled={disabled}
            boosted={boosted}
            selectLabel="Select"
            onSelect={() => onChoose(displayB)}
          />
        </motion.div>
      </div>

      {showRespin ? (
        <div className="mt-3 flex justify-center sm:mt-4">
          <GameButton
            variant="secondary"
            size="sm"
            fullWidth={false}
            disabled={!canReroll}
            onClick={handleRespin}
            className="min-w-[8.5rem]"
          >
            {respinLabel}
          </GameButton>
        </div>
      ) : null}
    </motion.div>
  );
}
