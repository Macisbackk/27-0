import seedrandom from "seedrandom";
import type { Position, Player } from "../../types";
import { getPlayerById, getPlayersByCategory } from "../../players";
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
import {
  championshipTransferValue,
  ratingForChampionshipClub,
} from "./championshipRatingScale";
import {
  CHAMPIONSHIP_PLAYER_MAX_RATING,
  CHAMPIONSHIP_PLAYER_MIN_RATING,
} from "../../players/rating-floors";
import { getCurrentSquadPlayerIds } from "../../players/era-teams";
import { getEligiblePositions } from "../../players/player-positions";
import { getAgeAtYear } from "../../players/player-age";

/**
 * v7: Prefer real Current DB players on Championship clubs when present;
 * fill remaining slots with generated players. Existing careers keep their
 * squads (ensureChampionship bumps version without regenerating).
 */
export const GENERATED_CHAMPIONSHIP_SQUADS_VERSION = 7;

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
  // Depth / developing Championship replacements (70–75)
  const peakRating = 70 + Math.floor(rng() * 6);
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

/**
 * Championship ratings use a separate 70–89 scale.
 * Targets: squad avg ~73–76 · strong clubs ~75–77 · SL remains ~86–88.
 */
function ratingForClub(
  club: ChampionshipClub,
  slotIndex: number,
  rng: () => number
): number {
  return ratingForChampionshipClub(club, slotIndex, rng);
}

function ageForRating(rating: number, rng: () => number): number {
  if (rating >= 85) return 22 + Math.floor(rng() * 8);
  if (rating >= 82) return 20 + Math.floor(rng() * 12);
  if (rating <= 72) return 18 + Math.floor(rng() * 6);
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

  injectCurrentDatabasePlayers(players, rosterByClub, careerSeed, seasonYear);

  return {
    version: GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
    rosterByClub,
    players,
  };
}

function nationalityCodeFromPlayer(player: Player): ChampNationalityCode {
  const raw = (player.nationality ?? "").toLowerCase();
  if (raw.includes("france") || raw === "fra") return "FRA";
  if (raw.includes("new zealand") || raw === "nzl" || raw.includes("kiwi")) return "NZL";
  if (raw.includes("australia") || raw === "aus") return "AUS";
  if (raw.includes("samoa") || raw === "sam") return "SAM";
  if (raw.includes("fiji") || raw === "fji") return "FJI";
  if (raw.includes("tonga") || raw === "ton") return "TON";
  if (raw.includes("papua") || raw === "png") return "PNG";
  return "ENG";
}

function databasePlayerToChampionship(
  player: Player,
  club: ChampionshipClub,
  seasonYear: number,
  formRng: () => number
): ChampionshipGeneratedPlayer {
  const ageFromDob = getAgeAtYear(player, seasonYear);
  const age =
    ageFromDob !== undefined
      ? Math.max(17, Math.min(40, ageFromDob))
      : 26;
  const rating = Math.max(
    CHAMPIONSHIP_PLAYER_MIN_RATING,
    Math.min(CHAMPIONSHIP_PLAYER_MAX_RATING, Math.round(player.peakRating))
  );
  const nationalityCode = nationalityCodeFromPlayer(player);
  return {
    id: player.id,
    name: player.name,
    clubId: club.id,
    clubName: club.name,
    position: player.position,
    eligiblePositions: getEligiblePositions(player),
    peakRating: rating,
    age,
    nationality: player.nationality || NAT_DISPLAY[nationalityCode],
    nationalityCode,
    form: 48 + Math.floor(formRng() * 20),
  };
}

/**
 * Swap generated roster slots for real Current DB players at the same club.
 * Keeps squad size at 25; leftover slots stay generated.
 */
function injectCurrentDatabasePlayers(
  players: Record<string, ChampionshipGeneratedPlayer>,
  rosterByClub: Record<string, string[]>,
  careerSeed: string,
  seasonYear: number
): void {
  for (const club of CHAMPIONSHIP_CLUBS) {
    const dbIds = getCurrentSquadPlayerIds(club.name);
    if (dbIds.length === 0) continue;

    const roster = [...(rosterByClub[club.id] ?? [])];
    if (roster.length === 0) continue;

    const formRng = seedrandom(`${careerSeed}-champ-db-${club.id}-${seasonYear}`);
    const usedDb = new Set<string>();

    for (const dbId of dbIds) {
      if (usedDb.has(dbId)) continue;
      const dbPlayer = getPlayerById(dbId);
      if (!dbPlayer || dbPlayer.availableInGame === false) continue;
      if (dbPlayer.category !== "current") continue;
      // Skip mis-tagged historic/legend year cards that still sit on Champ clubs.
      if (/-hist-|-leg-/.test(dbId)) continue;

      // Prefer replacing a generated player at the same primary position.
      let replaceIdx = roster.findIndex((id) => {
        const g = players[id];
        return (
          g &&
          g.id.startsWith("generated-championship-") &&
          g.position === dbPlayer.position
        );
      });
      if (replaceIdx < 0) {
        replaceIdx = roster.findIndex((id) =>
          Boolean(players[id]?.id.startsWith("generated-championship-"))
        );
      }
      if (replaceIdx < 0) break;

      const oldId = roster[replaceIdx]!;
      delete players[oldId];
      const injected = databasePlayerToChampionship(
        dbPlayer,
        club,
        seasonYear,
        formRng
      );
      players[injected.id] = injected;
      roster[replaceIdx] = injected.id;
      usedDb.add(dbId);
    }

    rosterByClub[club.id] = roster;
  }
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
    if (
      !Number.isFinite(p.peakRating) ||
      p.peakRating < CHAMPIONSHIP_PLAYER_MIN_RATING ||
      p.peakRating > CHAMPIONSHIP_PLAYER_MAX_RATING
    ) {
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
    // Champ fees stay below SL bands for the same numeric rating.
    value: championshipTransferValue(p.peakRating),
    intlCaps: 0,
  };
}

export function getChampionshipPlayer(
  state: ChampionshipSquadState | undefined,
  playerId: string
): ChampionshipGeneratedPlayer | undefined {
  return state?.players[playerId];
}
