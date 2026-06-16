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
import {
  getTeamSpinPool,
  getYearSpinPool,
  type SlotRevealTarget,
} from "./recruitment-slot-reveal";

export interface SlotTeamYearPlayer {
  player: Player;
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

/** Deterministic team/year draw for a recruitment spin (position-agnostic). */
export function generateSlotTeamYearTarget(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>
): SlotRevealTarget {
  const rng = seedrandom(`${seed}-slot-team-year-spin-${spinIndex}`);
  const pairs = getAllTeamYearPairs();

  const pool = pairs.filter(
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

/** Positions eligible when recruiting for a given slot (SH/SO swap). */
export function getEligibleRecruitPositions(
  slotPosition: Position
): Position[] {
  if (slotPosition === "SCRUM_HALF") return ["SCRUM_HALF", "STAND_OFF"];
  if (slotPosition === "STAND_OFF") return ["STAND_OFF", "SCRUM_HALF"];
  return [slotPosition];
}

function sortPlayersForRecruitSlot(
  entries: SlotTeamYearPlayer[],
  slotPosition?: Position
): SlotTeamYearPlayer[] {
  if (!slotPosition) {
    return entries.sort((a, b) => b.player.peakRating - a.player.peakRating);
  }

  const eligible = new Set(getEligibleRecruitPositions(slotPosition));
  return entries.sort((a, b) => {
    const aEligible = eligible.has(a.player.position);
    const bEligible = eligible.has(b.player.position);
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    return b.player.peakRating - a.player.peakRating;
  });
}

export function prepareSlotTeamYearPlayers(
  target: SlotRevealTarget,
  usedIds: Set<string>,
  slotPosition?: Position
): SlotTeamYearPlayer[] {
  const eraYear = Number.parseInt(target.year, 10);
  const runClub = formatEraDisplayName(target.team, target.year);

  const entries = rosterPlayersForPair(target.team, target.year, usedIds).map(
    (player) => {
      const prepared = withRunClub(player, runClub, {
        eraYear: Number.isFinite(eraYear) ? eraYear : undefined,
      });
      return { player: prepared };
    }
  );

  return sortPlayersForRecruitSlot(entries, slotPosition);
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
  return `${team} ${year} lands in the slot — ${line}.`;
}
