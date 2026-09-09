import { getPlayerDisplayName } from "@/lib/players/display-name-resolver";
import { getShowcasePlayers, isHistoricPlayer } from "@/lib/players";
import { expandNameLookupKeys } from "@/lib/players/player-name-resolve";
import { normalizePlayerNameKey } from "@/lib/player-name-normalize";
import { POSITION_LABELS } from "@/lib/positions";
import { getCurrentSeasonYearNumber } from "@/lib/players/rating-context";
import { resolveBirthYear } from "@/lib/players/player-age";
import { parseYearFromPlayerId } from "@/lib/players/year-card";
import { getClubByName } from "@/lib/clubs";
import birthYearsData from "../../../data/birth-years.json";
import type { Player, Position } from "@/lib/types";
import {
  isEligibleMiniGameCurrentTeam,
  isEligibleMiniGamePlayer,
  normalizeMiniGameNationKey,
  resolveMiniGameClubName,
} from "./eligibility";
import {
  filterPoolByMode,
  type MiniGamePoolMode,
} from "./pool-mode";

const BIRTH_YEARS = birthYearsData as Record<string, number>;

export type MiniGamePlayer = {
  id: string;
  identityId: string;
  displayName: string;
  club: string;
  clubId: string;
  position: Position;
  positionLabel: string;
  nationality: string;
  nationalityKey: string;
  rating: number;
  /** Age at the card season year (Wordle / player info). */
  age: number;
  /** Internal season pin — never show in Wordle UI. */
  year: number;
  isHistoric: boolean;
};

function playerIdentityId(player: Player): string {
  if (player.basePlayerId) return player.basePlayerId;
  if (player.baseId) return player.baseId;
  const yearFromId = parseYearFromPlayerId(player.id);
  if (yearFromId) {
    return player.id.slice(0, -(String(yearFromId).length + 1));
  }
  return player.id;
}

function birthYearForMiniGame(player: Player): number | undefined {
  const direct = resolveBirthYear(
    player.birthYear,
    player.dateOfBirth,
    player.yearsActive
  );
  if (direct !== undefined) return direct;

  const candidates = [
    player.id,
    player.basePlayerId,
    player.baseId,
    playerIdentityId(player),
  ].filter((id): id is string => Boolean(id));

  for (const id of candidates) {
    if (BIRTH_YEARS[id] != null) return BIRTH_YEARS[id];
    const asCurrent = id
      .replace(/-hist-era-/g, "-cur-")
      .replace(/-hist-/g, "-cur-")
      .replace(/-\d{4}$/, "");
    if (BIRTH_YEARS[asCurrent] != null) return BIRTH_YEARS[asCurrent];
  }
  return undefined;
}

function resolveCardYear(player: Player): number | undefined {
  const year =
    player.year ?? player.cardYear ?? player.eraYear ?? player.primeYear;
  if (typeof year === "number" && Number.isFinite(year) && year >= 1895) {
    return year;
  }
  const fromId = parseYearFromPlayerId(player.id);
  if (fromId) return fromId;
  if (!isHistoricPlayer(player)) return getCurrentSeasonYearNumber();
  return undefined;
}

function toMiniGamePlayer(player: Player): MiniGamePlayer | null {
  if (!isEligibleMiniGamePlayer(player)) return null;
  const displayName = getPlayerDisplayName(player).trim();
  const rawClub = (player.displayClub ?? player.team ?? player.club ?? "").trim();
  const club = resolveMiniGameClubName(rawClub) ?? rawClub;
  const clubRecord = getClubByName(club);
  const nationality = (player.nationality ?? "").trim();
  const rating = player.peakRating;
  const year = resolveCardYear(player);
  if (!displayName || !club || !nationality || !year) return null;
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 40) {
    return null;
  }
  const birthYear = birthYearForMiniGame(player);
  if (birthYear === undefined) return null;
  const age = year - birthYear;
  if (!Number.isFinite(age) || age < 16 || age > 55) return null;
  const position = player.position;
  const positionLabel = POSITION_LABELS[position];
  if (!positionLabel) return null;

  return {
    id: player.id,
    identityId: playerIdentityId(player),
    displayName,
    club,
    clubId: clubRecord?.id ?? club.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    position,
    positionLabel,
    nationality,
    nationalityKey: normalizeMiniGameNationKey(nationality),
    rating: Math.round(rating),
    age,
    year,
    isHistoric: isHistoricPlayer(player),
  };
}

function preferWordleCard(a: MiniGamePlayer, b: MiniGamePlayer): MiniGamePlayer {
  if (a.isHistoric !== b.isHistoric) return a.isHistoric ? b : a;
  if (a.year !== b.year) return a.year > b.year ? a : b;
  if (a.rating !== b.rating) return a.rating > b.rating ? a : b;
  return a.displayName.localeCompare(b.displayName) <= 0 ? a : b;
}

/**
 * Recent Super League season cards (current or previous year) count as Current
 * for Wordle even when filed under historic team-year packs — e.g. Josh Charnley
 * at Leigh 2025, not his older Wigan historic cards.
 */
function isWordlePlayingTodayCard(player: MiniGamePlayer): boolean {
  if (!player.isHistoric) return true;
  if (player.year < getCurrentSeasonYearNumber() - 1) return false;
  return isEligibleMiniGameCurrentTeam(player.club);
}

let wordlePoolCache: MiniGamePlayer[] | null = null;
let higherLowerPoolCache: MiniGamePlayer[] | null = null;

/**
 * One canonical card per real-world Super League player for Wordle.
 * Prefer a true current card; never keep a historic card when a current
 * namesake exists. Historic status is only for players not playing today.
 */
export function getWordlePlayerPool(
  mode?: MiniGamePoolMode
): MiniGamePlayer[] {
  if (!wordlePoolCache) {
    wordlePoolCache = buildWordlePlayerPool();
  }
  return mode ? filterPoolByMode(wordlePoolCache, mode) : wordlePoolCache;
}

function buildWordlePlayerPool(): MiniGamePlayer[] {
  const currentByName = new Map<string, MiniGamePlayer>();
  const historicByName = new Map<string, MiniGamePlayer>();

  for (const raw of getShowcasePlayers()) {
    const player = toMiniGamePlayer(raw);
    if (!player) continue;
    const nameKey = normalizePlayerNameKey(player.displayName);
    if (!player.isHistoric) {
      const existing = currentByName.get(nameKey);
      currentByName.set(
        nameKey,
        existing ? preferWordleCard(existing, player) : player
      );
      continue;
    }
    const existing = historicByName.get(nameKey);
    historicByName.set(
      nameKey,
      existing ? preferWordleCard(existing, player) : player
    );
  }

  const pool: MiniGamePlayer[] = [];
  const seen = new Set<string>();

  for (const [nameKey, current] of currentByName) {
    seen.add(nameKey);
    pool.push({ ...current, isHistoric: false });
  }

  for (const [nameKey, historic] of historicByName) {
    if (seen.has(nameKey) || currentByName.has(nameKey)) continue;
    const playingToday = isWordlePlayingTodayCard(historic);
    pool.push({ ...historic, isHistoric: !playingToday });
  }

  return pool.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Higher or Lower uses one card per identity (peak rating) so season labels
 * are optional presentation, not duplicate people.
 */
export function getHigherLowerPlayerPool(
  mode?: MiniGamePoolMode
): MiniGamePlayer[] {
  if (!higherLowerPoolCache) {
    const byIdentity = new Map<string, MiniGamePlayer>();
    for (const raw of getShowcasePlayers()) {
      const player = toMiniGamePlayer(raw);
      if (!player) continue;
      const existing = byIdentity.get(player.identityId);
      byIdentity.set(
        player.identityId,
        existing ? preferWordleCard(existing, player) : player
      );
    }
    higherLowerPoolCache = [...byIdentity.values()];
  }
  return mode
    ? filterPoolByMode(higherLowerPoolCache, mode)
    : higherLowerPoolCache;
}

export function formatMiniGamePlayerLabel(
  player: MiniGamePlayer,
  options?: { showYear?: boolean }
): string {
  if (options?.showYear && player.isHistoric) {
    return `${player.displayName} — ${player.year}`;
  }
  return player.displayName;
}

export function findMiniGamePlayerById(
  id: string,
  pool: readonly MiniGamePlayer[]
): MiniGamePlayer | undefined {
  return pool.find((player) => player.id === id);
}

export function resolvePlayerGuess(
  query: string,
  pool: readonly MiniGamePlayer[]
): MiniGamePlayer | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const byId = pool.find((player) => player.id === trimmed);
  if (byId) return byId;

  const guessKeys = new Set(expandNameLookupKeys(trimmed));
  const matches: MiniGamePlayer[] = [];
  for (const player of pool) {
    const nameKeys = expandNameLookupKeys(player.displayName);
    if (nameKeys.some((key) => guessKeys.has(key))) {
      matches.push(player);
    }
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0] ?? null;

  const exactKey = normalizePlayerNameKey(trimmed);
  const exact = matches.find(
    (player) => normalizePlayerNameKey(player.displayName) === exactKey
  );
  return exact ?? matches[0] ?? null;
}

const AUTOCOMPLETE_LIMIT = 8;

export function suggestPlayers(
  query: string,
  pool: readonly MiniGamePlayer[],
  limit = AUTOCOMPLETE_LIMIT
): MiniGamePlayer[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  const seen = new Set<string>();
  const starts: MiniGamePlayer[] = [];
  const contains: MiniGamePlayer[] = [];
  for (const player of pool) {
    const name = player.displayName.toLowerCase();
    const key = player.identityId;
    if (seen.has(key) || seen.has(name)) continue;
    if (name.startsWith(trimmed)) {
      seen.add(key);
      seen.add(name);
      starts.push(player);
    } else if (name.includes(trimmed)) {
      seen.add(key);
      seen.add(name);
      contains.push(player);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
