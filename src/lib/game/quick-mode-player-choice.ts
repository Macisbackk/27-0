import type { Player } from "@/lib/types";
import { formatPlayerDisplayName } from "@/lib/players";
import { isActivePlayer } from "@/lib/players/active";
import { getNationalityAbbrev } from "@/lib/players/nationality";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import { getPlayerColorClub, getPlayerDisplayClub } from "@/lib/players/run-club";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";

function resolveChoicePlayerType(
  player: Player
): "legend" | "historic" | "current" | null {
  if (isGoatPlayer(player) || isSuperSamHallasPlayer(player)) return null;
  if (player.category === "legend") return "legend";
  if (player.category === "historic") return "historic";
  if (isActivePlayer(player)) return "current";
  return null;
}

/** Max primary tags shown on the selection card (rest go to details). */
export const QUICK_PLAYER_CHOICE_MAX_TAGS = 1;

export type QuickPlayerChoiceTagId =
  | "goat"
  | "super-sam"
  | "hall-of-fame"
  | "legend"
  | "club-legend"
  | "historic"
  | "current"
  | "boosted"
  | "top-rating";

export type QuickPlayerChoiceTag = {
  id: QuickPlayerChoiceTagId;
  label: string;
  /** Visual tone — does not change card geometry. */
  tone: "gold" | "purple" | "sky" | "slate" | "boost";
};

/** Priority: lower index = higher priority on the card. */
const TAG_PRIORITY: QuickPlayerChoiceTagId[] = [
  "goat",
  "super-sam",
  "hall-of-fame",
  "legend",
  "club-legend",
  "historic",
  "current",
  "boosted",
  "top-rating",
];

const TAG_TONE: Record<QuickPlayerChoiceTagId, QuickPlayerChoiceTag["tone"]> = {
  goat: "gold",
  "super-sam": "purple",
  "hall-of-fame": "gold",
  legend: "gold",
  "club-legend": "sky",
  historic: "slate",
  current: "slate",
  boosted: "boost",
  "top-rating": "gold",
};

const TAG_LABEL: Record<QuickPlayerChoiceTagId, string> = {
  goat: "GOAT",
  "super-sam": "SUPER SAM",
  "hall-of-fame": "Hall of Fame",
  legend: "Legend",
  "club-legend": "Club Legend",
  historic: "Historic",
  current: "Current",
  boosted: "Boosted",
  "top-rating": "Top rating",
};

export type QuickPlayerChoiceMetadata = {
  /** e.g. "ENG • Stand Off" — always same order. */
  primaryLine: string;
  nationalityAbbrev: string | null;
  positionLabel: string;
  club: string;
};

export type QuickPlayerChoiceRating = {
  value: number;
  /** Visible number, or null when Hard Mode hides it. */
  display: string | null;
  hidden: boolean;
  hiddenLabel: string;
};

export function formatPlayerChoiceName(player: Player): string {
  return formatPlayerDisplayName(player);
}

export function getPlayerChoiceClub(
  player: Player,
  clubOverride?: string
): string {
  if (clubOverride) return clubOverride;
  return getPlayerDisplayClub(player);
}

export function getPlayerChoiceColorClub(
  player: Player,
  clubColorOverride?: string
): string {
  return getPlayerColorClub(player, clubColorOverride);
}

export function formatPlayerChoiceMetadata(
  player: Player,
  options?: { clubOverride?: string; hardMode?: boolean }
): QuickPlayerChoiceMetadata {
  const positionLabel = formatPlayerPositionLabel(player, { short: false });
  const nationalityAbbrev = options?.hardMode
    ? null
    : getNationalityAbbrev(player.nationality) || null;
  const club = getPlayerChoiceClub(player, options?.clubOverride);

  const primaryLine = nationalityAbbrev
    ? `${nationalityAbbrev} · ${positionLabel}`
    : positionLabel;

  return {
    primaryLine,
    nationalityAbbrev,
    positionLabel,
    club,
  };
}

/**
 * Quick Mode selection rating — peak/season rating only.
 * Potential must never appear here.
 */
export function getPlayerChoiceRating(
  player: Player,
  options?: { ratingVisible?: boolean; hardMode?: boolean }
): QuickPlayerChoiceRating {
  const hidden =
    options?.hardMode === true || options?.ratingVisible === false;
  return {
    value: player.peakRating,
    display: hidden ? null : String(player.peakRating),
    hidden,
    hiddenLabel: "Rating Hidden",
  };
}

function collectCandidateTags(
  player: Player,
  options?: { boosted?: boolean; topPick?: boolean }
): QuickPlayerChoiceTagId[] {
  const ids: QuickPlayerChoiceTagId[] = [];

  if (isSuperSamHallasPlayer(player)) ids.push("super-sam");
  else if (isGoatPlayer(player)) ids.push("goat");

  if (player.hallOfFame) ids.push("hall-of-fame");

  const status = resolveChoicePlayerType(player);
  if (status === "legend") ids.push("legend");
  else if (status === "historic") ids.push("historic");
  else if (status === "current") ids.push("current");

  if (player.clubLegend) ids.push("club-legend");
  if (options?.boosted) ids.push("boosted");
  if (options?.topPick) ids.push("top-rating");

  return ids;
}

/** Primary tags for the fixed tags zone — capped and priority-sorted. */
export function getPrimaryPlayerChoiceTags(
  player: Player,
  options?: {
    boosted?: boolean;
    topPick?: boolean;
    /** When false, suppress GOAT / Super Sam (non-easter-egg modes). */
    allowEasterEggTags?: boolean;
    maxTags?: number;
  }
): QuickPlayerChoiceTag[] {
  const max = options?.maxTags ?? QUICK_PLAYER_CHOICE_MAX_TAGS;
  let ids = collectCandidateTags(player, {
    boosted: options?.boosted,
    topPick: options?.topPick,
  });

  if (options?.allowEasterEggTags === false) {
    ids = ids.filter((id) => id !== "goat" && id !== "super-sam");
  }

  ids.sort(
    (a, b) => TAG_PRIORITY.indexOf(a) - TAG_PRIORITY.indexOf(b)
  );

  return ids.slice(0, max).map((id) => ({
    id,
    label: TAG_LABEL[id],
    tone: TAG_TONE[id],
  }));
}

/** Development aid — warn when canonical fields are missing. */
export function warnMissingPlayerChoiceData(player: Player): void {
  if (process.env.NODE_ENV === "production") return;
  if (!player.nationality) {
    console.warn(`[quick-choice] missing nationality: ${player.id}`);
  }
  if (!player.position) {
    console.warn(`[quick-choice] missing position: ${player.id}`);
  }
  if (!player.club && !player.displayClub) {
    console.warn(`[quick-choice] missing club: ${player.id}`);
  }
}
