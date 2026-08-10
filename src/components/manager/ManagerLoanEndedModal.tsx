"use client";

import { useCallback, useEffect } from "react";
import { ClubNameLabel } from "@/components/ClubNameLabel";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerInboxBadge,
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerAge,
} from "@/lib/manager/managerPlayers";
import {
  managerClubAccentCardStyle,
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { POSITION_SHORT } from "@/lib/positions";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { playMenuOpen, playUiClick } from "@/lib/sound";
import { getPlayerById } from "@/lib/players";

interface ManagerLoanEndedModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onDismiss: () => void;
  onViewSquad?: () => void;
}

export function ManagerLoanEndedModal({
  career,
  message,
  onDismiss,
  onViewSquad,
}: ManagerLoanEndedModalProps) {
  const player = message.playerId
    ? getManagerPlayer(career, message.playerId) ??
      getPlayerById(message.playerId)
    : null;
  const age = message.playerId
    ? getManagerPlayerAge(career, message.playerId)
    : undefined;
  const returnedToUser =
    Boolean(message.playerId) &&
    career.squad.some((p) => p.playerId === message.playerId);

  const handleDismiss = useCallback(() => {
    playUiClick();
    onDismiss();
  }, [onDismiss]);

  const panelRef = useModalA11y(true, handleDismiss);

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!message.playerId) return null;

  const displayName = player?.name ?? message.playerName ?? "Player";
  const positions = player ? getPlayerEligiblePositions(player) : [];

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} sm:items-center sm:py-6`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loan-ended-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="game-modal-panel my-auto flex w-full max-w-lg max-h-[min(92dvh,900px)] flex-col overflow-hidden outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${SPACING.cardPadding}`}>
          <div className={managerModalHeaderClass("sky", { centered: true })}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-sky-400/50 bg-sky-500/20 shadow-inner">
              <span
                className="font-display text-xl font-black text-sky-100"
                aria-hidden
              >
                L
              </span>
            </div>
            <div className="mt-3 flex justify-center">
              <ManagerInboxBadge type="loan_ended" />
            </div>
            <h2 id="loan-ended-title" className={`mt-3 ${TYPO.cardTitle}`}>
              Loan Ended
            </h2>
            <p className={`mx-auto mt-2 max-w-sm ${TYPO.bodySm} text-pitch-300`}>
              {returnedToUser
                ? "A loaned-out player is back and available for selection."
                : "A loan player has returned to their parent club."}
            </p>
          </div>

          <ManagerSectionCard
            variant="inset"
            className="!p-0 overflow-hidden border-sky-400/25"
            style={managerClubAccentCardStyle(career.club)}
          >
            <div className="border-b border-pitch-700/40 px-4 py-3">
              <span className={managerPillClass("sky")}>
                {returnedToUser ? "Returned to squad" : "Left your squad"}
              </span>
              <p className="mt-2 truncate font-display text-lg font-bold text-white">
                {displayName}
              </p>
              <div className="mt-1">
                <ClubNameLabel club={career.club} variant="inline" compact />
              </div>
              {positions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {positions.map((pos) => (
                    <span
                      key={pos}
                      className="rounded border border-pitch-600/50 bg-pitch-900/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pitch-300"
                    >
                      {POSITION_SHORT[pos]}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 py-3">
              <ManagerStat
                label="Age"
                value={age !== undefined ? String(age) : "—"}
                tone="muted"
              />
              <ManagerStat
                label="Peak rating"
                value={player ? String(player.peakRating) : "—"}
                tone="default"
              />
            </div>
          </ManagerSectionCard>

          <div className="mt-4 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2.5">
            <p className={`${TYPO.bodySm} leading-relaxed text-sky-100`}>
              {message.body}
            </p>
          </div>
        </div>

        <div
          className={`shrink-0 border-t border-pitch-700/50 bg-pitch-950/90 ${SPACING.cardPadding} pt-4`}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onViewSquad && returnedToUser && (
              <GameButton
                variant="theme"
                onClick={() => {
                  playUiClick();
                  onViewSquad();
                }}
              >
                View squad
              </GameButton>
            )}
            <GameButton
              variant={onViewSquad && returnedToUser ? "secondary" : "theme"}
              className={
                onViewSquad && returnedToUser ? undefined : "sm:col-span-2"
              }
              onClick={handleDismiss}
            >
              Continue
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}
