"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerTransferPlayerCard } from "@/components/manager/ManagerTransferPlayerCard";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatWage } from "@/lib/manager/managerContracts";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerAge,
} from "@/lib/manager/managerPlayers";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerRetirementIntentModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onAcknowledge: () => void;
  onViewContracts?: () => void;
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

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!player || !message.playerId) return null;

  return (
    <div
      className="fixed inset-0 z-[94] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retirement-intent-title"
    >
      <div
        className={`card-glass w-full max-w-lg overflow-hidden ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="-mx-4 -mt-4 mb-4 border-b border-stone-400/35 bg-stone-500/10 px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
          <span className="inline-flex rounded-full border border-stone-400/45 bg-stone-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-200">
            Retirement
          </span>
          <h2 id="retirement-intent-title" className={`mt-3 ${TYPO.pageTitle}`}>
            End of Career Planned
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {player.name}
            {age !== undefined ? ` (${age})` : ""} plans to retire at the end of
            the {career.seasonYear} season.
          </p>
        </div>

        <ManagerTransferPlayerCard
          player={player}
          club={career.club}
          listed={false}
          wagePerYear={contract?.wagePerYear ?? 0}
        >
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            {message.body}
            {contract?.wagePerYear ? (
              <>
                {" "}
                Current deal:{" "}
                <span className="font-semibold text-pitch-200">
                  {formatWage(contract.wagePerYear)}/yr
                </span>
                .
              </>
            ) : null}
          </p>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
            A new contract offer may persuade them to play on — check Contracts
            before the season ends.
          </p>
        </ManagerTransferPlayerCard>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {onViewContracts && (
            <GameButton
              variant="theme"
              onClick={() => {
                playUiClick();
                onViewContracts();
              }}
            >
              View contracts
            </GameButton>
          )}
          <GameButton
            variant={onViewContracts ? "secondary" : "theme"}
            className={onViewContracts ? undefined : "sm:col-span-2"}
            onClick={() => {
              playUiClick();
              onAcknowledge();
            }}
          >
            Understood
          </GameButton>
        </div>
      </div>
    </div>
  );
}
