import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { formatEraDisplayName } from "../players/era-teams";
import { withRunClub } from "../players/run-club";
import {
  getTeamsWithYearRosters,
  getYearsForTeam,
  getRosterPlayerIds,
  hasTeamYearRoster,
} from "../players/team-year-rosters";
import type { Player, Position } from "../types";
import { getDraftCandidatePositions } from "./draft-positions";
import {
  getTeamSpinPool,
  getYearSpinPool,
  type SlotRevealTarget,
} from "./recruitment-slot-reveal";

export type SlotPlayerTier = "exact" | "compatible" | "other";

export interface SlotTeamYearPlayer {
  player: Player;
  tier: SlotPlayerTier;
}

interface TeamYearPair {
  team: string;
  year: string;
}

function getAllTeamYearPairs(): TeamYearPair[] {
  const pairs: TeamYearPair[] = [];
  for (const team of getTeamsWithYearRosters()) {
    for (const year of getYearsForTeam(team)) {
      if (hasTeamYearRoster(team, year)) {
        pairs.push({ team, year });
      }
    }
  }
  return pairs;
}

function rosterPlayersForPair(
  team: string,
  year: string,
  usedIds: Set<string>
): Player[] {
  return getRosterPlayerIds(team, year)
    .map((id) => getPlayerById(id))
    .filter((p): p is Player => !!p && !usedIds.has(p.id));
}

function classifyPlayerTier(
  player: Player,
  slotPosition: Position
): SlotPlayerTier {
  if (player.position === slotPosition) return "exact";
  const compatible = getDraftCandidatePositions(slotPosition);
  if (compatible.includes(player.position)) return "compatible";
  return "other";
}

function tierSortOrder(tier: SlotPlayerTier): number {
  if (tier === "exact") return 0;
  if (tier === "compatible") return 1;
  return 2;
}

/** Deterministic team/year draw for a recruitment slot. */
export function generateSlotTeamYearTarget(
  seed: string,
  slotIndex: number,
  slotPosition: Position,
  usedIds: Set<string>
): SlotRevealTarget {
  const rng = seedrandom(`${seed}-slot-team-year-${slotIndex}`);
  const pairs = getAllTeamYearPairs();

  const withCompatible = pairs.filter((pair) => {
    const players = rosterPlayersForPair(pair.team, pair.year, usedIds);
    return players.some(
      (p) => classifyPlayerTier(p, slotPosition) !== "other"
    );
  });

  const pool = withCompatible.length > 0 ? withCompatible : pairs.filter(
    (pair) => rosterPlayersForPair(pair.team, pair.year, usedIds).length > 0
  );

  if (pool.length === 0) {
    const fallbackTeam = getTeamsWithYearRosters()[0] ?? "Wigan Warriors";
    const fallbackYear = getYearsForTeam(fallbackTeam)[0] ?? "2026";
    return { team: fallbackTeam, year: fallbackYear };
  }

  const pick = pool[Math.floor(rng() * pool.length)]!;
  return { team: pick.team, year: pick.year };
}

export function getSlotTeamYearSpinPools(target: SlotRevealTarget): {
  teams: string[];
  years: string[];
} {
  return {
    teams: getTeamSpinPool(target.team),
    years: getYearSpinPool(target.year),
  };
}

export function prepareSlotTeamYearPlayers(
  target: SlotRevealTarget,
  slotPosition: Position,
  usedIds: Set<string>
): SlotTeamYearPlayer[] {
  const eraYear = Number.parseInt(target.year, 10);
  const runClub = formatEraDisplayName(target.team, target.year);

  const entries = rosterPlayersForPair(target.team, target.year, usedIds).map(
    (player) => {
      const tier = classifyPlayerTier(player, slotPosition);
      const prepared = withRunClub(player, runClub, {
        eraYear: Number.isFinite(eraYear) ? eraYear : undefined,
      });
      return { player: prepared, tier };
    }
  );

  return entries.sort((a, b) => {
    const tierDiff = tierSortOrder(a.tier) - tierSortOrder(b.tier);
    if (tierDiff !== 0) return tierDiff;
    return b.player.peakRating - a.player.peakRating;
  });
}

const BIO_SNIPPETS = {
  powerhouse: [
    "a powerhouse era packed with title-winning quality",
    "a golden generation built for big nights",
    "serious pedigree and plenty of star power",
  ],
  modern: [
    "a modern squad with serious top-end talent",
    "pace, power and plenty of big-game pedigree",
    "contemporary quality across the spine",
  ],
  classic: [
    "old-school grit with match-winning class",
    "a classic side that knew how to grind out wins",
    "hard-nosed rugby with genuine star names",
  ],
  default: [
    "a draw packed with recruitment intrigue",
    "plenty of talent waiting in the squad",
    "a squad worth building around",
  ],
} as const;

export function getSlotRevealBio(team: string, year: string): string {
  const y = Number.parseInt(year, 10);
  const key = `${team}|${year}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  }

  let pool: readonly string[];
  if (y >= 2024) pool = BIO_SNIPPETS.modern;
  else if (y <= 2005) pool = BIO_SNIPPETS.classic;
  else if (y >= 2010 && y <= 2016) pool = BIO_SNIPPETS.powerhouse;
  else pool = BIO_SNIPPETS.default;

  const line = pool[hash % pool.length]!;
  return `You've landed ${team} ${year} — ${line}.`;
}
