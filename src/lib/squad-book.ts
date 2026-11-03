"use client";

/**
 * Squad Book — every player card a coach has fielded in a finished Classic / Era / Daily /
 * Weekly season. Cards are counted by card id, so a current-season card and an era card of the
 * same player ("Kevin Sinfield (2004)") are separate entries.
 *
 * Collections (per club, per decade, totals and a few themed sets built from the honours data)
 * pay Club Funds once each, under the ledger id `squadbook:<milestoneId>`.
 *
 * Club collections (v1.66): each club's pool is every distinct player with a card at that club
 * (all of a player's year cards at the club count as one). 25 / 50 / 100% of the pool pay Club
 * Funds, and 100% grants that club's notForSale "Completist" title (lib/collection-rewards.ts).
 * These are claimed by hand on the Squad Book page (with a celebration), not paid automatically.
 * Each card also has a rarity (lib/card-rarity.ts) and the coach can pick an all-time Dream Team
 * (13 collected cards, positions 1-13).
 *
 * Storage: localStorage (STORAGE_KEYS.squadBook, cleared with the other per-account keys) plus a
 * `user_stats` row (GLOBAL / squad_book). Merges are unions — a card or a claimed milestone is
 * never dropped — and a failed cloud read never overwrites anything. The Dream Team rides the
 * same row (newest pick wins). Books saved before v1.66 have no dreamTeam field and load with an
 * empty one.
 *
 * Favourites (v1.68): card ids the coach has starred from a player profile (components/
 * PlayerProfileSections). Same newest-wins merge as the Dream Team (`favouritesAt`); older books load
 * with none.
 */

import { useEffect, useState } from "react";
import type { Player, Position, SquadSlot } from "./types";
import { getRecruitablePlayers, getPlayerById, isHiddenPlayer } from "./players";
import {
  resolveChallengeCupYears,
  resolveDreamTeamYears,
  resolveManOfSteelYears,
  resolveSuperLeagueChampionYears,
} from "./players/achievements";
import { CURRENT_SEASON_YEAR } from "./players/current-season";
import { awardClubFundsLines } from "./storage/club-funds";
import type { ClubFundsEarnedLine } from "./club-funds";
import { STORAGE_KEYS } from "./storage/keys";
import { isSupabaseConfigured, supabase } from "./supabase";
import { getAuthUserId } from "./auth-session";
import { cardRarity, type CardRarity } from "./card-rarity";
import {
  COLLECTION_MIN_POOL,
  COLLECTION_TIERS,
  collectionSlug,
  collectionTarget,
  collectionTitleFor,
} from "./collection-rewards";
import { grantCosmetic } from "./storage/cosmetics-store";

export const SQUAD_BOOK_CHANGED_EVENT = "27-0-squad-book-changed";
export const SQUAD_BOOK_FUNDS_PREFIX = "squadbook:";

export type SquadBookSource = "classic" | "era" | "daily" | "weekly";

/** One collected card. Name / club / year are a snapshot so the entry shows even if the card is retired. */
export interface SquadBookEntry {
  name: string;
  club: string;
  year: number | null;
  /** First fielded (epoch ms). */
  firstAt: number;
  /** Mode it was first fielded in. */
  source: SquadBookSource;
  /** Finished seasons it has been fielded in. */
  times: number;
}

export interface SquadBookState {
  v: 1;
  cards: Record<string, SquadBookEntry>;
  /** Milestone ids already paid (mirrors the Club Funds ledger `squadbook:<id>`). */
  claimed: string[];
  /** Run ids already recorded, so a re-render can't count a season twice. Newest last, capped. */
  runs: string[];
  /** All-time Dream Team: 13 card ids (index 0 = No. 1 Fullback ... 12 = No. 13 Loose Forward), null = empty. */
  dreamTeam: (string | null)[];
  /** When the Dream Team was last changed (epoch ms); the newer pick wins a merge. 0 = never. */
  dreamTeamAt: number;
  /** Starred card ids (favourite players). */
  favourites: string[];
  /** When the favourites last changed (epoch ms); the newer list wins a merge. 0 = never. */
  favouritesAt: number;
}

export const MAX_FAVOURITES = 200;

const MAX_RUN_IDS = 100;

/** Dream Team shirt numbers 1-13 → position. */
export const DREAM_TEAM_SLOTS: readonly { number: number; position: Position; label: string }[] = [
  { number: 1, position: "FULLBACK", label: "Fullback" },
  { number: 2, position: "WING", label: "Wing" },
  { number: 3, position: "CENTRE", label: "Centre" },
  { number: 4, position: "CENTRE", label: "Centre" },
  { number: 5, position: "WING", label: "Wing" },
  { number: 6, position: "STAND_OFF", label: "Stand-off" },
  { number: 7, position: "SCRUM_HALF", label: "Scrum-half" },
  { number: 8, position: "PROP", label: "Prop" },
  { number: 9, position: "HOOKER", label: "Hooker" },
  { number: 10, position: "PROP", label: "Prop" },
  { number: 11, position: "SECOND_ROW", label: "Second row" },
  { number: 12, position: "SECOND_ROW", label: "Second row" },
  { number: 13, position: "LOOSE_FORWARD", label: "Loose forward" },
];
export const DREAM_TEAM_SIZE = DREAM_TEAM_SLOTS.length;

const emptyDreamTeam = (): (string | null)[] => Array.from({ length: DREAM_TEAM_SIZE }, () => null);

function normalizeDreamTeam(raw: unknown): (string | null)[] {
  const out = emptyDreamTeam();
  if (!Array.isArray(raw)) return out;
  const seen = new Set<string>();
  for (let i = 0; i < DREAM_TEAM_SIZE; i += 1) {
    const id = raw[i];
    if (typeof id === "string" && id && !seen.has(id)) {
      out[i] = id;
      seen.add(id);
    }
  }
  return out;
}
const SOURCES: SquadBookSource[] = ["classic", "era", "daily", "weekly"];

export function emptySquadBook(): SquadBookState {
  return { v: 1, cards: {}, claimed: [], runs: [], dreamTeam: emptyDreamTeam(), dreamTeamAt: 0, favourites: [], favouritesAt: 0 };
}

function normalizeEntry(raw: unknown): SquadBookEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SquadBookEntry>;
  if (typeof r.name !== "string" || !r.name) return null;
  return {
    name: r.name,
    club: typeof r.club === "string" ? r.club : "",
    year: typeof r.year === "number" && Number.isFinite(r.year) ? r.year : null,
    firstAt: typeof r.firstAt === "number" && Number.isFinite(r.firstAt) ? r.firstAt : 0,
    source: SOURCES.includes(r.source as SquadBookSource) ? (r.source as SquadBookSource) : "classic",
    times: typeof r.times === "number" && r.times > 0 ? Math.floor(r.times) : 1,
  };
}

export function normalizeSquadBook(raw: unknown): SquadBookState {
  const base = emptySquadBook();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SquadBookState>;
  if (r.cards && typeof r.cards === "object") {
    for (const [id, value] of Object.entries(r.cards)) {
      const entry = normalizeEntry(value);
      if (id && entry) base.cards[id] = entry;
    }
  }
  if (Array.isArray(r.claimed)) base.claimed = [...new Set(r.claimed.filter((id): id is string => typeof id === "string"))];
  if (Array.isArray(r.runs)) base.runs = [...new Set(r.runs.filter((id): id is string => typeof id === "string"))].slice(-MAX_RUN_IDS);
  // Pre-v1.66 books have no Dream Team: they load with an empty one.
  base.dreamTeam = normalizeDreamTeam(r.dreamTeam);
  base.dreamTeamAt = typeof r.dreamTeamAt === "number" && Number.isFinite(r.dreamTeamAt) && r.dreamTeamAt > 0 ? r.dreamTeamAt : 0;
  // Pre-v1.68 books have no favourites.
  if (Array.isArray(r.favourites)) {
    base.favourites = [...new Set(r.favourites.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, MAX_FAVOURITES);
  }
  base.favouritesAt = typeof r.favouritesAt === "number" && Number.isFinite(r.favouritesAt) && r.favouritesAt > 0 ? r.favouritesAt : 0;
  return base;
}

/** Union of two books: every card from either side (earliest first-fielded, most appearances), every claim. Pure. */
export function mergeSquadBookStates(aRaw: unknown, bRaw: unknown): SquadBookState {
  const a = normalizeSquadBook(aRaw);
  const b = normalizeSquadBook(bRaw);
  const cards: Record<string, SquadBookEntry> = { ...a.cards };
  for (const [id, entry] of Object.entries(b.cards)) {
    const mine = cards[id];
    if (!mine) {
      cards[id] = entry;
      continue;
    }
    const earliest = mine.firstAt && (!entry.firstAt || mine.firstAt <= entry.firstAt) ? mine : entry;
    cards[id] = { ...earliest, times: Math.max(mine.times, entry.times) };
  }
  // Dream Team: the newer pick wins (a tie keeps the first argument, i.e. local).
  const team = b.dreamTeamAt > a.dreamTeamAt ? b : a;
  const favs = b.favouritesAt > a.favouritesAt ? b : a;
  return {
    v: 1,
    cards,
    claimed: [...new Set([...a.claimed, ...b.claimed])],
    runs: [...new Set([...a.runs, ...b.runs])].slice(-MAX_RUN_IDS),
    dreamTeam: [...team.dreamTeam],
    dreamTeamAt: team.dreamTeamAt,
    favourites: [...favs.favourites],
    favouritesAt: favs.favouritesAt,
  };
}

export interface SquadBookCardInput {
  id: string;
  name: string;
  club: string;
  year?: number | null;
}

/**
 * Add one finished season's cards. Pure. A run id already recorded changes nothing; a card already
 * in the book only bumps its appearance count. Returns the ids that are new to the book.
 */
export function addRunToSquadBook(
  state: SquadBookState,
  runId: string,
  cards: readonly SquadBookCardInput[],
  source: SquadBookSource,
  now: number = Date.now()
): { state: SquadBookState; newIds: string[] } {
  if (!runId || state.runs.includes(runId)) return { state, newIds: [] };
  const next: SquadBookState = { ...state, cards: { ...state.cards }, runs: [...state.runs, runId].slice(-MAX_RUN_IDS) };
  const newIds: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);
    const existing = next.cards[card.id];
    if (existing) {
      next.cards[card.id] = { ...existing, times: existing.times + 1 };
    } else {
      next.cards[card.id] = { name: card.name, club: card.club, year: card.year ?? null, firstAt: now, source, times: 1 };
      newIds.push(card.id);
    }
  }
  return { state: next, newIds };
}

/* ------------------------------------------------------------------ catalogue */

export interface SquadBookCatalogCard {
  id: string;
  name: string;
  club: string;
  year: number | null;
  decade: number | null;
  category: Player["category"];
  rating: number;
  rarity: CardRarity;
  position: Position;
  positions: Position[];
  /** Same real player at the same club (all their year cards there): `club|name`. */
  playerKey: string;
}

/** "club" / "decade" / "total" / "set" pay automatically; "collection" (club %) is claimed by hand. */
export type SquadBookGroupKind = "club" | "decade" | "total" | "set" | "collection";

export interface SquadBookMilestone {
  id: string;
  kind: SquadBookGroupKind;
  /** Club name / decade label / set name. */
  group: string;
  label: string;
  target: number;
  reward: number;
  /** Club collection tiers only: the percent of the pool. */
  percent?: number;
  /** Club collection tiers only: cosmetic granted on claim (the club's Completist title at 100%). */
  cosmeticId?: string;
}

export interface SquadBookSet {
  id: string;
  name: string;
  blurb: string;
  ids: Set<string>;
  /** Cards needed (≤ ids.size). */
  target: number;
  reward: number;
}

export interface SquadBookCatalog {
  cards: SquadBookCatalogCard[];
  byId: Map<string, SquadBookCatalogCard>;
  clubs: string[];
  clubCards: Map<string, string[]>;
  clubCurrent: Map<string, string[]>;
  /** Club collection pool: playerKey → that player's card ids at the club. */
  clubPlayers: Map<string, Map<string, string[]>>;
  decades: number[];
  sets: SquadBookSet[];
  milestones: SquadBookMilestone[];
}

export const CLUB_TIERS: readonly { target: number; reward: number }[] = [
  { target: 10, reward: 10_000 },
  { target: 25, reward: 25_000 },
  { target: 50, reward: 50_000 },
];
export const CLUB_CURRENT_SQUAD_REWARD = 100_000;
export const DECADE_TIERS: readonly { target: number; reward: number }[] = [
  { target: 25, reward: 15_000 },
  { target: 100, reward: 50_000 },
  { target: 250, reward: 100_000 },
];
export const TOTAL_TIERS: readonly { target: number; reward: number }[] = [
  { target: 50, reward: 25_000 },
  { target: 100, reward: 50_000 },
  { target: 250, reward: 100_000 },
  { target: 500, reward: 250_000 },
];

export const decadeOf = (year: number | null | undefined): number | null =>
  typeof year === "number" && Number.isFinite(year) ? Math.floor(year / 10) * 10 : null;
export const decadeLabel = (decade: number) => `${decade}s`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Collection identity of a player at a club: club + folded name (year cards of one player share it). */
export const collectionPlayerKey = (club: string, name: string) =>
  `${club}|${name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;

/** Honour won in the card's own season (the data's honour maps, filtered to that year). */
function wonInCardYear(p: Player, resolve: (p: Player) => number[]): boolean {
  return typeof p.year === "number" && resolve(p).includes(p.year);
}

/** Build the collectable universe + milestones from a player list. Pure (given the honours data). */
export function buildSquadBookCatalog(players: readonly Player[]): SquadBookCatalog {
  const cards: SquadBookCatalogCard[] = [];
  const byId = new Map<string, SquadBookCatalogCard>();
  const clubCards = new Map<string, string[]>();
  const clubCurrent = new Map<string, string[]>();
  const clubPlayers = new Map<string, Map<string, string[]>>();
  const decadeSet = new Set<number>();
  const mos = new Set<string>();
  const legends = new Set<string>();
  const champions = new Set<string>();
  const cups = new Set<string>();
  const dreamTeam = new Set<string>();

  for (const p of players) {
    if (byId.has(p.id) || isHiddenPlayer(p)) continue;
    const year = typeof p.year === "number" ? p.year : null;
    const rating = typeof p.peakRating === "number" && Number.isFinite(p.peakRating) ? p.peakRating : 0;
    const positions = [...new Set([p.position, ...(Array.isArray(p.positions) ? p.positions : [])])].filter(Boolean) as Position[];
    const playerKey = collectionPlayerKey(p.club, p.name);
    const card: SquadBookCatalogCard = {
      id: p.id,
      name: p.name,
      club: p.club,
      year,
      decade: decadeOf(year),
      category: p.category,
      rating,
      rarity: cardRarity(p),
      position: p.position,
      positions,
      playerKey,
    };
    cards.push(card);
    byId.set(p.id, card);
    if (!clubCards.has(p.club)) clubCards.set(p.club, []);
    clubCards.get(p.club)!.push(p.id);
    if (!clubPlayers.has(p.club)) clubPlayers.set(p.club, new Map());
    const pool = clubPlayers.get(p.club)!;
    if (!pool.has(playerKey)) pool.set(playerKey, []);
    pool.get(playerKey)!.push(p.id);
    if (p.category === "current" && year === CURRENT_SEASON_YEAR) {
      if (!clubCurrent.has(p.club)) clubCurrent.set(p.club, []);
      clubCurrent.get(p.club)!.push(p.id);
    }
    if (card.decade !== null) decadeSet.add(card.decade);
    if (p.category === "legend") legends.add(p.id);
    if (wonInCardYear(p, resolveManOfSteelYears)) mos.add(p.id);
    if (wonInCardYear(p, resolveSuperLeagueChampionYears)) champions.add(p.id);
    if (wonInCardYear(p, resolveChallengeCupYears)) cups.add(p.id);
    if (wonInCardYear(p, resolveDreamTeamYears)) dreamTeam.add(p.id);
  }

  const clubs = [...clubCards.keys()].sort((a, b) => a.localeCompare(b));
  const decades = [...decadeSet].sort((a, b) => a - b);

  const sets: SquadBookSet[] = [
    { id: "men-of-steel", name: "Men of Steel", blurb: "Every card from a player's Man of Steel season.", ids: mos, target: mos.size, reward: 250_000 },
    { id: "legends", name: "Legends", blurb: "Every Legend card.", ids: legends, target: legends.size, reward: 250_000 },
    { id: "champions", name: "Champions", blurb: "25 cards from Super League title-winning seasons.", ids: champions, target: Math.min(25, champions.size), reward: 50_000 },
    { id: "cup-winners", name: "Cup Winners", blurb: "25 cards from Challenge Cup-winning seasons.", ids: cups, target: Math.min(25, cups.size), reward: 50_000 },
    { id: "dream-team", name: "Dream Team", blurb: "17 cards from a player's Dream Team season.", ids: dreamTeam, target: Math.min(17, dreamTeam.size), reward: 50_000 },
  ].filter((s) => s.target > 0);

  const milestones: SquadBookMilestone[] = [];
  for (const club of clubs) {
    const size = clubCards.get(club)!.length;
    for (const tier of CLUB_TIERS) {
      if (size < tier.target) continue;
      milestones.push({ id: `club-${slug(club)}-${tier.target}`, kind: "club", group: club, label: `${club}: ${tier.target} cards`, target: tier.target, reward: tier.reward });
    }
    const current = clubCurrent.get(club)?.length ?? 0;
    if (current > 0) {
      milestones.push({ id: `club-${slug(club)}-squad-${CURRENT_SEASON_YEAR}`, kind: "club", group: club, label: `${club}: full ${CURRENT_SEASON_YEAR} squad`, target: current, reward: CLUB_CURRENT_SQUAD_REWARD });
    }
  }
  for (const club of clubs) {
    const pool = clubPlayers.get(club)?.size ?? 0;
    if (pool < COLLECTION_MIN_POOL) continue;
    const titleId = collectionTitleFor(club);
    for (const tier of COLLECTION_TIERS) {
      milestones.push({
        id: `collection-${collectionSlug(club)}-${tier.percent}`,
        kind: "collection",
        group: club,
        label: `${club}: ${tier.percent}% collected`,
        target: collectionTarget(pool, tier.percent),
        reward: tier.reward,
        percent: tier.percent,
        ...(tier.title && titleId ? { cosmeticId: titleId } : {}),
      });
    }
  }
  for (const decade of decades) {
    const size = cards.filter((c) => c.decade === decade).length;
    for (const tier of DECADE_TIERS) {
      if (size < tier.target) continue;
      milestones.push({ id: `decade-${decade}-${tier.target}`, kind: "decade", group: decadeLabel(decade), label: `${decadeLabel(decade)}: ${tier.target} cards`, target: tier.target, reward: tier.reward });
    }
  }
  for (const tier of TOTAL_TIERS) {
    milestones.push({ id: `total-${tier.target}`, kind: "total", group: "Total", label: `${tier.target} cards collected`, target: tier.target, reward: tier.reward });
  }
  for (const set of sets) {
    milestones.push({ id: `set-${set.id}`, kind: "set", group: set.name, label: `${set.name} set`, target: set.target, reward: set.reward });
  }

  return { cards, byId, clubs, clubCards, clubCurrent, clubPlayers, decades, sets, milestones };
}

let catalogCache: { size: number; catalog: SquadBookCatalog } | null = null;

/** The live catalogue (recruitable, year-pinned gameplay cards). Rebuilt if the registry grows. */
export function getSquadBookCatalog(): SquadBookCatalog {
  const players = getRecruitablePlayers();
  if (!catalogCache || catalogCache.size !== players.length) {
    catalogCache = { size: players.length, catalog: buildSquadBookCatalog(players) };
  }
  return catalogCache.catalog;
}

/* ------------------------------------------------------------------ progress */

export interface SquadBookProgress {
  total: number;
  /** Collected cards that are in the catalogue. */
  collectedInCatalog: number;
  byClub: Map<string, { have: number; of: number; currentHave: number; currentOf: number }>;
  byDecade: Map<number, { have: number; of: number }>;
  bySet: Map<string, { have: number; of: number; target: number }>;
  /** Club collection: distinct players collected / in the pool. */
  byClubPlayers: Map<string, { have: number; of: number }>;
  /** Collected cards per rarity (catalogue cards only). */
  byRarity: Record<CardRarity, number>;
  /** Progress value per milestone id. */
  milestoneValue: Map<string, number>;
}

/** Club / decade of a collected card: the catalogue's when it knows the card, else the snapshot. */
function cardMeta(id: string, entry: SquadBookEntry, catalog: SquadBookCatalog) {
  const known = catalog.byId.get(id);
  return { club: known?.club ?? entry.club, decade: known?.decade ?? decadeOf(entry.year) };
}

export function computeSquadBookProgress(state: SquadBookState, catalog: SquadBookCatalog): SquadBookProgress {
  const ids = Object.keys(state.cards);
  const byClub = new Map<string, { have: number; of: number; currentHave: number; currentOf: number }>();
  for (const club of catalog.clubs) {
    byClub.set(club, { have: 0, of: catalog.clubCards.get(club)!.length, currentHave: 0, currentOf: catalog.clubCurrent.get(club)?.length ?? 0 });
  }
  const byDecade = new Map<number, { have: number; of: number }>();
  for (const d of catalog.decades) byDecade.set(d, { have: 0, of: catalog.cards.filter((c) => c.decade === d).length });
  const currentIds = new Set([...catalog.clubCurrent.values()].flat());

  let collectedInCatalog = 0;
  for (const id of ids) {
    const meta = cardMeta(id, state.cards[id], catalog);
    if (catalog.byId.has(id)) collectedInCatalog += 1;
    const club = byClub.get(meta.club);
    if (club) {
      club.have += 1;
      if (currentIds.has(id)) club.currentHave += 1;
    }
    if (meta.decade !== null) {
      const dec = byDecade.get(meta.decade);
      if (dec) dec.have += 1;
    }
  }

  const bySet = new Map<string, { have: number; of: number; target: number }>();
  for (const set of catalog.sets) {
    let have = 0;
    for (const id of set.ids) if (state.cards[id]) have += 1;
    bySet.set(set.id, { have, of: set.ids.size, target: set.target });
  }

  const collectedKeys = new Set<string>();
  const byRarity: Record<CardRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const id of ids) {
    const known = catalog.byId.get(id);
    if (known) {
      collectedKeys.add(known.playerKey);
      byRarity[known.rarity] += 1;
    } else {
      // Retired card: its snapshot can still match the player's other cards at the club.
      const entry = state.cards[id];
      collectedKeys.add(collectionPlayerKey(entry.club, entry.name));
    }
  }
  const byClubPlayers = new Map<string, { have: number; of: number }>();
  for (const club of catalog.clubs) {
    const pool = catalog.clubPlayers.get(club) ?? new Map<string, string[]>();
    let have = 0;
    for (const key of pool.keys()) if (collectedKeys.has(key)) have += 1;
    byClubPlayers.set(club, { have, of: pool.size });
  }

  const milestoneValue = new Map<string, number>();
  for (const m of catalog.milestones) {
    let value = 0;
    if (m.kind === "total") value = ids.length;
    else if (m.kind === "collection") value = byClubPlayers.get(m.group)?.have ?? 0;
    else if (m.kind === "club") {
      const c = byClub.get(m.group);
      value = m.id.includes("-squad-") ? (c?.currentHave ?? 0) : (c?.have ?? 0);
    } else if (m.kind === "decade") value = byDecade.get(Number.parseInt(m.group, 10))?.have ?? 0;
    else value = bySet.get(m.id.replace(/^set-/, ""))?.have ?? 0;
    milestoneValue.set(m.id, value);
  }

  return { total: ids.length, collectedInCatalog, byClub, byDecade, bySet, byClubPlayers, byRarity, milestoneValue };
}

/** Auto-paid milestones reached but not yet in `state.claimed` (club collections excluded). Pure. */
export function pendingSquadBookMilestones(state: SquadBookState, catalog: SquadBookCatalog): SquadBookMilestone[] {
  const progress = computeSquadBookProgress(state, catalog);
  return catalog.milestones.filter(
    (m) => m.kind !== "collection" && !state.claimed.includes(m.id) && (progress.milestoneValue.get(m.id) ?? 0) >= m.target
  );
}

/** Club collection tiers reached and waiting for the coach to claim them. Pure. */
export function claimableCollectionRewards(state: SquadBookState, catalog: SquadBookCatalog, club?: string): SquadBookMilestone[] {
  const progress = computeSquadBookProgress(state, catalog);
  return catalog.milestones.filter(
    (m) =>
      m.kind === "collection" &&
      (club === undefined || m.group === club) &&
      !state.claimed.includes(m.id) &&
      (progress.milestoneValue.get(m.id) ?? 0) >= m.target
  );
}

/* ------------------------------------------------------------------ storage */

export function getSquadBook(): SquadBookState {
  if (typeof window === "undefined") return emptySquadBook();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.squadBook);
    return raw ? normalizeSquadBook(JSON.parse(raw)) : emptySquadBook();
  } catch {
    return emptySquadBook();
  }
}

function saveLocal(state: SquadBookState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.squadBook, JSON.stringify(state));
  } catch {
    /* storage full / blocked */
  }
  window.dispatchEvent(new CustomEvent(SQUAD_BOOK_CHANGED_EVENT));
}

/**
 * Pay every reached, unpaid milestone once (Club Funds id `squadbook:<id>`; the ledger refuses a
 * repeat even if the local claim list was lost). Returns the lines paid this call.
 */
export function claimSquadBookMilestones(): ClubFundsEarnedLine[] {
  const state = getSquadBook();
  const pending = pendingSquadBookMilestones(state, getSquadBookCatalog());
  if (pending.length === 0) return [];
  const paid: ClubFundsEarnedLine[] = [];
  for (const m of pending) {
    const line: ClubFundsEarnedLine = { id: `squadbook-${m.id}`, label: `Squad Book: ${m.label}`, amount: m.reward };
    const result = awardClubFundsLines(`${SQUAD_BOOK_FUNDS_PREFIX}${m.id}`, [line]);
    if (result.awarded) paid.push(line);
    state.claimed.push(m.id);
  }
  saveLocal(state);
  void saveCloud();
  return paid;
}

export interface CollectionClaimResult {
  /** Club Funds paid this call (a tier already in the ledger pays nothing). */
  paid: ClubFundsEarnedLine[];
  /** Cosmetic ids newly granted (the club's Completist title). */
  cosmetics: string[];
  /** Milestones marked claimed this call. */
  claimed: SquadBookMilestone[];
}

/**
 * Claim reached club collection tiers (all of them, or one club's). Funds go through the ledger
 * under `squadbook:<milestoneId>` (paid once ever); the 100% tier also grants the club title via
 * grantCosmetic (owned once ever). Never throws.
 */
export function claimCollectionRewards(club?: string): CollectionClaimResult {
  const out: CollectionClaimResult = { paid: [], cosmetics: [], claimed: [] };
  try {
    const state = getSquadBook();
    const ready = claimableCollectionRewards(state, getSquadBookCatalog(), club);
    if (ready.length === 0) return out;
    for (const m of ready) {
      const line: ClubFundsEarnedLine = { id: `squadbook-${m.id}`, label: `Squad Book: ${m.label}`, amount: m.reward };
      const result = awardClubFundsLines(`${SQUAD_BOOK_FUNDS_PREFIX}${m.id}`, [line]);
      if (result.awarded) out.paid.push(line);
      if (m.cosmeticId) {
        try {
          if (grantCosmetic(m.cosmeticId)) out.cosmetics.push(m.cosmeticId);
        } catch {
          /* storage blocked: the claim is kept, the title can be re-granted by the backfill below */
        }
      }
      state.claimed.push(m.id);
      out.claimed.push(m);
    }
    saveLocal(state);
    void saveCloud();
  } catch (err) {
    console.error("[squad-book] collection claim failed:", err);
  }
  return out;
}

/**
 * A 100% tier claimed on another device (or before a storage reset) still owns its title: grant
 * any claimed tier's cosmetic that isn't owned. Returns the ids granted. Never throws.
 */
export function syncCollectionCosmetics(): string[] {
  const out: string[] = [];
  try {
    const state = getSquadBook();
    for (const m of getSquadBookCatalog().milestones) {
      if (m.kind !== "collection" || !m.cosmeticId || !state.claimed.includes(m.id)) continue;
      if (grantCosmetic(m.cosmeticId)) out.push(m.cosmeticId);
    }
  } catch {
    /* storage blocked */
  }
  return out;
}

/** Collected cards that can play a Dream Team slot (index 0-12). Pure. */
export function dreamTeamCandidates(state: SquadBookState, catalog: SquadBookCatalog, slotIndex: number): SquadBookCatalogCard[] {
  const slot = DREAM_TEAM_SLOTS[slotIndex];
  if (!slot) return [];
  const out: SquadBookCatalogCard[] = [];
  for (const id of Object.keys(state.cards)) {
    const card = catalog.byId.get(id);
    if (card && card.positions.includes(slot.position)) out.push(card);
  }
  return out.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

/**
 * Put a collected card in a Dream Team slot (null clears it). The same card can't be in two
 * slots (it moves). Pure; returns the unchanged state when the card isn't collected.
 */
export function setDreamTeamSlotPure(state: SquadBookState, slotIndex: number, cardId: string | null, now: number = Date.now()): SquadBookState {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= DREAM_TEAM_SIZE) return state;
  if (cardId !== null && !state.cards[cardId]) return state;
  const team = state.dreamTeam.map((id) => (cardId !== null && id === cardId ? null : id));
  team[slotIndex] = cardId;
  // Always newer than the last pick, so a device clock behind the cloud's can't lose an edit.
  return { ...state, dreamTeam: team, dreamTeamAt: Math.max(now, state.dreamTeamAt + 1) };
}

/** Save a Dream Team pick (local + cloud). */
export function setDreamTeamSlot(slotIndex: number, cardId: string | null): void {
  const before = getSquadBook();
  const next = setDreamTeamSlotPure(before, slotIndex, cardId);
  if (next === before) return;
  saveLocal(next);
  void saveCloud();
}

/**
 * Star / unstar cards (a player profile passes all of that player's card ids, so unstarring clears
 * every one of them). Pure; returns the unchanged state when nothing changes.
 */
export function setFavouritePure(state: SquadBookState, cardIds: readonly string[], on: boolean, now: number = Date.now()): SquadBookState {
  const ids = cardIds.filter((id) => typeof id === "string" && id);
  if (ids.length === 0) return state;
  const current = new Set(state.favourites);
  if (on) {
    // One id is enough to mark the player: keep the card the coach starred from.
    if (ids.some((id) => current.has(id))) return state;
    if (current.size >= MAX_FAVOURITES) return state;
    current.add(ids[0]);
  } else {
    if (!ids.some((id) => current.has(id))) return state;
    for (const id of ids) current.delete(id);
  }
  return { ...state, favourites: [...current], favouritesAt: Math.max(now, state.favouritesAt + 1) };
}

/** Save a favourite star (local + cloud). */
export function setFavourite(cardIds: readonly string[], on: boolean): void {
  const before = getSquadBook();
  const next = setFavouritePure(before, cardIds, on);
  if (next === before) return;
  saveLocal(next);
  void saveCloud();
}

export function clearDreamTeam(): void {
  const state = getSquadBook();
  saveLocal({ ...state, dreamTeam: emptyDreamTeam(), dreamTeamAt: Math.max(Date.now(), state.dreamTeamAt + 1) });
  void saveCloud();
}

export interface RecordSquadBookRunInput {
  runId: string;
  mode: string;
  squad: readonly SquadSlot[];
  /** Joe Mellor / Super Sam Hallas easter-egg runs don't count. */
  hidden?: boolean;
  era?: boolean;
  daily?: boolean;
  weekly?: boolean;
}

export interface RecordSquadBookRunResult {
  newIds: string[];
  paid: ClubFundsEarnedLine[];
}

/** Called once when a Classic / Era / Daily / Weekly season is finished. Never throws. */
export function recordSquadBookRun(input: RecordSquadBookRunInput): RecordSquadBookRunResult {
  const none: RecordSquadBookRunResult = { newIds: [], paid: [] };
  try {
    if (typeof window === "undefined" || input.hidden || input.mode !== "CLASSIC") return none;
    const source: SquadBookSource = input.weekly ? "weekly" : input.daily ? "daily" : input.era ? "era" : "classic";
    const cards: SquadBookCardInput[] = [];
    for (const slot of input.squad) {
      const p = slot.player;
      if (!p || isHiddenPlayer(p)) continue;
      // Prefer the registry's card (canonical club; era runs relabel the club for display).
      const known = getPlayerById(p.id);
      cards.push({ id: p.id, name: known?.name ?? p.name, club: known?.club ?? p.baseClub ?? p.club, year: known?.year ?? p.year ?? null });
    }
    const before = getSquadBook();
    if (!input.runId || before.runs.includes(input.runId)) return none;
    const { state, newIds } = addRunToSquadBook(before, input.runId, cards, source);
    saveLocal(state);
    const paid = claimSquadBookMilestones();
    if (paid.length === 0) void saveCloud();
    return { newIds, paid };
  } catch (err) {
    console.error("[squad-book] record failed:", err);
    return none;
  }
}

/** React hook: the book, re-rendering on change. */
export function useSquadBook(): SquadBookState {
  const [state, setState] = useState<SquadBookState>(emptySquadBook);
  useEffect(() => {
    const read = () => setState(getSquadBook());
    read();
    window.addEventListener(SQUAD_BOOK_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SQUAD_BOOK_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}

/* ------------------------------------------------------------------ cloud */

const STAT_MODE = "GLOBAL";
const STAT_KEY = "squad_book";

async function readCloud(userId: string): Promise<SquadBookState> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("stat_json")
    .eq("user_id", userId)
    .eq("mode", STAT_MODE)
    .eq("stat_key", STAT_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeSquadBook(data?.stat_json ?? null);
}

/**
 * Upload as read → union → write, so a device that hasn't merged yet can't replace the account's
 * cloud book with its smaller local copy. If the read fails nothing is written.
 */
async function saveCloud(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    const cloud = await readCloud(userId);
    const merged = mergeSquadBookStates(getSquadBook(), cloud);
    await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: Object.keys(merged.cards).length,
        stat_json: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
  } catch {
    /* offline / read failed: the next change retries */
  }
}

/**
 * On login: union local + cloud, save locally and upload the union. Rejects (and leaves both
 * copies alone) when the cloud read fails.
 */
export async function mergeSquadBookFromCloud(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  const cloud = await readCloud(userId);
  const local = getSquadBook();
  const merged = mergeSquadBookStates(local, cloud);
  saveLocal(merged);
  const cloudCount = Object.keys(cloud.cards).length;
  if (
    Object.keys(merged.cards).length !== cloudCount ||
    merged.claimed.length !== cloud.claimed.length ||
    merged.dreamTeamAt !== cloud.dreamTeamAt ||
    merged.favouritesAt !== cloud.favouritesAt
  ) {
    await saveCloud();
  }
}
