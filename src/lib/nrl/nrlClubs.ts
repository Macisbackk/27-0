import nrlClubsData from "../../../data/nrl-clubs.json";
import type { Club } from "../clubs";
import {
  DEFAULT_NRL_NAME_BIAS,
  NRL_FIRST_NAMES,
  NRL_LAST_NAMES,
  type NrlNamePool,
} from "./nrlNamePools";
import seedrandom from "seedrandom";

/**
 * NRL club scaffold — colours + metadata for World Club Challenge now,
 * and a stable shape for full NRL career teams later (`playable` stays false).
 */
export interface NrlClubRecord {
  id: string;
  name: string;
  shortName: string;
  nickname: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  league: "nrl";
  active: boolean;
  /** Reserved for a future NRL career mode — never true yet. */
  playable: boolean;
  /** Relative strength band for future season / WCC rating bias (1 weak – 5 elite). */
  strengthTier: 1 | 2 | 3 | 4 | 5;
  city?: string;
  stadium?: string;
  aliases?: string[];
  nameBias?: Partial<Record<NrlNamePool, number>>;
}

export const NRL_CLUBS: NrlClubRecord[] = nrlClubsData as NrlClubRecord[];

/** Display names used by World Club Challenge champion picks. */
export const NRL_WORLD_CLUB_CHALLENGE_TEAMS = NRL_CLUBS.map(
  (c) => c.name
) as readonly string[];

const NRL_BY_NAME = new Map<string, NrlClubRecord>();
const NRL_BY_ID = new Map<string, NrlClubRecord>();

for (const club of NRL_CLUBS) {
  NRL_BY_ID.set(club.id, club);
  NRL_BY_NAME.set(club.name.toLowerCase(), club);
  for (const alias of club.aliases ?? []) {
    NRL_BY_NAME.set(alias.toLowerCase(), club);
  }
  NRL_BY_NAME.set(club.shortName.toLowerCase(), club);
  NRL_BY_NAME.set(club.nickname.toLowerCase(), club);
}

export function getNrlClubByName(name: string): NrlClubRecord | undefined {
  return NRL_BY_NAME.get(name.trim().toLowerCase());
}

export function getNrlClubById(id: string): NrlClubRecord | undefined {
  return NRL_BY_ID.get(id);
}

export function isNrlClubName(name: string): boolean {
  return getNrlClubByName(name) != null;
}

/** Map an NRL record into the shared Club shape for colour / badge helpers. */
export function nrlClubToClub(club: NrlClubRecord): Club {
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    accentColor: club.accentColor,
    active: club.active,
    playable: false,
    isCurrentSuperLeague: false,
    league: "nrl",
  };
}

export function getAllNrlClubsAsClub(): Club[] {
  return NRL_CLUBS.map(nrlClubToClub);
}

function resolveNameBias(
  clubName: string
): Record<NrlNamePool, number> {
  const club = getNrlClubByName(clubName);
  const bias = { ...DEFAULT_NRL_NAME_BIAS };
  if (club?.nameBias) {
    for (const [pool, weight] of Object.entries(club.nameBias)) {
      if (typeof weight === "number") {
        bias[pool as NrlNamePool] = weight;
      }
    }
  }
  return bias;
}

function pickPool(
  rng: () => number,
  weights: Record<NrlNamePool, number>
): NrlNamePool {
  const entries = (Object.entries(weights) as [NrlNamePool, number][]).filter(
    ([, w]) => w > 0
  );
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [pool, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return pool;
  }
  return entries[0]?.[0] ?? "aus";
}

function pickName(rng: () => number, clubName: string): string {
  const weights = resolveNameBias(clubName);
  const firstPool = pickPool(rng, weights);
  // Keep first/last culturally coherent most of the time.
  const lastPool = rng() < 0.78 ? firstPool : pickPool(rng, weights);
  const firsts = NRL_FIRST_NAMES[firstPool];
  const lasts = NRL_LAST_NAMES[lastPool];
  const first = firsts[Math.floor(rng() * firsts.length)]!;
  const last = lasts[Math.floor(rng() * lasts.length)]!;
  return `${first} ${last}`;
}

export interface NrlGeneratedPlayer {
  id: string;
  name: string;
  /** Reserved for full-team squads later. */
  clubId: string;
}

/**
 * Generate a deterministic NRL matchday name list (WCC / future full squads).
 * Uses per-club ethnic bias when the club is known.
 */
export function generateNrlSquadNames(
  seed: string,
  teamName: string,
  count = 13
): NrlGeneratedPlayer[] {
  const club = getNrlClubByName(teamName);
  const clubId = club?.id ?? `nrl-${teamName.toLowerCase().replace(/\s+/g, "-")}`;
  const rng = seedrandom(`${seed}-nrl-squad-${clubId}`);
  const used = new Set<string>();
  const players: NrlGeneratedPlayer[] = [];
  let attempts = 0;
  while (players.length < count && attempts < count * 40) {
    attempts++;
    const name = pickName(rng, teamName);
    if (used.has(name) || name === teamName) continue;
    used.add(name);
    players.push({
      id: `${clubId}-${players.length}`,
      name,
      clubId,
    });
  }
  return players;
}

/** Future-facing strength → WCC rating band helpers. */
export function nrlStrengthTierToBaseRating(tier: 1 | 2 | 3 | 4 | 5): number {
  switch (tier) {
    case 1:
      return 84;
    case 2:
      return 86;
    case 3:
      return 89;
    case 4:
      return 91;
    case 5:
      return 93;
  }
}

export function rollNrlChampionRatingForClub(
  seed: string,
  clubName: string,
  seasonYear: number
): number {
  const club = getNrlClubByName(clubName);
  const base = club
    ? nrlStrengthTierToBaseRating(club.strengthTier)
    : 89;
  const rng = seedrandom(`${seed}-nrl-rating-${clubName}-${seasonYear}`);
  const jitter = Math.floor(rng() * 4) - 1;
  return Math.max(84, Math.min(95, base + jitter));
}
