import { isSuperLeagueSeason } from "./super-league-club-years";
import eraWikipediaSquadsData from "../../../data/era-wikipedia-squads.json";
import slVerifiedSquadsData from "../../../data/sl-era-verified-squads.json";
import type { Position } from "../types";

export interface EraWikipediaSquadEntry {
  /** Player IDs ordered to match SQUAD_STRUCTURE slot fill order. */
  playerIds: string[];
  positions: string[];
  source: string;
  wikipediaPlayers: string[];
  verifiedAt: string;
}

export type EraWikipediaSquads = Record<
  string,
  Record<string, EraWikipediaSquadEntry>
>;

type VerifiedSquads = Record<
  string,
  Record<string, Partial<EraWikipediaSquadEntry> & { playerIds: string[] }>
>;

function mergeVerifiedSquads(
  wiki: EraWikipediaSquads,
  verified: VerifiedSquads
): EraWikipediaSquads {
  const merged: EraWikipediaSquads = {};
  for (const [club, years] of Object.entries(wiki)) {
    merged[club] = { ...years };
  }
  for (const [club, years] of Object.entries(verified)) {
    if (!merged[club]) merged[club] = {};
    for (const [year, entry] of Object.entries(years)) {
      if (entry?.playerIds?.length !== 13) continue;
      merged[club][year] = {
        playerIds: entry.playerIds,
        positions: entry.positions ?? [],
        source: entry.source ?? "verified",
        wikipediaPlayers: entry.wikipediaPlayers ?? [],
        verifiedAt: entry.verifiedAt ?? "sl-era-verified-squads.json",
      };
    }
  }
  return merged;
}

const ERA_WIKIPEDIA_SQUADS = mergeVerifiedSquads(
  eraWikipediaSquadsData as EraWikipediaSquads,
  slVerifiedSquadsData as unknown as VerifiedSquads
);

export function getEraWikipediaSquads(): EraWikipediaSquads {
  return ERA_WIKIPEDIA_SQUADS;
}

export function getEraWikipediaSquadPlayerIds(
  club: string,
  year: string
): string[] | null {
  const entry = ERA_WIKIPEDIA_SQUADS[club]?.[year];
  return entry?.playerIds?.length === 13 ? [...entry.playerIds] : null;
}

export function getEraWikipediaSquadPositions(
  club: string,
  year: string
): Position[] | null {
  const entry = ERA_WIKIPEDIA_SQUADS[club]?.[year];
  if (!entry || entry.playerIds.length !== 13) return null;
  return entry.positions as Position[];
}

export function hasEraWikipediaSquad(club: string, year: string): boolean {
  if (!isSuperLeagueSeason(club, year)) return false;
  return getEraWikipediaSquadPlayerIds(club, year) !== null;
}

export function getEraWikipediaYearsForClub(club: string): string[] {
  const years = ERA_WIKIPEDIA_SQUADS[club];
  if (!years) return [];
  const currentYear = new Date().getFullYear();
  return Object.keys(years)
    .filter((year) => Number(year) <= currentYear)
    .filter((year) => isSuperLeagueSeason(club, year))
    .filter((year) => (years[year]?.playerIds?.length ?? 0) === 13)
    .sort((a, b) => Number(b) - Number(a));
}

export function getEraWikipediaSource(club: string, year: string): string | null {
  return ERA_WIKIPEDIA_SQUADS[club]?.[year]?.source ?? null;
}

/** Wikipedia-verified slot position for a player in a team-year, if available. */
export function getTeamYearWikipediaPosition(
  club: string,
  year: string,
  playerId: string
): Position | null {
  const entry = ERA_WIKIPEDIA_SQUADS[club]?.[year];
  if (!entry || entry.playerIds.length !== 13) return null;
  const idx = entry.playerIds.indexOf(playerId);
  if (idx < 0) return null;
  return (entry.positions[idx] as Position) ?? null;
}
