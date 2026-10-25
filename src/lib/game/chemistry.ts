import type { Player, SquadSlot } from "../types";
import { getPlayerDisplayClub } from "../players/run-club";
import { resolveEraTeamClubName } from "../players/era-teams";
import { isCurrentEraSeasonYear } from "../players/current-season";

/**
 * Squad chemistry — Classic mode.
 *
 * Adjacent slots in the same line that share a club OR an era card year form a
 * link worth +0.5 effective team rating, capped at +3.0 for the squad. The sim
 * adds the bonus to the average squad rating when resolving each fixture, so two
 * Wigan centres (or a Bradford '03 half pairing) are worth more than their OVRs.
 *
 * Lines (slot indices from SLOT_DEFINITIONS in positions.ts):
 *   back line  — Left Wing (1) ↔ Left Centre (3), Right Centre (4) ↔ Right Wing (2)
 *   halves     — Stand Off (5) ↔ Scrum Half (6)
 *   front row  — Left Prop (7) ↔ Hooker (8) ↔ Right Prop (9)
 *   back row   — Left Second Row (10) ↔ Loose Forward (11) ↔ Right Second Row (12)
 *
 * Year links only count for era cards: every Current card is a 2026 card, so a
 * shared current season would link the whole side and make the choice meaningless.
 */
export const CHEMISTRY_LINK_BONUS = 0.5;
export const CHEMISTRY_MAX_BONUS = 3.0;

export const CHEMISTRY_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 3],
  [4, 2],
  [5, 6],
  [7, 8],
  [8, 9],
  [10, 11],
  [11, 12],
];

export type ChemistryLinkReason = "club" | "year";

export interface ChemistryLink {
  slotA: number;
  slotB: number;
  reason: ChemistryLinkReason;
  /** Human-readable label — club name or era year. */
  label: string;
}

export interface ChemistryResult {
  /** Effective team-rating bonus (0 … CHEMISTRY_MAX_BONUS, in 0.5 steps). */
  bonus: number;
  links: ChemistryLink[];
}

/** Club identity for chemistry — run club with any era suffix stripped. */
export function getChemistryClub(player: Player): string | null {
  const club = resolveEraTeamClubName(getPlayerDisplayClub(player)).trim();
  return club ? club.toLowerCase() : null;
}

/** Era card year for chemistry — null for current-season cards. */
export function getChemistryYear(player: Player): number | null {
  const year = player.cardYear ?? player.year ?? player.eraYear ?? null;
  if (year === null || !Number.isFinite(year)) return null;
  if (isCurrentEraSeasonYear(year)) return null;
  return year;
}

/** Why two players link, or null when they don't. Club takes precedence over year. */
export function getChemistryLinkReason(
  a: Player,
  b: Player
): { reason: ChemistryLinkReason; label: string } | null {
  const clubA = getChemistryClub(a);
  if (clubA && clubA === getChemistryClub(b)) {
    return {
      reason: "club",
      label: resolveEraTeamClubName(getPlayerDisplayClub(a)),
    };
  }
  const yearA = getChemistryYear(a);
  if (yearA !== null && yearA === getChemistryYear(b)) {
    return { reason: "year", label: `'${String(yearA).slice(-2)}` };
  }
  return null;
}

function playerAt(squad: SquadSlot[], slotIndex: number): Player | null {
  return squad.find((s) => s.slotIndex === slotIndex)?.player ?? null;
}

export function clampChemistryBonus(linkCount: number): number {
  return Math.min(CHEMISTRY_MAX_BONUS, linkCount * CHEMISTRY_LINK_BONUS);
}

export function computeChemistry(squad: SquadSlot[]): ChemistryResult {
  const links: ChemistryLink[] = [];
  for (const [slotA, slotB] of CHEMISTRY_PAIRS) {
    const a = playerAt(squad, slotA);
    const b = playerAt(squad, slotB);
    if (!a || !b) continue;
    const match = getChemistryLinkReason(a, b);
    if (!match) continue;
    links.push({ slotA, slotB, reason: match.reason, label: match.label });
  }
  return { bonus: clampChemistryBonus(links.length), links };
}

/** Chemistry bonus gained by signing `player` into `slotIndex` (0 when nothing changes). */
export function getChemistryGain(
  squad: SquadSlot[],
  slotIndex: number,
  player: Player
): number {
  const before = computeChemistry(squad).bonus;
  const after = computeChemistry(
    squad.map((s) => (s.slotIndex === slotIndex ? { ...s, player } : s))
  ).bonus;
  return Math.round((after - before) * 10) / 10;
}

/** New links created by signing `player` into `slotIndex`. */
export function getNewChemistryLinks(
  squad: SquadSlot[],
  slotIndex: number,
  player: Player
): ChemistryLink[] {
  const after = computeChemistry(
    squad.map((s) => (s.slotIndex === slotIndex ? { ...s, player } : s))
  );
  return after.links.filter((l) => l.slotA === slotIndex || l.slotB === slotIndex);
}

export function formatChemistryBonus(bonus: number): string {
  return `${bonus > 0 ? "+" : ""}${bonus.toFixed(1)}`;
}
