/**
 * One-Club XI — pick a club; every spin lands on one of that club's seasons (historic Era cards
 * and the 2026 squad), build the 13, then play the normal league season.
 *
 * The season uses the one 27-0 formula (sim-formula.ts) unchanged. Like Classic vs Era, raw
 * ratings are never compared across pools: a one-club squad is placed on its own club's draft
 * ladder first,
 *
 *   q = (squad avg − TYPICAL[club]) / (ELITE[club] − TYPICAL[club])
 *
 * and then mapped onto the Era ladder (same q ⇒ same team strength ⇒ same odds), so an all-time
 * Wakefield XI and an all-time Saints XI are both "typical draft ≈ Era typical draft". Chemistry
 * is normalised the same way: a one-club side links almost every pair on club, so its typical
 * chemistry (≈ +3) is the baseline, not a bonus. The anchors per club are the mean squad ratings
 * of simulated drafts through the real spin flow (scripts/sim-one-club-gauntlet.ts writes
 * one-club-scale.ts).
 */
import type { SquadSlot } from "../types";
import { getAverageSquadRating } from "../squad-analysis";
import { computeChemistry } from "./chemistry";
import { getSpinTeamYearPoolsCached } from "./player-pool-eligibility";
import type { SpinRuleFilter } from "./daily-rule-filter";
import { SIM_FORMULA_MODE_SCALE, type SimFormulaModeScale } from "./sim-formula";
import { ONE_CLUB_SCALE } from "./one-club-scale";

/** Clubs need at least this many seasons in the spin pools to have an "all-time" XI. */
export const ONE_CLUB_MIN_TEAM_YEARS = 3;

export interface OneClubOption {
  club: string;
  slug: string;
  /** Seasons (team-years) the spins can land on, 2026 included. */
  teamYears: number;
  firstYear: number;
  lastYear: number;
}

export function oneClubSlug(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cachedOptions: OneClubOption[] | null = null;

/** Every club with enough seasons for One-Club XI, A–Z. */
export function getOneClubOptions(): OneClubOption[] {
  if (cachedOptions) return cachedOptions;
  const years = new Map<string, number[]>();
  for (const pool of getSpinTeamYearPoolsCached("all")) {
    const list = years.get(pool.team) ?? [];
    list.push(Number.parseInt(pool.year, 10));
    years.set(pool.team, list);
  }
  cachedOptions = [...years]
    .filter(([, list]) => list.length >= ONE_CLUB_MIN_TEAM_YEARS)
    .map(([club, list]) => ({
      club,
      slug: oneClubSlug(club),
      teamYears: list.length,
      firstYear: Math.min(...list),
      lastYear: Math.max(...list),
    }))
    .sort((a, b) => a.club.localeCompare(b.club));
  return cachedOptions;
}

export function getOneClubBySlug(slug: string | null | undefined): OneClubOption | null {
  if (!slug) return null;
  return getOneClubOptions().find((o) => o.slug === slug) ?? null;
}

/** Spin filter: every spin lands on one of the club's seasons (pool variant "all"). */
export function getOneClubRuleFilter(club: string): SpinRuleFilter {
  return { id: `one-club-xi:${club}`, poolFilter: (pool) => pool.team === club };
}

/** Draft ladder for a club (falls back to the Era ladder for a club missing from the table). */
export function getOneClubScale(club: string): SimFormulaModeScale {
  return ONE_CLUB_SCALE[club] ?? SIM_FORMULA_MODE_SCALE.era;
}

/** Where a one-club squad rating sits on its club's ladder (0 typical, 1 near-perfect). */
export function getOneClubDraftQuality(avgRating: number, club: string): number {
  const scale = getOneClubScale(club);
  return (avgRating - scale.typicalRating) / (scale.eliteRating - scale.typicalRating);
}

/**
 * What the season sim should treat this squad as: an Era-ladder rating and chemistry with the
 * same draft quality. Pass to simulateSeason as `formulaOverride` (with currentSeasonOnly false).
 */
export function getOneClubFormulaOverride(
  squad: SquadSlot[],
  club: string
): { avgRating: number; chemistry: number } {
  const era = SIM_FORMULA_MODE_SCALE.era;
  const scale = getOneClubScale(club);
  const q = getOneClubDraftQuality(getAverageSquadRating(squad), club);
  return {
    avgRating: era.typicalRating + q * (era.eliteRating - era.typicalRating),
    // One-Club keeps its own difficulty: cancel the small edge Era opponents get (v1.36).
    chemistry:
      computeChemistry(squad).bonus - scale.typicalChemistry + era.typicalChemistry + (era.opponentEdge ?? 0),
  };
}
