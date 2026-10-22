import clubCareerSpans from "../../../../data/club-career-spans.json";
import { getClubByName } from "@/lib/clubs";
import { getShowcasePlayers } from "@/lib/players";
import {
  resolveChallengeCupYears,
  resolveDreamTeamYears,
  resolveSuperLeagueChampionYears,
} from "@/lib/players/achievements";
import { getPlayerDisplayName } from "@/lib/players/display-name-resolver";
import { getCurrentSeasonYearNumber } from "@/lib/players/rating-context";
import {
  parseYearFromPlayerId,
  parseYearsActiveStart,
} from "@/lib/players/year-card";
import { normalizePlayerNameKey } from "@/lib/player-name-normalize";
import type { Player, Position } from "@/lib/types";
import {
  isEligibleMiniGamePlayer,
  isEligibleMiniGameTeam,
  normalizeMiniGameNationKey,
  resolveMiniGameClubName,
} from "../eligibility";
import type { GridPlayer } from "./types";

/**
 * Grid player pool: one entry per real-world Super League player.
 *
 * The database stores one card per club-season, so a player's career is
 * spread over many cards (often at different clubs). Cards for the same person
 * are joined when they share a normalised name or a base id
 * (`basePlayerId` / `baseId`), and every club, position, nation and honour on
 * any of those cards counts for the person.
 */

/** Extra clubs a player is known to have played for (data/club-career-spans.json). */
const EXTRA_CLUB_SPANS = clubCareerSpans as Record<string, string[]>;

function cardYear(player: Player): number | undefined {
  const year =
    player.year ?? player.cardYear ?? player.eraYear ?? player.primeYear;
  if (typeof year === "number" && Number.isFinite(year) && year >= 1895) {
    return year;
  }
  const fromId = parseYearFromPlayerId(player.id);
  if (fromId) return fromId;
  if (player.category === "current") return getCurrentSeasonYearNumber();
  return undefined;
}

function cardClubId(name: string | undefined): string | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;
  const resolved = resolveMiniGameClubName(raw) ?? raw;
  if (!isEligibleMiniGameTeam(resolved)) return null;
  return getClubByName(resolved)?.id ?? null;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(key: string): string {
    let root = key;
    let next = this.parent.get(root);
    while (next !== undefined && next !== root) {
      root = next;
      next = this.parent.get(root);
    }
    // Path compression.
    let node = key;
    while (node !== root) {
      const up = this.parent.get(node) ?? root;
      this.parent.set(node, root);
      node = up;
    }
    if (!this.parent.has(root)) this.parent.set(root, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/** Current card first, then the most recent season, then the best rating. */
function preferCard(a: Player, b: Player): Player {
  const aCurrent = a.category === "current";
  const bCurrent = b.category === "current";
  if (aCurrent !== bCurrent) return aCurrent ? a : b;
  const ay = cardYear(a) ?? 0;
  const by = cardYear(b) ?? 0;
  if (ay !== by) return ay > by ? a : b;
  if (a.peakRating !== b.peakRating) return a.peakRating > b.peakRating ? a : b;
  return a.id.localeCompare(b.id) <= 0 ? a : b;
}

export function buildGridPlayers(cards: readonly Player[]): GridPlayer[] {
  const eligible = cards.filter(
    (card) => isEligibleMiniGamePlayer(card) && getPlayerDisplayName(card).trim()
  );

  const uf = new UnionFind();
  const nameNode = (card: Player) =>
    `n:${normalizePlayerNameKey(getPlayerDisplayName(card))}`;
  for (const card of eligible) {
    const own = nameNode(card);
    uf.find(own);
    if (card.basePlayerId) uf.union(own, `b:${card.basePlayerId}`);
    if (card.baseId) uf.union(own, `b:${card.baseId}`);
  }

  const groups = new Map<string, Player[]>();
  for (const card of eligible) {
    const root = uf.find(nameNode(card));
    const list = groups.get(root);
    if (list) list.push(card);
    else groups.set(root, [card]);
  }

  const players: GridPlayer[] = [];
  const usedIds = new Set<string>();
  for (const group of groups.values()) {
    const preferred = group.reduce(preferCard);
    const displayName = getPlayerDisplayName(preferred).trim();
    let id = normalizePlayerNameKey(displayName).replace(/\s+/g, "-");
    if (usedIds.has(id)) id = `${id}-${preferred.id}`;
    usedIds.add(id);

    const clubIds = new Set<string>();
    const nationKeys = new Set<string>();
    const positions = new Set<Position>();
    let firstYear = Number.POSITIVE_INFINITY;
    let current = false;
    let superLeagueChampion = false;
    let challengeCupWinner = false;
    let dreamTeam = false;
    let fame = 0;

    for (const card of group) {
      for (const club of [card.displayClub ?? card.team ?? card.club, card.baseClub]) {
        const clubId = cardClubId(club);
        if (clubId) clubIds.add(clubId);
      }
      for (const key of [card.id, card.basePlayerId, card.baseId]) {
        if (!key) continue;
        for (const spanClub of EXTRA_CLUB_SPANS[key] ?? []) {
          const clubId = cardClubId(spanClub);
          if (clubId) clubIds.add(clubId);
        }
      }
      const nation = normalizeMiniGameNationKey(card.nationality ?? "");
      if (nation && nation !== "unknown") nationKeys.add(nation);
      positions.add(card.position);
      for (const position of card.positions ?? []) positions.add(position);

      const year = cardYear(card);
      if (year !== undefined) firstYear = Math.min(firstYear, year);
      const activeStart = parseYearsActiveStart(card.yearsActive ?? "");
      if (activeStart !== undefined && activeStart >= 1895) {
        firstYear = Math.min(firstYear, activeStart);
      }
      if (card.category === "current") current = true;
      if (resolveSuperLeagueChampionYears(card).length > 0) superLeagueChampion = true;
      if (resolveChallengeCupYears(card).length > 0) challengeCupWinner = true;
      if (resolveDreamTeamYears(card).length > 0) dreamTeam = true;
      if (Number.isFinite(card.peakRating)) fame = Math.max(fame, card.peakRating);
    }

    if (clubIds.size === 0) continue;
    players.push({
      id,
      identityId: id,
      displayName,
      clubIds: [...clubIds].sort(),
      nationKeys: [...nationKeys].sort(),
      positions: [...positions].sort(),
      firstYear: Number.isFinite(firstYear) ? firstYear : 0,
      current,
      superLeagueChampion,
      challengeCupWinner,
      dreamTeam,
      fame: Math.round(fame),
    });
  }

  return players.sort(
    (a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id)
  );
}

let gridPoolCache: GridPlayer[] | null = null;

export function getGridPlayerPool(): GridPlayer[] {
  if (!gridPoolCache) gridPoolCache = buildGridPlayers(getShowcasePlayers());
  return gridPoolCache;
}
