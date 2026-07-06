"use client";

import { useCallback, useEffect } from "react";
import { ClubNameLabel } from "@/components/ClubNameLabel";
import { GameButton } from "@/components/ui/GameButton";
import {
  MANAGER_LABEL,
  ManagerInboxBadge,
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { formatWage } from "@/lib/manager/managerContracts";
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

interface ManagerContractExpiryModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onDismiss: () => void;
  onViewContracts?: () => void;
}

export function ManagerContractExpiryModal({
  career,
  message,
  onDismiss,
  onViewContracts,
}: ManagerContractExpiryModalProps) {
  const player = message.playerId
    ? getManagerPlayer(career, message.playerId)
    : null;
  const contract = message.playerId
    ? career.contracts[message.playerId]
    : undefined;
  const age = message.playerId
    ? getManagerPlayerAge(career, message.playerId)
    : undefined;

  const handleDismiss = useCallback(() => {
    playUiClick();
    onDismiss();
  }, [onDismiss]);

  const panelRef = useModalA11y(true, handleDismiss);

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!player || !message.playerId) return null;

  const positions = getPlayerEligiblePositions(player);
  const contractLabel =
    contract && contract.yearsRemaining > 0
      ? `${contract.yearsRemaining}yr${contract.yearsRemaining === 1 ? "" : "s"} left`
      : "Expires this season";

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} backdrop-blur-sm sm:items-center sm:py-6`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-expiry-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="card-glass my-auto flex w-full max-w-lg max-h-[min(92dvh,900px)] flex-col overflow-hidden outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${SPACING.cardPadding}`}>
          <div className={managerModalHeaderClass("amber", { centered: true })}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400/50 bg-amber-500/20 shadow-inner">
              <span
                className="font-display text-xl font-black text-amber-100"
                aria-hidden
              >
                C
              </span>
            </div>
            <div className="mt-3 flex justify-center">
              <ManagerInboxBadge type="contract" />
            </div>
            <h2 id="contract-expiry-title" className={`mt-3 ${TYPO.cardTitle}`}>
              Contract Expiring
            </h2>
            <p className={`mx-auto mt-2 max-w-sm ${TYPO.bodySm} text-pitch-300`}>
              A first-team player is entering the final six months of their deal.
            </p>
          </div>

          <ManagerSectionCard
            variant="inset"
            className="!p-0 overflow-hidden border-amber-400/25"
            style={managerClubAccentCardStyle(career.club)}
          >
            <div className="border-b border-pitch-700/40 px-4 py-3">
              <span className={managerPillClass("amber")}>Renewal needed</span>
              <p className="mt-2 truncate font-display text-lg font-bold text-white">
                {player.name}
              </p>
              <div className="mt-1">
                <ClubNameLabel club={career.club} variant="inline" compact />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 py-3">
              <ManagerStat
                label="Age"
                value={age !== undefined ? String(age) : "—"}
                tone="muted"
              />
              <ManagerStat
                label="Peak rating"
                value={String(player.peakRating)}
                tone="default"
              />
              <ManagerStat label="Contract" value={contractLabel} tone="amber" />
              <ManagerStat
                label="Current wage"
                value={
                  contract?.wagePerYear
                    ? `${formatWage(contract.wagePerYear)}/yr`
                    : "—"
                }
                tone="muted"
              />
            </div>
          </ManagerSectionCard>

          <div className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2.5">
            <p className={`${TYPO.bodySm} leading-relaxed text-amber-100`}>
              {message.body}
            </p>
            <p className={`mt-2 ${TYPO.bodySm} text-amber-200/90`}>
              Offer a new deal before the season ends or they will leave on a
              free transfer.
            </p>
          </div>
        </div>

        <div
          className={`shrink-0 border-t border-pitch-700/50 bg-pitch-950/90 ${SPACING.cardPadding} pt-4`}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onViewContracts && (
              <GameButton
                variant="theme"
                onClick={() => {
                  playUiClick();
                  onViewContracts();
                }}
              >
                Negotiate contract
              </GameButton>
            )}
            <GameButton
              variant={onViewContracts ? "secondary" : "theme"}
              className={onViewContracts ? undefined : "sm:col-span-2"}
              onClick={handleDismiss}
            >
              Remind me later
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}
