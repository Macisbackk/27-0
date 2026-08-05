"use client";

import { GameButton } from "@/components/ui/GameButton";
import { TYPO } from "@/lib/ui/typography";
import { managerClubAccentCardStyle } from "@/lib/manager/managerSurfaces";
import type {
  ReserveCardChip,
  ReserveCardModel,
} from "@/lib/manager/managerReserveCard";
import {
  ManagerPlayerCard,
  ManagerPlayerCardActions,
  ManagerPlayerCardHeader,
  ManagerPlayerCardSection,
  PlayerAvailabilityStatus,
  PlayerContractSummary,
  PlayerRatingPotentialRow,
} from "@/components/manager/ManagerPlayerCard";
import { playUiClick } from "@/lib/sound";

interface ManagerReservePlayerCardProps {
  model: ReserveCardModel;
  club: string;
  /** Staff review flags — rendered in the status zone, never beside the name. */
  extraChips?: ReserveCardChip[];
  onPromote: (id: string) => void;
  onViewDetails: (id: string) => void;
}

export function ManagerReservePlayerCard({
  model,
  club,
  extraChips = [],
  onPromote,
  onViewDetails,
}: ManagerReservePlayerCardProps) {
  const { development, contract, promotion } = model;

  const developmentLine = development.trainingLabel
    ? `Training: ${development.trainingLabel} · ${development.trainingProgressPercent}%`
    : development.potentialReached
      ? "Potential reached"
      : "No active training";

  return (
    <ManagerPlayerCard
      variant="reserve"
      accent={contract.needsRenewal ? "gold" : "none"}
      clubStyle={managerClubAccentCardStyle(club)}
    >
      <ManagerPlayerCardHeader
        rating={model.currentRating}
        name={model.name}
        meta={model.metaLine}
        wrapName
      />

      <ManagerPlayerCardSection>
        <PlayerRatingPotentialRow
          currentRating={model.currentRating}
          potential={model.potential}
        />
      </ManagerPlayerCardSection>

      <ManagerPlayerCardSection>
        <PlayerAvailabilityStatus
          items={[...model.statusChips, ...extraChips]}
        />
      </ManagerPlayerCardSection>

      <ManagerPlayerCardSection>
        <p className={`${TYPO.bodySm} text-pitch-400`}>{developmentLine}</p>
      </ManagerPlayerCardSection>

      <ManagerPlayerCardSection>
        <PlayerContractSummary
          expiry={contract.expiryLabel}
          wage={contract.wageLabel}
          value={contract.valueLabel}
          listed={contract.listed}
        />
      </ManagerPlayerCardSection>

      {!promotion.allowed && promotion.reason && (
        <ManagerPlayerCardSection>
          <p className={`${TYPO.bodySm} text-amber-300`}>{promotion.reason}</p>
        </ManagerPlayerCardSection>
      )}

      <ManagerPlayerCardActions>
        <GameButton
          variant="theme"
          size="sm"
          fullWidth
          disabled={!promotion.allowed}
          onClick={() => {
            playUiClick();
            onPromote(model.id);
          }}
        >
          Promote to Senior Squad
        </GameButton>
        <GameButton
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => {
            playUiClick();
            onViewDetails(model.id);
          }}
        >
          View Player
        </GameButton>
      </ManagerPlayerCardActions>
    </ManagerPlayerCard>
  );
}
