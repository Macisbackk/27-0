import type { DailyChallengeRule } from "../daily-challenge";
import { DAILY_HOMEGROWN_NATIONALITIES } from "../daily-challenge";
import type { Player } from "../types";
import type { TeamYearPool } from "./team-year-pools";

/**
 * Daily Challenge spin restriction. `poolFilter` narrows which team-years a spin can land on;
 * `playerFilter` narrows who can be offered from that team-year. Spin code applies both
 * strictly first and falls back to the unrestricted pools only if the rule would leave a slot
 * empty, so a run can never soft-lock (scripts/test-daily-rules.ts checks the strict path
 * fills all 13 slots for every rule).
 */
export interface SpinRuleFilter {
  /** Stable id for memo keys / debugging. */
  id: string;
  poolFilter?: (pool: TeamYearPool) => boolean;
  playerFilter?: (player: Player) => boolean;
}

const HOMEGROWN = new Set<string>(DAILY_HOMEGROWN_NATIONALITIES);

function isHomegrown(player: Player): boolean {
  return HOMEGROWN.has(player.nationality?.trim() ?? "");
}

function isOverseas(player: Player): boolean {
  const nationality = player.nationality?.trim() ?? "";
  return nationality !== "" && nationality.toLowerCase() !== "unknown" && !HOMEGROWN.has(nationality);
}

/** Spin filter for a Daily rule, or null when the rule doesn't restrict the spin pools. */
export function getSpinRuleFilter(
  rule: DailyChallengeRule | null | undefined
): SpinRuleFilter | null {
  if (!rule) return null;
  switch (rule.type) {
    case "one-club":
      return {
        id: `one-club:${rule.club}`,
        poolFilter: (pool) => pool.team === rule.club,
      };
    case "era-night":
      return {
        id: `era-night:${rule.fromYear}-${rule.toYear}`,
        poolFilter: (pool) => {
          const year = Number.parseInt(pool.year, 10);
          return year >= rule.fromYear && year <= rule.toYear;
        },
      };
    case "underdogs":
      return {
        id: `underdogs:${rule.maxRating}`,
        playerFilter: (player) => player.peakRating <= rule.maxRating,
      };
    case "homegrown":
      return { id: "homegrown", playerFilter: isHomegrown };
    case "overseas":
      return { id: "overseas", playerFilter: isOverseas };
    case "giant-killers":
    case "no-respins":
      return null;
  }
}

/** True when the pool is allowed by the filter (no filter = allowed). */
export function poolPassesRule(
  pool: TeamYearPool,
  filter: SpinRuleFilter | null | undefined
): boolean {
  return !filter?.poolFilter || filter.poolFilter(pool);
}

/** True when the player is allowed by the filter (no filter = allowed). */
export function playerPassesRule(
  player: Player,
  filter: SpinRuleFilter | null | undefined
): boolean {
  return !filter?.playerFilter || filter.playerFilter(player);
}

/** Apply the player filter, keeping the unfiltered list if the rule would empty it. */
export function applyPlayerRuleWithFallback<T extends Player>(
  players: T[],
  filter: SpinRuleFilter | null | undefined
): T[] {
  if (!filter?.playerFilter) return players;
  const ruled = players.filter(filter.playerFilter);
  return ruled.length > 0 ? ruled : players;
}
