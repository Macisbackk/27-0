import eraStarting17sData from "../../../data/era-starting-17s.json";
import type { Position } from "../types";
import { isSuperLeagueSeason } from "./super-league-club-years";
import {
  findEraPlayerByName,
  findPlayerForTeamYearSquad,
} from "./player-name-resolve";
import { getPlayerEligiblePositions } from "./player-positions";
import type { Player } from "../types";

function resolveEraSquadPlayer(
  name: string,
  club: string,
  year: string,
  excludeIds?: Set<string>
): Player | null {
  const exact = findPlayerForTeamYearSquad(name, club, year, { excludeIds });
  if (exact) return exact;

  // Fallback when a season card is missing — keeps older / non-import club-years playable.
  // Prefer name+club+year above; never use a Current 2026 card for a historic year.
  const fallback = findEraPlayerByName(name);
  if (!fallback) return null;
  if (excludeIds?.has(fallback.id)) return null;

  const y = Number.parseInt(year, 10);
  if (fallback.category === "current" && Number.isFinite(y) && y < 2026) {
    return null;
  }

  return fallback;
}

export const ERA_STARTING_17_SIZE = 17;
export const ERA_XIII_FROM_STARTING_17 = 13;
export const ERA_BENCH_FROM_STARTING_17 = 4;

export type EraStarting17Member = {
  number: number;
  position: string;
  name: string;
};

export type EraStarting17Entry = {
  club: string;
  year: number;
  source: string;
  squad: EraStarting17Member[];
};

const STARTING_17_POSITION_MAP: Record<string, Position> = {
  FB: "FULLBACK",
  W: "WING",
  C: "CENTRE",
  FE: "STAND_OFF",
  HB: "SCRUM_HALF",
  FR: "PROP",
  HK: "HOOKER",
  "2R": "SECOND_ROW",
  L: "LOOSE_FORWARD",
};

const EXPECTED_SQUAD_NUMBERS = Array.from({ length: ERA_STARTING_17_SIZE }, (_, i) => i + 1);

function buildIndex(
  entries: EraStarting17Entry[]
): Map<string, Map<string, EraStarting17Entry>> {
  const index = new Map<string, Map<string, EraStarting17Entry>>();
  for (const entry of entries) {
    const byYear = index.get(entry.club) ?? new Map<string, EraStarting17Entry>();
    byYear.set(String(entry.year), entry);
    index.set(entry.club, byYear);
  }
  return index;
}

const ERA_STARTING_17_INDEX = buildIndex(
  eraStarting17sData as EraStarting17Entry[]
);

export function getEraStarting17Entries(): EraStarting17Entry[] {
  return eraStarting17sData as EraStarting17Entry[];
}

export function getEraStarting17Squad(
  club: string,
  year: string
): EraStarting17Entry | null {
  return ERA_STARTING_17_INDEX.get(club)?.get(year) ?? null;
}

export function hasCompleteEraStarting17Squad(
  entry: EraStarting17Entry | null | undefined
): entry is EraStarting17Entry {
  if (!entry || entry.squad.length !== ERA_STARTING_17_SIZE) return false;
  const numbers = entry.squad.map((m) => m.number).sort((a, b) => a - b);
  return EXPECTED_SQUAD_NUMBERS.every((n, i) => numbers[i] === n);
}

export function hasEraStarting17Squad(club: string, year: string): boolean {
  if (!isSuperLeagueSeason(club, year)) return false;
  return hasCompleteEraStarting17Squad(getEraStarting17Squad(club, year));
}

export function getEraStarting17YearsForClub(club: string): string[] {
  const years = ERA_STARTING_17_INDEX.get(club);
  if (!years) return [];
  const currentYear = new Date().getFullYear();
  return [...years.keys()]
    .filter((year) => Number(year) <= currentYear)
    .filter((year) => isSuperLeagueSeason(club, year))
    .filter((year) => hasCompleteEraStarting17Squad(years.get(year)))
    .sort((a, b) => Number(b) - Number(a));
}

function resolveMemberPosition(
  member: EraStarting17Member,
  club: string,
  year: string,
  excludeIds?: Set<string>
): Position | null {
  const mapped = STARTING_17_POSITION_MAP[member.position.trim().toUpperCase()];
  if (mapped) return mapped;
  if (member.position.trim().toUpperCase() === "B") {
    const player = resolveEraSquadPlayer(member.name, club, year, excludeIds);
    if (!player) return null;
    return getPlayerEligiblePositions(player)[0] ?? player.position;
  }
  return null;
}

export type ResolvedEraStarting17 = {
  playerIds: string[];
  xiiiPlayerIds: string[];
  benchPlayerIds: string[];
  slotPositions: Position[];
  benchPositions: Position[];
  missingNames: string[];
};

/** Resolve jersey 1–17 into player IDs — XIII plus bench. */
export function resolveEraStarting17Squad(
  club: string,
  year: string
): ResolvedEraStarting17 | null {
  const entry = getEraStarting17Squad(club, year);
  if (!hasCompleteEraStarting17Squad(entry)) return null;

  const ordered = [...entry.squad].sort((a, b) => a.number - b.number);
  const playerIds: string[] = [];
  const xiiiPlayerIds: string[] = [];
  const benchPlayerIds: string[] = [];
  const slotPositions: Position[] = [];
  const benchPositions: Position[] = [];
  const missingNames: string[] = [];
  const usedIds = new Set<string>();

  for (const member of ordered) {
    const player = resolveEraSquadPlayer(member.name, club, year, usedIds);
    if (!player) {
      missingNames.push(member.name);
      continue;
    }
    const position = resolveMemberPosition(member, club, year, usedIds);
    if (!position) {
      missingNames.push(member.name);
      continue;
    }

    usedIds.add(player.id);
    playerIds.push(player.id);
    if (member.number <= ERA_XIII_FROM_STARTING_17) {
      xiiiPlayerIds.push(player.id);
      slotPositions.push(position);
    } else {
      benchPlayerIds.push(player.id);
      benchPositions.push(position);
    }
  }

  return {
    playerIds,
    xiiiPlayerIds,
    benchPlayerIds,
    slotPositions,
    benchPositions,
    missingNames,
  };
}

/** @deprecated Use resolveEraStarting17Squad */
export function resolveEraStarting17XIII(
  club: string,
  year: string
): ResolvedEraStarting17 | null {
  return resolveEraStarting17Squad(club, year);
}

export function getEraStarting17Source(club: string, year: string): string | null {
  return getEraStarting17Squad(club, year)?.source ?? null;
}
