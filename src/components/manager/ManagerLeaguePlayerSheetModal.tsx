"use client";

import { useCallback } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import { useModalA11y } from "@/hooks/useModalA11y";
import {
  formatWage,
  getLeagueClubPlayerContract,
} from "@/lib/manager/managerContracts";
import {
  getManagerPlayer,
  getManagerPlayerAge,
  getManagerPlayerEligiblePositions,
} from "@/lib/manager/managerPlayers";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatValue } from "@/lib/players";
import { POSITION_LABELS } from "@/lib/positions";
import { playPanelClose } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface ManagerLeaguePlayerSheetModalProps {
  career: ManagerCareer;
  club: string;
  playerId: string;
  slotLabel?: string;
  inStartingXiii?: boolean;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
  valueClassName = "font-medium text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-pitch-500">{label}</dt>
      <dd className={`min-w-0 text-right break-words ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

export function ManagerLeaguePlayerSheetModal({
  career,
  club,
  playerId,
  slotLabel,
  inStartingXiii = false,
  onClose,
}: ManagerLeaguePlayerSheetModalProps) {
  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

  const player = getManagerPlayer(career, playerId);
  if (!player) return null;

  const contract = getLeagueClubPlayerContract(career, club, playerId, {
    inStartingXiii,
  });
  const age = getManagerPlayerAge(career, playerId);
  const eligible = getManagerPlayerEligiblePositions(career, playerId);
  const naturalLabel =
    eligible.length > 0
      ? eligible.map((p) => POSITION_LABELS[p]).join(" / ")
      : POSITION_LABELS[player.position];
  const listing = career.leagueListedPlayers.find(
    (entry) => entry.playerId === playerId && entry.club === club
  );

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
        role="presentation"
        onClick={handleClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="league-player-sheet-title"
          className={`card-glass w-full max-w-md outline-none ${SPACING.cardPadding}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <ClubDualSwatch club={club} size="sm" />
            <div className="min-w-0 flex-1">
              <h2 id="league-player-sheet-title" className={TYPO.cardTitle}>
                {player.name}
              </h2>
              <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                {club}
              </p>
            </div>
          </div>

          <dl className={`${CARD.inset} ${SPACING.cardPaddingSm} mt-4 space-y-2`}>
            <DetailRow
              label="Matchday role"
              value={slotLabel ?? (inStartingXiii ? "Starting XIII" : "Interchange")}
            />
            <DetailRow label="Position" value={naturalLabel} />
            {age != null && <DetailRow label="Age" value={`${age}`} />}
            <DetailRow
              label="Rating"
              value={String(player.peakRating)}
              valueClassName="font-display font-bold text-theme-primary"
            />
            <DetailRow
              label="Value"
              value={formatValue(player.value)}
              valueClassName="font-semibold text-accent-gold"
            />
            <DetailRow
              label="Wage"
              value={`${formatWage(contract.wagePerYear)}/yr`}
            />
            <DetailRow
              label="Contract"
              value={
                contract.yearsRemaining === 1
                  ? "1 year left"
                  : `${contract.yearsRemaining} years left`
              }
            />
            <DetailRow label="Squad role" value={contract.squadRole} />
            {listing && (
              <DetailRow
                label="Transfer list"
                value={`Listed · ${formatWage(listing.askingPrice)}`}
                valueClassName="font-semibold text-accent-gold"
              />
            )}
          </dl>

          <div className="mt-4">
            <GameButton variant="secondary" onClick={handleClose}>
              Close
            </GameButton>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
