"use client";

import { useState } from "react";
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
import { UI_COPY } from "@/lib/ui/copy";

interface ManagerReservePlayerCardProps {
  model: ReserveCardModel;
  club: string;
  /** Staff review flags — rendered in the status zone, never beside the name. */
  extraChips?: ReserveCardChip[];
  protectedFromMassRelease?: boolean;
  onToggleProtectFromMassRelease?: (id: string) => void;
  onCallUp: (id: string) => void;
  onCancelCallUp?: (id: string) => void;
  onPromote: (id: string) => void;
  onOfferFullTime: (id: string) => void;
  onViewDetails: (id: string) => void;
  canOfferFullTime?: boolean;
}

export function ManagerReservePlayerCard({
  model,
  club,
  extraChips = [],
  protectedFromMassRelease = false,
  onToggleProtectFromMassRelease,
  onCallUp,
  onCancelCallUp,
  onPromote,
  onOfferFullTime,
  onViewDetails,
  canOfferFullTime = true,
}: ManagerReservePlayerCardProps) {
  const { contract, promotion } = model;
  const calledUp = !model.canCallUp;
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="flex w-full items-stretch gap-2">
          {calledUp && onCancelCallUp ? (
            <GameButton
              variant="secondary"
              size="sm"
              className="min-w-0 flex-1"
              onClick={() => {
                playUiClick();
                onCancelCallUp(model.id);
              }}
            >
              Cancel Call-Up
            </GameButton>
          ) : (
            <GameButton
              variant="theme"
              size="sm"
              className="min-w-0 flex-1"
              disabled={!model.canCallUp}
              onClick={() => {
                playUiClick();
                onCallUp(model.id);
              }}
            >
              Call Up
            </GameButton>
          )}
          <div className="relative shrink-0">
            <GameButton
              variant="secondary"
              size="sm"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => {
                playUiClick();
                setMenuOpen((open) => !open);
              }}
            >
              More
            </GameButton>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute bottom-full right-0 z-20 mb-1 min-w-[11rem] rounded-lg border border-pitch-600/60 bg-pitch-950 p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={!promotion.allowed}
                  className="btn-press block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-white hover:bg-pitch-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    playUiClick();
                    setMenuOpen(false);
                    onPromote(model.id);
                  }}
                >
                  Promote to Senior
                </button>
                {canOfferFullTime ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="btn-press block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-white hover:bg-pitch-800"
                    onClick={() => {
                      playUiClick();
                      setMenuOpen(false);
                      onOfferFullTime(model.id);
                    }}
                  >
                    Offer Full-Time
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="btn-press block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-white hover:bg-pitch-800"
                  onClick={() => {
                    playUiClick();
                    setMenuOpen(false);
                    onViewDetails(model.id);
                  }}
                >
                  {UI_COPY.viewDetails}
                </button>
                {onToggleProtectFromMassRelease ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="btn-press block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-white hover:bg-pitch-800"
                    onClick={() => {
                      playUiClick();
                      setMenuOpen(false);
                      onToggleProtectFromMassRelease(model.id);
                    }}
                  >
                    {protectedFromMassRelease
                      ? "Unprotect from mass release"
                      : UI_COPY.protectFromMassRelease}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </ManagerPlayerCardActions>
    </ManagerPlayerCard>
  );
}
