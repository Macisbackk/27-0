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

interface ManagerRetirementIntentModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onAcknowledge: () => void;
  onViewContracts?: () => void;
}

function ratingClass(rating: number): string {
  if (rating >= 85) {
    return "bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/35";
  }
  if (rating >= 78) {
    return "bg-theme-primary/15 text-theme-primary ring-1 ring-theme-primary/35";
  }
  return "bg-pitch-800/80 text-pitch-200 ring-1 ring-pitch-600/50";
}

export function ManagerRetirementIntentModal({
  career,
  message,
  onAcknowledge,
  onViewContracts,
}: ManagerRetirementIntentModalProps) {
  const player = message.playerId
    ? getManagerPlayer(career, message.playerId)
    : null;
  const contract = message.playerId
    ? career.contracts[message.playerId]
    : undefined;
  const age = message.playerId
    ? getManagerPlayerAge(career, message.playerId)
    : undefined;

  const handleAcknowledge = useCallback(() => {
    playUiClick();
    onAcknowledge();
  }, [onAcknowledge]);

  const panelRef = useModalA11y(true, handleAcknowledge);

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!player || !message.playerId) return null;

  const positions = getPlayerEligiblePositions(player);
  const rating = player.peakRating;
  const contractLabel =
    contract && contract.yearsRemaining > 0
      ? `${contract.yearsRemaining}yr${contract.yearsRemaining === 1 ? "" : "s"} left`
      : "Expires this season";

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="retirement-intent-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-lg overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("stone", { centered: true })}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-stone-400/50 bg-stone-500/20 shadow-inner">
            <span
              className="font-display text-xl font-black text-stone-100"
              aria-hidden
            >
              R
            </span>
          </div>
          <div className="mt-3 flex justify-center">
            <ManagerInboxBadge type="retirement" />
          </div>
          <h2 id="retirement-intent-title" className={`mt-3 ${TYPO.cardTitle}`}>
            Retirement Planned
          </h2>
          <p className={`mx-auto mt-2 max-w-sm ${TYPO.bodySm} text-pitch-300`}>
            A veteran squad member is considering calling time on their career.
          </p>
        </div>

        <ManagerSectionCard
          variant="inset"
          className="!p-0 overflow-hidden border-stone-400/25"
          style={managerClubAccentCardStyle(career.club)}
        >
          <div className="border-b border-pitch-700/40 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className={managerPillClass("stone")}>Final season</span>
                <p className="mt-2 truncate font-display text-lg font-bold text-white">
                  {player.name}
                </p>
                <div className="mt-1">
                  <ClubNameLabel club={career.club} variant="inline" compact />
                </div>
              </div>
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black ${ratingClass(rating)}`}
              >
                {rating}
              </span>
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
              value={String(rating)}
              tone="default"
            />
            <ManagerStat
              label="Contract"
              value={contractLabel}
              tone="amber"
            />
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

        <div className="mt-4 rounded-xl border border-stone-400/30 bg-stone-500/8 px-4 py-3">
          <p className={`${MANAGER_LABEL} text-stone-300`}>Career timeline</p>
          <ol className="mt-3 space-y-0">
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-theme-primary/45 bg-theme-primary/15 text-[10px] font-bold text-theme-primary">
                1
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-white">Rest of season</p>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                  {player.name} remains available for selection.
                </p>
              </div>
            </li>
            <li
              className="ml-2.5 h-4 border-l border-dashed border-stone-400/35"
              aria-hidden
            />
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-400/45 bg-stone-500/20 text-[10px] font-bold text-stone-200">
                2
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-white">
                  End of {career.seasonYear}
                </p>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                  Contract runs out and the player plans to retire.
                </p>
              </div>
            </li>
            <li
              className="ml-2.5 h-4 border-l border-dashed border-stone-400/35"
              aria-hidden
            />
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-400/55 bg-stone-500/25 text-[10px] font-bold text-stone-100">
                3
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-stone-100">
                  Hangs up their boots
                </p>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                  Leaves the squad unless persuaded to sign on.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="mt-4 rounded-lg border border-stone-400/35 bg-stone-500/10 px-3 py-2.5">
          <p className={`${TYPO.bodySm} leading-relaxed text-stone-100`}>
            {message.body}
          </p>
          <p className={`mt-2 ${TYPO.bodySm} text-stone-300/90`}>
            A fresh contract offer before the season ends may convince them to
            play on — head to Contracts to try.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {onViewContracts && (
            <GameButton
              variant="theme"
              onClick={() => {
                playUiClick();
                onViewContracts();
              }}
            >
              Offer new contract
            </GameButton>
          )}
          <GameButton
            variant={onViewContracts ? "secondary" : "theme"}
            className={onViewContracts ? undefined : "sm:col-span-2"}
            onClick={handleAcknowledge}
          >
            Understood
          </GameButton>
        </div>
      </div>
    </div>
  );
}
