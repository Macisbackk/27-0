"use client";

import type { ReactNode } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { ClubNameLabel } from "@/components/ClubNameLabel";
import {
  MANAGER_LABEL,
  ManagerSectionCard,
  ManagerStat,
  type ManagerValueTone,
} from "@/components/manager/manager-ui";
import { getClubIndicatorColor } from "@/lib/clubs";
import { formatWage } from "@/lib/manager/managerContracts";
import { managerPillClass } from "@/lib/manager/managerSurfaces";
import { formatValue } from "@/lib/players";
import { formatPlayerAge } from "@/lib/players/player-age";
import { POSITION_SHORT } from "@/lib/positions";
import type { Player } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function transferRatingTone(rating: number): ManagerValueTone {
  if (rating >= 85) return "gold";
  if (rating >= 78) return "primary";
  return "default";
}

function ratingBadgeClass(rating: number): string {
  if (rating >= 85) {
    return "bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/35";
  }
  if (rating >= 78) {
    return "bg-[color:var(--rating)]/15 text-[color:var(--rating)] ring-1 ring-[color:var(--rating)]/35";
  }
  return "bg-pitch-800/80 text-pitch-200 ring-1 ring-pitch-600/50";
}

interface ManagerTransferPlayerCardProps {
  player: Player;
  club: string;
  listed: boolean;
  freeAgent?: boolean;
  fee: number;
  /** Seller's listed/market fee when buyer-tier premium inflates the user's fee. */
  sellerListedFee?: number;
  wagePerYear: number;
  yearsRequested?: number;
  children: ReactNode;
}

export function ManagerTransferPlayerCard({
  player,
  club,
  listed,
  freeAgent = false,
  fee,
  sellerListedFee,
  wagePerYear,
  yearsRequested,
  children,
}: ManagerTransferPlayerCardProps) {
  const rating = player.peakRating;
  const positions = getPlayerEligiblePositions(player);
  const accent = freeAgent ? undefined : getClubIndicatorColor(club);

  return (
    <ManagerSectionCard
      variant={listed || freeAgent ? "elevated" : "inset"}
      className="!p-0 overflow-hidden"
    >
      <div
        className={`border-b border-pitch-700/40 px-4 py-3 sm:px-4 ${
          freeAgent ? "border-t-[3px] border-t-theme-primary" : ""
        }`}
        style={
          freeAgent
            ? undefined
            : { borderTopWidth: 3, borderTopColor: accent }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {!freeAgent && (
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    listed
                      ? "border-sky-400/40 bg-sky-400/12 text-sky-300"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {listed ? "Listed" : "Unlisted"}
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate font-display text-base font-bold text-white">
              {player.name}
            </p>
            <div className="mt-1">
              {freeAgent ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                  <span
                    className="h-3 w-1 shrink-0 rounded-full bg-theme-primary"
                    aria-hidden
                  />
                  <span
                    className={`min-w-0 truncate ${TYPO.identityLine} text-theme-primary`}
                  >
                    Free agent
                  </span>
                </span>
              ) : (
                <ClubNameLabel club={club} variant="inline" compact />
              )}
            </div>
          </div>
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black ${ratingBadgeClass(rating)}`}
          >
            {rating}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {positions.map((pos) => (
            <span
              key={pos}
              className="rounded border border-pitch-600/50 bg-pitch-900/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300"
            >
              {POSITION_SHORT[pos]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:px-4">
        <ManagerStat
          label={
            freeAgent
              ? "Transfer fee"
              : listed
                ? sellerListedFee != null
                  ? "Your fee"
                  : "Asking price"
                : sellerListedFee != null
                  ? "Your bid"
                  : "Est. fee"
          }
          value={freeAgent ? "Free" : formatWage(fee)}
          tone="gold"
        />
        <ManagerStat
          label="Market value"
          value={formatValue(player.value)}
          tone="gold"
        />
        <ManagerStat
          label="Age"
          value={formatPlayerAge(player)}
          tone="muted"
        />
        <ManagerStat
          label="Wage demand"
          value={`${formatWage(wagePerYear)}/yr`}
          tone="default"
        />
        <ManagerStat
          label="Contract"
          value={
            yearsRequested
              ? `${yearsRequested}yr${yearsRequested === 1 ? "" : "s"}`
              : "—"
          }
          tone="muted"
        />
      </div>

      {sellerListedFee != null && (
        <p className={`px-4 pb-1 sm:px-4 ${TYPO.bodySm} text-pitch-400`}>
          Listed at {formatWage(sellerListedFee)} — your club pays a tier premium.
        </p>
      )}

      {!listed && !freeAgent && (
        <p className={`px-4 pb-1 sm:px-4 ${TYPO.bodySm} text-amber-300/90`}>
          Unlisted bids need a premium fee to tempt the selling club.
        </p>
      )}

      <div className="border-t border-pitch-700/40 px-4 py-3 sm:px-4">{children}</div>
    </ManagerSectionCard>
  );
}

interface ManagerLeagueTransferCardProps {
  playerName: string;
  fromClub: string;
  toClub: string;
  fee: number;
  week: number;
  compact?: boolean;
}

/** Neutral Transfer Wire row — pitch border only, club identity via swatch. */
export function ManagerLeagueTransferCard({
  playerName,
  fromClub,
  toClub,
  fee,
  week,
}: ManagerLeagueTransferCardProps) {
  return (
    <li
      className={`${CARD.inset} game-panel--flush flex flex-wrap items-center gap-x-2 gap-y-1.5 ${SPACING.listItem}`}
    >
      <ClubDualSwatch club={toClub} size="xs" />
      <span className="min-w-0 flex-1 truncate font-medium text-white">
        {playerName}
      </span>
      <span className={`min-w-0 truncate ${TYPO.bodySm} text-pitch-400`}>
        {fromClub}
        <span className="mx-1 text-pitch-500">→</span>
        {toClub}
      </span>
      <span className="shrink-0 font-semibold text-accent-gold">
        {fee <= 0 ? "Free" : formatWage(fee)}
      </span>
      <span className={managerPillClass("muted")}>Done</span>
      <span className={`${MANAGER_LABEL} shrink-0 text-pitch-500`}>W{week}</span>
    </li>
  );
}
