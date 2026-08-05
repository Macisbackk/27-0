/**
 * Central player-card colour ownership.
 *
 * Hierarchy:
 * 1. Club colours own the main card border and top colour strip.
 * 2. Player tier is shown via badge only — never the outer border.
 * 3. Mode colour may appear as a small contextual accent.
 * 4. Store theme colours control generic UI only.
 * 5. Semantic colours control injury / suspension / unavailable states.
 */
import type { CSSProperties } from "react";
import type { Player } from "@/lib/types";
import { getClubColoursForCard, getPlayerCardColours } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";
import { isActivePlayer } from "@/lib/players/active";

export const PLAYER_CARD_COLOUR_SYSTEM_VERSION = 2;

export type PlayerTierId =
  | "goat"
  | "super-sam"
  | "hall-of-fame"
  | "legend"
  | "club-legend"
  | "historic"
  | "current";

export type PlayerTierBadgeStyle = {
  id: PlayerTierId;
  label: string;
  /** Badge tone class suffix — never applied to outer card border. */
  tone: "gold" | "purple" | "sky" | "slate" | "amber";
  className: string;
};

export type PlayerCardSemanticState =
  | "injured"
  | "suspended"
  | "unavailable";

export type PlayerCardColourContext = {
  clubName: string;
  clubBorder: string;
  clubSecondary: string;
  clubWash: string;
  /** Inline styles for the outer card chrome (club only). */
  cardStyle: CSSProperties;
  clubStripStyle: CSSProperties;
  /** Highest-priority tier badge, or null. */
  primaryTier: PlayerTierBadgeStyle[];
  modeAccent?: string;
  semanticState?: PlayerCardSemanticState;
};

/** Priority: lower index = higher priority. Max 2 shown on cards. */
export const PLAYER_TIER_PRIORITY: PlayerTierId[] = [
  "goat",
  "super-sam",
  "hall-of-fame",
  "legend",
  "club-legend",
  "historic",
  "current",
];

export const PLAYER_TIER_MAX_VISIBLE = 2;

const TIER_LABEL: Record<PlayerTierId, string> = {
  goat: "GOAT",
  "super-sam": "SUPER SAM",
  "hall-of-fame": "Hall of Fame",
  legend: "Legend",
  "club-legend": "Club Legend",
  historic: "Historic",
  current: "Current",
};

const TIER_TONE: Record<PlayerTierId, PlayerTierBadgeStyle["tone"]> = {
  goat: "gold",
  "super-sam": "purple",
  "hall-of-fame": "gold",
  legend: "gold",
  "club-legend": "sky",
  historic: "slate",
  current: "slate",
};

const TIER_CLASS: Record<PlayerTierId, string> = {
  goat: "player-tier-badge player-tier-badge--gold",
  "super-sam": "player-tier-badge player-tier-badge--purple",
  "hall-of-fame": "player-tier-badge player-tier-badge--gold",
  legend: "player-tier-badge player-tier-badge--gold",
  "club-legend": "player-tier-badge player-tier-badge--sky",
  historic: "player-tier-badge player-tier-badge--slate",
  current: "player-tier-badge player-tier-badge--slate",
};

export function resolvePlayerTiers(player: Player): PlayerTierId[] {
  const ids: PlayerTierId[] = [];
  if (isGoatPlayer(player)) ids.push("goat");
  if (isSuperSamHallasPlayer(player)) ids.push("super-sam");
  if (player.hallOfFame === true) ids.push("hall-of-fame");
  if (player.category === "legend") ids.push("legend");
  if (player.clubLegend === true) ids.push("club-legend");
  if (player.category === "historic") ids.push("historic");
  if (
    isActivePlayer(player) &&
    player.category !== "legend" &&
    player.category !== "historic"
  ) {
    ids.push("current");
  }
  return PLAYER_TIER_PRIORITY.filter((id) => ids.includes(id));
}

export function getPrimaryPlayerTier(
  player: Player,
  max = PLAYER_TIER_MAX_VISIBLE
): PlayerTierBadgeStyle[] {
  return resolvePlayerTiers(player)
    .slice(0, max)
    .map((id) => ({
      id,
      label: TIER_LABEL[id],
      tone: TIER_TONE[id],
      className: TIER_CLASS[id],
    }));
}

export function resolvePlayerCardColourContext(
  player: Player,
  options?: {
    clubOverride?: string;
    modeAccent?: string;
    semanticState?: PlayerCardSemanticState;
    maxTiers?: number;
  }
): PlayerCardColourContext {
  const clubName = getPlayerColorClub(player, options?.clubOverride);
  const colours = getPlayerCardColours(clubName);
  return {
    clubName,
    clubBorder: colours.border,
    clubSecondary: colours.colors.secondary,
    clubWash: colours.wash,
    cardStyle: colours.style,
    clubStripStyle: {
      // Strip is rendered by TeamColourStrip / ClubColourBar — keep for API completeness.
    },
    primaryTier: getPrimaryPlayerTier(player, options?.maxTiers),
    modeAccent: options?.modeAccent,
    semanticState: options?.semanticState,
  };
}

/** Club border style for a named club without a player record. */
export function resolveClubCardColourContext(clubName: string): Pick<
  PlayerCardColourContext,
  "clubName" | "clubBorder" | "clubSecondary" | "clubWash" | "cardStyle"
> {
  const colours = getClubColoursForCard(clubName);
  return {
    clubName,
    clubBorder: colours.border,
    clubSecondary: colours.colors.secondary,
    clubWash: colours.wash,
    cardStyle: colours.style,
  };
}
