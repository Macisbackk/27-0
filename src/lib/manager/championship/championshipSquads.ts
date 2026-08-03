import seedrandom from "seedrandom";
import type { Position, Player } from "../../types";
import { getPlayersByCategory } from "../../players";
import { isHiddenPlayer } from "../../players/goat";
import {
  CHAMPIONSHIP_CLUBS,
  type ChampionshipClub,
} from "../../clubs/championship-clubs";
import {
  CHAMP_NAME_POOLS,
  normalizePlayerFullName,
  type ChampNationalityCode,
} from "./championshipNamePools";

export const GENERATED_CHAMPIONSHIP_SQUADS_VERSION = 1;

export const CHAMP_NATIONALITY_QUOTA: Record<ChampNationalityCode, number> = {
  ENG: 425,
  FRA: 10,
  NZL: 15,
  AUS: 30,
  SAM: 8,
  FJI: 6,
  TON: 4,
  PNG: 2,
};

/** Squad slot template — 25 players capable of a valid 17. */
const SQUAD_POSITION_TEMPLATE: Position[] = [
  "FULLBACK",
  "FULLBACK",
  "WING",
  "WING",
  "WING",
  "WING",
  "CENTRE",
  "CENTRE",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "STAND_OFF",
  "HOOKER",
  "HOOKER",
  "HOOKER",
  "PROP",
  "PROP",
  "PROP",
  "PROP",
  "PROP",
  "SECOND_ROW",
  "SECOND_ROW",
  "SECOND_ROW",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

const NAT_DISPLAY: Record<ChampNationalityCode, string> = {
  ENG: "England",
  FRA: "France",
  NZL: "New Zealand",
  AUS: "Australia",
  SAM: "Samoa",
  FJI: "Fiji",
  TON: "Tonga",
  PNG: "Papua New Guinea",
};

function pickWeightedNationality(rng: () => number): ChampNationalityCode {
  const entries = Object.entries(CHAMP_NATIONALITY_QUOTA) as [
    ChampNationalityCode,
    number,
  ][];
  const total = entries.reduce((s, [, n]) => s + n, 0);
  let roll = rng() * total;
  for (const [code, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return code;
  }
  return "ENG";
}

/**
 * Create a unique replacement Championship player (e.g. after elite sale).
 * Uses the same nationality pools / uniqueness rules as initial generation.
 */
export function createChampionshipReplacementPlayer(
  clubId: string,
  clubName: string,
  rng: () => number,
  existingPlayers: Record<string, ChampionshipGeneratedPlayer>,
  position: Position = "PROP"
): ChampionshipGeneratedPlayer {
  const used = new Set<string>();
  for (const p of Object.values(existingPlayers)) {
    used.add(normalizePlayerFullName(p.name));
  }
  // Also block against database names
  for (const key of collectExistingNameKeys()) used.add(key);

  const nationalityCode = pickWeightedNationality(rng);
  const name = pickUniqueName(nationalityCode, rng, used);
  const uniqueId = `r${Math.floor(rng() * 1_000_000)}`;
  const id = `generated-championship-${clubId}-${uniqueId}`;
  const peakRating = 52 + Math.floor(rng() * 12);
  return {
    id,
    name,
    clubId,
    clubName,
    position,
    eligiblePositions: eligibleFor(position),
    peakRating,
    age: ageForRating(peakRating, rng),
    nationality: NAT_DISPLAY[nationalityCode],
    nationalityCode,
    form: 45 + Math.floor(rng() * 20),
  };
}

export interface ChampionshipGeneratedPlayer {
  id: string;
  name: string;
  clubId: string;
  clubName: string;
  position: Position;
  eligiblePositions: Position[];
  peakRating: number;
  age: number;
  nationality: string;
  nationalityCode: ChampNationalityCode;
  form: number;
}

export interface ChampionshipSquadState {
  version: number;
  /** clubId → player ids */
  rosterByClub: Record<string, string[]>;
  players: Record<string, ChampionshipGeneratedPlayer>;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function buildNationalityAllocation(rng: () => number): ChampNationalityCode[] {
  const pool: ChampNationalityCode[] = [];
  for (const [code, count] of Object.entries(CHAMP_NATIONALITY_QUOTA) as [
    ChampNationalityCode,
    number,
  ][]) {
    for (let i = 0; i < count; i++) pool.push(code);
  }
  if (pool.length !== 500) {
    throw new Error(
      `Championship nationality allocation must be 500, got ${pool.length}`
    );
  }
  return shuffleInPlace(pool, rng);
}

function collectExistingNameKeys(): Set<string> {
  const used = new Set<string>();
  for (const category of ["current", "historic", "legend"] as const) {
    for (const p of getPlayersByCategory(category)) {
      if (isHiddenPlayer(p)) continue;
      used.add(normalizePlayerFullName(p.name));
    }
  }
  return used;
}

function pickUniqueName(
  code: ChampNationalityCode,
  rng: () => number,
  used: Set<string>
): string {
  const pool = CHAMP_NAME_POOLS[code];
  for (let attempt = 0; attempt < 8000; attempt++) {
    const first = pool.first[Math.floor(rng() * pool.first.length)]!;
    const last = pool.last[Math.floor(rng() * pool.last.length)]!;
    const full = `${first} ${last}`;
    const key = normalizePlayerFullName(full);
    if (!used.has(key)) {
      used.add(key);
      return full;
    }
  }
  throw new Error(`Could not allocate unique name for nationality ${code}`);
}

function ratingForClub(
  club: ChampionshipClub,
  slotIndex: number,
  rng: () => number
): number {
  const strength = club.baseStrength;
  // Elite slots rare and tied to stronger clubs
  const roll = rng();
  if (roll > 0.97 && strength >= 68) {
    return Math.round(78 + rng() * 4); // 78–82
  }
  if (roll > 0.88 && strength >= 64) {
    return Math.round(70 + rng() * 7); // 70–77
  }
  if (slotIndex < 17) {
    const mid = strength - 4 + rng() * 10;
    return Math.max(60, Math.min(77, Math.round(mid)));
  }
  const low = strength - 12 + rng() * 10;
  return Math.max(50, Math.min(68, Math.round(low)));
}

function ageForRating(rating: number, rng: () => number): number {
  if (rating >= 78) return 22 + Math.floor(rng() * 8);
  if (rating >= 70) return 20 + Math.floor(rng() * 12);
  return 18 + Math.floor(rng() * 14);
}

function eligibleFor(position: Position): Position[] {
  switch (position) {
    case "FULLBACK":
      return ["FULLBACK", "WING", "CENTRE"];
    case "WING":
      return ["WING", "CENTRE", "FULLBACK"];
    case "CENTRE":
      return ["CENTRE", "WING", "STAND_OFF"];
    case "STAND_OFF":
      return ["STAND_OFF", "SCRUM_HALF", "CENTRE"];
    case "SCRUM_HALF":
      return ["SCRUM_HALF", "STAND_OFF", "HOOKER"];
    case "HOOKER":
      return ["HOOKER", "LOOSE_FORWARD", "SCRUM_HALF"];
    case "PROP":
      return ["PROP", "SECOND_ROW"];
    case "SECOND_ROW":
      return ["SECOND_ROW", "LOOSE_FORWARD", "PROP"];
    case "LOOSE_FORWARD":
      return ["LOOSE_FORWARD", "SECOND_ROW", "HOOKER"];
    default:
      return [position];
  }
}

/**
 * Deterministic one-shot generation of all 500 Championship players for a career.
 */
export function generateChampionshipSquads(
  careerSeed: string,
  seasonYear: number
): ChampionshipSquadState {
  const rng = seedrandom(
    `${careerSeed}-champ-squads-v${GENERATED_CHAMPIONSHIP_SQUADS_VERSION}-y${seasonYear}`
  );
  const nationalityPool = buildNationalityAllocation(rng);
  const usedNames = collectExistingNameKeys();
  const players: Record<string, ChampionshipGeneratedPlayer> = {};
  const rosterByClub: Record<string, string[]> = {};

  let natIndex = 0;
  let seq = 0;

  for (const club of CHAMPIONSHIP_CLUBS) {
    const clubRng = seedrandom(`${careerSeed}-champ-${club.id}-${seasonYear}`);
    const roster: string[] = [];
    for (let slot = 0; slot < SQUAD_POSITION_TEMPLATE.length; slot++) {
      const position = SQUAD_POSITION_TEMPLATE[slot]!;
      const nationalityCode = nationalityPool[natIndex++]!;
      const name = pickUniqueName(nationalityCode, clubRng, usedNames);
      const peakRating = ratingForClub(club, slot, clubRng);
      const uniqueId = `${++seq}`.padStart(4, "0");
      const id = `generated-championship-${club.id}-${uniqueId}`;
      const player: ChampionshipGeneratedPlayer = {
        id,
        name,
        clubId: club.id,
        clubName: club.name,
        position,
        eligiblePositions: eligibleFor(position),
        peakRating,
        age: ageForRating(peakRating, clubRng),
        nationality: NAT_DISPLAY[nationalityCode],
        nationalityCode,
        form: 48 + Math.floor(clubRng() * 20),
      };
      players[id] = player;
      roster.push(id);
    }
    rosterByClub[club.id] = roster;
  }

  validateChampionshipSquadGeneration(players, rosterByClub);

  return {
    version: GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
    rosterByClub,
    players,
  };
}

export function validateChampionshipSquadGeneration(
  players: Record<string, ChampionshipGeneratedPlayer>,
  rosterByClub: Record<string, string[]>
): void {
  const list = Object.values(players);
  if (list.length !== 500) {
    throw new Error(`Expected 500 Championship players, got ${list.length}`);
  }
  const codes: Record<string, number> = {};
  const names = new Set<string>();
  for (const p of list) {
    codes[p.nationalityCode] = (codes[p.nationalityCode] ?? 0) + 1;
    const key = normalizePlayerFullName(p.name);
    if (names.has(key)) {
      throw new Error(`Duplicate Championship name: ${p.name}`);
    }
    names.add(key);
    if (!Number.isFinite(p.peakRating) || p.peakRating < 40 || p.peakRating > 99) {
      throw new Error(`Invalid rating for ${p.id}: ${p.peakRating}`);
    }
  }
  for (const [code, expected] of Object.entries(CHAMP_NATIONALITY_QUOTA)) {
    if ((codes[code] ?? 0) !== expected) {
      throw new Error(
        `Nationality ${code}: expected ${expected}, got ${codes[code] ?? 0}`
      );
    }
  }
  for (const club of CHAMPIONSHIP_CLUBS) {
    const roster = rosterByClub[club.id] ?? [];
    if (roster.length !== 25) {
      throw new Error(`${club.name} roster size ${roster.length}, expected 25`);
    }
  }
}

/** Adapt a generated Championship player to the shared Player shape for sim/UI. */
export function championshipPlayerToPlayer(
  p: ChampionshipGeneratedPlayer
): Player {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    positions: p.eligiblePositions,
    peakRating: p.peakRating,
    club: p.clubName,
    nationality: p.nationality,
    category: "current",
    availableInGame: true,
    yearsActive: String(p.age),
    value: Math.round(p.peakRating * 1200),
    intlCaps: 0,
  };
}

export function getChampionshipPlayer(
  state: ChampionshipSquadState | undefined,
  playerId: string
): ChampionshipGeneratedPlayer | undefined {
  return state?.players[playerId];
}
