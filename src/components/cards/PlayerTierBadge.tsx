"use client";

import type { Player } from "@/lib/types";
import {
  getPrimaryPlayerTier,
  type PlayerTierBadgeStyle,
  type PlayerTierId,
} from "@/lib/players/player-card-colours";

interface PlayerTierBadgeProps {
  /** Prefer passing resolved tiers; alternatively pass player. */
  tiers?: PlayerTierBadgeStyle[];
  player?: Player;
  compact?: boolean;
  max?: number;
  className?: string;
}

/**
 * Shared player-tier badge — never paints the outer card border.
 * Priority: GOAT → Hall of Fame → Legend → Club Legend → Historic → Current.
 */
export function PlayerTierBadge({
  tiers,
  player,
  compact = true,
  max = 2,
  className = "",
}: PlayerTierBadgeProps) {
  const resolved =
    tiers ?? (player ? getPrimaryPlayerTier(player, max) : []);
  if (resolved.length === 0) return null;

  return (
    <div
      className={`player-tier-badge-row ${className}`}
      aria-label={`Player classification: ${resolved.map((t) => t.label).join(", ")}`}
    >
      {resolved.map((tier) => (
        <span
          key={tier.id}
          className={`${tier.className}${compact ? " player-tier-badge--compact" : ""}`}
          data-tier={tier.id as PlayerTierId}
        >
          {tier.label}
        </span>
      ))}
    </div>
  );
}
