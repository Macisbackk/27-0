"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Player, SquadSlot } from "@/lib/types";
import { DraftPositionsRemaining } from "./DraftPositionsRemaining";
import { formatPositionFullNames } from "@/lib/players/player-positions";
import {
  playGoatAppears,
  playHistoricPlayerAppears,
  playLegendAppears,
  playUiClick,
} from "@/lib/sound";
import { isGoatPlayer } from "@/lib/players/goat";
import { DRAFT_MODE_RULE } from "@/lib/mode-labels";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";
import { PlayerCard } from "./PlayerCard";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { MOBILE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "@/components/ui/GameButton";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`w-full ${MOBILE.minZero}`}
    >
      <header className="mb-2 text-center sm:mb-4">
        <p className={`${RL_SECTION_TITLE_CLASS} text-[10px] sm:text-xs`}>
          {draftMode ? "Draft Pick" : "Recruitment"}
        </p>
        <h2 className="mt-0.5 font-display text-base font-black uppercase tracking-tight text-white sm:mt-2 sm:text-2xl">
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
          <div className="mx-auto mt-2 max-w-md sm:mt-4">
            <DraftPositionsRemaining squad={draftSquad} compact />
          </div>
        )}
      </header>

      {!hardMode && onReroll ? (
        <div className="mb-2 flex items-center justify-center gap-2 sm:mb-4">
          <span className={`${TYPO.meta} uppercase tracking-wider`}>
            Rerolls{" "}
            <span
              className={
                rerollsRemaining > 0
                  ? "font-bold text-theme-primary"
                  : "font-bold text-pitch-500"
              }
            >
              {rerollsRemaining}
            </span>
          </span>
          <GameButton
            variant="secondary"
            size="sm"
            fullWidth={false}
            disabled={!canReroll}
            className="min-h-[var(--mobile-tap-target)] px-4"
            onClick={() => {
              playUiClick();
              onReroll();
            }}
          >
            Respin
          </GameButton>
        </div>
      ) : null}

      <div className={MOBILE.choiceGrid}>
        <ChoiceCard
          player={displayA}
          label="A"
          onChoose={() => onChoose(displayA)}
          onViewDetails={() => setDetailPlayer(displayA)}
          disabled={disabled}
          hardMode={hardMode}
        />
        <ChoiceCard
          player={displayB}
          label="B"
          onChoose={() => onChoose(displayB)}
          onViewDetails={() => setDetailPlayer(displayB)}
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
      className={`group btn-press flex h-full w-full flex-col text-left disabled:active:scale-100 ${MOBILE.compactCard}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-0.5 flex min-h-[28px] items-center justify-between px-0.5 sm:mb-2 sm:min-h-[22px] sm:px-1">
        <span className="font-display text-[9px] font-bold uppercase tracking-wider text-gray-500 sm:text-[11px]">
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          {!hardMode && (
            <span
              role="button"
              tabIndex={0}
              className="inline-flex min-h-[28px] items-center rounded-full border border-pitch-600/50 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 transition hover:border-theme-primary/40 hover:text-theme-primary sm:min-h-0 sm:text-[10px]"
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
          <span className="hidden rounded-full bg-theme-primary/20 px-2 py-0.5 text-[10px] font-semibold text-theme-primary opacity-0 transition group-hover:opacity-100 sm:inline">
            Sign →
          </span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg transition sm:min-h-[280px] group-hover:opacity-95">
        <PlayerCard
          player={player}
          selectable
          hardMode={hardMode}
          equalHeight
          compactMobile
        />
      </div>
      <p className={`mt-0.5 hidden truncate text-center sm:block ${TYPO.meta}`}>
        {formatPositionFullNames(player)}
      </p>
    </motion.button>
  );
}
