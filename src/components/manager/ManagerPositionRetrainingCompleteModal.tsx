"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import { POSITION_LABELS, POSITION_SHORT } from "@/lib/positions";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { formatRetrainingPathLabel } from "@/lib/manager/managerPositionRetraining";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerPositionRetrainingCompleteModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onContinue: () => void;
  onViewTactics?: () => void;
}

export function ManagerPositionRetrainingCompleteModal({
  career,
  message,
  onContinue,
  onViewTactics,
}: ManagerPositionRetrainingCompleteModalProps) {
  const player =
    message.playerId != null
      ? getManagerPlayer(career, message.playerId)
      : undefined;
  const fromPosition = message.retrainingFrom;
  const toPosition = message.retrainingTo;

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const handleViewTactics = useCallback(() => {
    playUiClick();
    onViewTactics?.();
  }, [onViewTactics]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    playMenuOpen();
  }, []);

  const playerName = player?.name ?? message.playerName ?? "Player";
  const pathLabel =
    fromPosition && toPosition
      ? formatRetrainingPathLabel(fromPosition, toPosition)
      : null;

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="retraining-complete-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-md outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("primary", { centered: true })}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-theme-primary/45 bg-theme-primary/15 shadow-inner">
            <span className="font-display text-xl font-black text-theme-primary" aria-hidden>
              {toPosition ? POSITION_SHORT[toPosition] : "2P"}
            </span>
          </div>
          <span className={`mt-3 ${managerPillClass("primary")}`}>
            Dual position training
          </span>
          <h2 id="retraining-complete-title" className={`mt-3 ${TYPO.pageTitle}`}>
            {playerName} is dual-position
          </h2>
          {pathLabel ? (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>{pathLabel}</p>
          ) : null}
        </div>

        <div className={`mt-4 space-y-3 ${TYPO.bodySm} text-pitch-300`}>
          {player ? (
            <p className="text-center text-pitch-400">
              Squad rating{" "}
              <span className="font-bold text-theme-primary">{player.rating}</span>
            </p>
          ) : null}
          {fromPosition && toPosition ? (
            <p className="text-center">
              Can now play{" "}
              <span className="font-semibold text-white">
                {POSITION_LABELS[fromPosition]}
              </span>{" "}
              and{" "}
              <span className="font-semibold text-white">
                {POSITION_LABELS[toPosition]}
              </span>
              .
            </p>
          ) : (
            <p className="text-center">{message.body}</p>
          )}
          <p className="text-center text-pitch-500">
            Deploy them in either role from your matchday squad and tactics.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {onViewTactics ? (
            <GameButton
              variant="secondary"
              className="sm:flex-1"
              onClick={handleViewTactics}
            >
              View tactics
            </GameButton>
          ) : null}
          <GameButton
            variant="theme"
            className={onViewTactics ? "sm:flex-1" : undefined}
            onClick={handleContinue}
          >
            Continue
          </GameButton>
        </div>
      </div>
    </div>
  );
}
