import { normalizePlayerNameKey } from "../player-name-normalize";
import { PLAYER_NAME_ALIASES } from "./player-name-aliases";
import { playerBelongsToTeamYear } from "./team-year-membership";
import { getAllDatabasePlayers } from "./index";
import type { Player } from "../types";

const WIKI_NAME_ALIASES = PLAYER_NAME_ALIASES;

const FIRST_NAME_VARIANTS: Record<string, string[]> = {
  mike: ["michael"],
  michael: ["mike"],
  richard: ["richie"],
  richie: ["richard"],
  elliot: ["elliott"],
  elliott: ["elliot"],
  steve: ["stephen", "steven"],
  stephen: ["steve", "steven"],
  steven: ["stephen", "steve"],
  tom: ["thomas", "tommy"],
  thomas: ["tom", "tommy"],
  tommy: ["tom", "thomas"],
  jim: ["james"],
  james: ["jim"],
  joe: ["joseph"],
  joseph: ["joe"],
  chris: ["christopher"],
  christopher: ["chris"],
  matt: ["matthew"],
  matthew: ["matt"],
  dan: ["daniel"],
  daniel: ["dan"],
  ben: ["benjamin"],
  benjamin: ["ben"],
  alex: ["alexander"],
  alexander: ["alex"],
  jon: ["jonathan", "john"],
  jonathan: ["jon", "john"],
  john: ["jon", "jonathan"],
  theo: ["théo"],
  "théo": ["theo"],
};

function foldApostrophes(value: string): string {
  return value
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/'/g, "");
}

function expandMcCasing(value: string): string {
  return value.replace(/\bmc([a-z])/g, (_, letter: string) => `mc${letter.toUpperCase()}`);
}

export function expandNameLookupKeys(name: string): string[] {
  const keys = new Set<string>();

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalized = normalizePlayerNameKey(trimmed);
    if (!normalized) return;
    keys.add(normalized);
    keys.add(normalized.replace(/\s+/g, ""));
    keys.add(foldApostrophes(normalized));
    keys.add(foldApostrophes(normalized).replace(/\s+/g, ""));
    keys.add(normalized.replace(/-/g, " "));
    keys.add(expandMcCasing(normalized));
  };

  add(name);
  add(name.replace(/-/g, " "));
  add(foldApostrophes(name));

  for (const aliasKey of getPlayerNameLookupKeys(name)) {
    add(aliasKey);
  }

  const base = normalizePlayerNameKey(name);
  const parts = base.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(" ");
    const variants = FIRST_NAME_VARIANTS[first] ?? [];
    for (const variant of variants) {
      add(`${variant} ${rest}`);
    }
  }

  return [...keys];
}

export function getPlayerNameLookupKeys(name: string): string[] {
  const base = normalizePlayerNameKey(name);
  const keys = new Set<string>([
    base,
    base.replace(/-/g, " "),
    foldApostrophes(base),
  ]);
  const visited = new Set<string>();
  let alias: string | undefined = WIKI_NAME_ALIASES[base];
  while (alias && !visited.has(alias)) {
    visited.add(alias);
    keys.add(alias);
    keys.add(alias.replace(/-/g, " "));
    keys.add(foldApostrophes(alias));
    alias = WIKI_NAME_ALIASES[alias];
  }
  return [...keys];
}

function buildPlayerNameIndex(includeUnavailable: boolean): Map<string, Player[]> {
  const index = new Map<string, Player[]>();
  for (const player of getAllDatabasePlayers()) {
    if (!includeUnavailable && player.availableInGame === false) continue;
    for (const key of expandNameLookupKeys(player.name)) {
      const list = index.get(key) ?? [];
      list.push(player);
      index.set(key, list);
    }
  }
  return index;
}

function pickBestCandidate(candidates: Player[]): Player | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const availA = a.availableInGame !== false ? 1 : 0;
    const availB = b.availableInGame !== false ? 1 : 0;
    if (availA !== availB) return availB - availA;
    return (b.peakRating ?? 0) - (a.peakRating ?? 0);
  });
  return candidates[0] ?? null;
}

function findPlayerByNameInternal(
  name: string,
  includeUnavailable: boolean
): Player | null {
  const index = includeUnavailable
    ? getEraPlayerNameIndex()
    : getPlayerNameIndex();
  for (const key of expandNameLookupKeys(name)) {
    const candidates = index.get(key) ?? [];
    const pick = pickBestCandidate(candidates);
    if (pick) return pick;
  }
  return null;
}

let playerNameIndex: Map<string, Player[]> | null = null;
let eraPlayerNameIndex: Map<string, Player[]> | null = null;

function getEraPlayerNameIndex(): Map<string, Player[]> {
  if (eraPlayerNameIndex) return eraPlayerNameIndex;
  eraPlayerNameIndex = buildPlayerNameIndex(true);
  return eraPlayerNameIndex;
}

export function clearPlayerNameIndexCache(): void {
  playerNameIndex = null;
  eraPlayerNameIndex = null;
}

function getPlayerNameIndex(): Map<string, Player[]> {
  if (playerNameIndex) return playerNameIndex;
  playerNameIndex = buildPlayerNameIndex(false);
  return playerNameIndex;
}

export function findPlayerByName(name: string): Player | null {
  return findPlayerByNameInternal(name, false);
}

/** Era squad resolution — includes players marked unavailable elsewhere. */
export function findEraPlayerByName(name: string): Player | null {
  return findPlayerByNameInternal(name, true);
}

/** Resolve a Wikipedia squad name to a player belonging to an exact team-year. */
export function findPlayerForTeamYearSquad(
  wikiName: string,
  team: string,
  year: string | number,
  options?: {
    excludeIds?: Set<string>;
    players?: Player[];
  }
): Player | null {
  const exclude = options?.excludeIds ?? new Set<string>();
  const index =
    options?.players != null
      ? buildPlayerNameIndexFromPlayers(options.players, true)
      : getEraPlayerNameIndex();

  const candidates: Player[] = [];
  const seen = new Set<string>();

  for (const key of expandNameLookupKeys(wikiName)) {
    for (const player of index.get(key) ?? []) {
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      candidates.push(player);
    }
  }

  const eligible = candidates.filter(
    (player) =>
      !exclude.has(player.id) &&
      playerBelongsToTeamYear(player, team, year)
  );

  return pickBestCandidate(eligible);
}

function buildPlayerNameIndexFromPlayers(
  players: Player[],
  includeUnavailable: boolean
): Map<string, Player[]> {
  const index = new Map<string, Player[]>();
  for (const player of players) {
    if (!includeUnavailable && player.availableInGame === false) continue;
    for (const key of expandNameLookupKeys(player.name)) {
      const list = index.get(key) ?? [];
      list.push(player);
      index.set(key, list);
    }
  }
  return index;
}
