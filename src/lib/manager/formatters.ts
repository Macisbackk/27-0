/**
 * Text formatting and presentation utilities for Rugby League Manager Mode.
 * Ensures enums and identifiers with underscores are rendered cleanly and authentically.
 */

import type {
  Position,
  SquadRole,
  SquadTier,
  MatchScoreEvent,
  KeyMomentType,
} from "./types";

/**
 * Strips underscores and capitalizes words as a fallback sanitizer.
 */
export function cleanText(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/_+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Formats a Rugby League Position into its authentic full display name.
 * Stand-Off and Scrum-Half both display as Halfback (HB) — too similar to split.
 */
export function formatPositionLabel(pos?: string | null): string {
  if (!pos) return "";
  switch (pos.toUpperCase()) {
    case "FULLBACK":
      return "Fullback";
    case "WING":
      return "Wing";
    case "CENTRE":
      return "Centre";
    case "STAND_OFF":
    case "SCRUM_HALF":
    case "HALFBACK":
    case "HB":
      return "Halfback";
    case "PROP":
      return "Prop";
    case "HOOKER":
      return "Hooker";
    case "SECOND_ROW":
      return "Second-Row";
    case "LOOSE_FORWARD":
      return "Loose Forward";
    default:
      return cleanText(pos);
  }
}

/**
 * Returns standard 2-letter Rugby League abbreviations for positions.
 * SO and SH both render as HB.
 */
export function formatPositionShort(pos?: string | null, slotIdx?: number): string {
  if (slotIdx !== undefined && slotIdx >= 13) return "INT";
  if (!pos) return "PL";

  switch (pos.toUpperCase()) {
    case "FULLBACK":
      return "FB";
    case "WING":
      return "WG";
    case "CENTRE":
      return "CE";
    case "STAND_OFF":
    case "SCRUM_HALF":
    case "HALFBACK":
    case "HB":
      return "HB";
    case "PROP":
      return "PR";
    case "HOOKER":
      return "HK";
    case "SECOND_ROW":
      return "SR";
    case "LOOSE_FORWARD":
      return "LF";
    default:
      return pos.slice(0, 2).toUpperCase();
  }
}

function isHalfbackShort(short: string): boolean {
  return short === "HB" || short === "SO" || short === "SH";
}

/**
 * Primary (+ optional secondary) badge text, e.g. FB/WG or HB.
 * SO+SH collapses to HB (not HB/HB or SO/SH).
 */
export function formatPositionPair(
  primary?: string | null,
  secondary?: string | null,
  slotIdx?: number
): string {
  const primaryShort = formatPositionShort(primary, slotIdx);
  if (!secondary || (slotIdx !== undefined && slotIdx >= 13)) return primaryShort;
  const secondaryShort = formatPositionShort(secondary);
  if (secondaryShort === primaryShort) return primaryShort;
  if (isHalfbackShort(primaryShort) && isHalfbackShort(secondaryShort)) return "HB";
  return `${primaryShort}/${secondaryShort}`;
}

/**
 * Formats squad roles cleanly (e.g. first_team -> First Team).
 */
export function formatSquadRole(role?: SquadRole | string | null): string {
  if (!role) return "First Team";
  switch (role) {
    case "star":
      return "Star Player";
    case "first_team":
      return "First Team";
    case "rotation":
      return "Rotation";
    case "backup":
      return "Backup";
    case "youth":
      return "Youth";
    default:
      return cleanText(role);
  }
}

/**
 * Formats squad tiers cleanly (e.g. first -> First Team).
 */
export function formatSquadTier(tier?: SquadTier | string | null): string {
  if (!tier) return "First Team";
  switch (tier) {
    case "first":
      return "First Team";
    case "reserves":
      return "Reserves";
    case "academy":
      return "Academy";
    default:
      return cleanText(tier);
  }
}

/**
 * Formats calendar season phases cleanly (e.g. pre_season -> Pre-Season).
 */
export function formatCalendarPhase(phase?: string | null): string {
  if (!phase) return "";
  switch (phase) {
    case "pre_season":
      return "Pre-Season";
    case "regular_season":
      return "Regular Season";
    case "playoffs":
      return "Playoffs";
    case "season_end":
      return "Season End";
    default:
      return cleanText(phase);
  }
}

/**
 * Formats transfer bid statuses cleanly.
 */
export function formatBidStatus(status?: string | null): string {
  if (!status) return "";
  switch (status) {
    case "pending_club":
      return "Pending Club";
    case "club_accepted":
      return "Club Accepted";
    case "club_rejected":
      return "Club Rejected";
    case "player_accepted":
      return "Terms Agreed";
    case "player_rejected":
      return "Terms Rejected";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return cleanText(status);
  }
}

/**
 * Formats financial ledger transaction categories cleanly.
 */
export function formatLedgerCategory(category?: string | null): string {
  if (!category) return "Miscellaneous";
  switch (category) {
    case "ticket_sales":
      return "Ticket Sales";
    case "transfers_in":
      return "Transfers (In)";
    case "transfers_out":
      return "Transfers (Out)";
    case "prize_money":
      return "Prize Money";
    case "facilities":
    case "facility_upgrades":
      return "Facilities";
    case "academy_investment":
      return "Academy Investment";
    case "wages":
      return "Wages";
    case "misc":
      return "Miscellaneous";
    default:
      return cleanText(category);
  }
}

/**
 * Formats match scoring events cleanly (e.g. PENALTY_GOAL -> Penalty Goal, DROP_GOAL -> Drop Goal).
 */
export function formatScoreEventType(type?: MatchScoreEvent["type"] | string | null): string {
  if (!type) return "Score";
  switch (type.toUpperCase()) {
    case "TRY":
      return "Try";
    case "CONVERSION":
      return "Conversion";
    case "PENALTY_GOAL":
      return "Penalty Goal";
    case "DROP_GOAL":
      return "Drop Goal";
    default:
      return cleanText(type);
  }
}

/**
 * Formats match key moment event types cleanly.
 */
export function formatKeyMomentType(type?: KeyMomentType | string | null): string {
  if (!type) return "Moment";
  switch (type.toUpperCase()) {
    case "TRY":
      return "Try";
    case "CONVERSION":
      return "Conversion";
    case "MISSED_CONVERSION":
      return "Missed Conversion";
    case "PENALTY_GOAL":
      return "Penalty Goal";
    case "DROP_GOAL":
      return "Drop Goal";
    case "SIN_BIN":
      return "Sin Bin (10 min)";
    case "RED_CARD":
      return "Red Card";
    case "INJURY":
      return "Injury";
    case "TRY_SAVER":
      return "Try Saver";
    case "FORTY_TWENTY":
      return "40/20 Kick";
    case "HALF_TIME":
      return "Half Time";
    case "FULL_TIME":
      return "Full Time";
    case "GOLDEN_POINT":
      return "Golden Point";
    default:
      return cleanText(type);
  }
}
