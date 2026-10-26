"use client";

/**
 * Squad Book — every player card a coach has fielded in a finished Classic / Era / Daily /
 * Weekly season. Cards are counted by card id, so a current-season card and an era card of the
 * same player ("Kevin Sinfield (2004)") are separate entries.
 *
 * Collections (per club, per decade, totals and a few themed sets built from the honours data)
 * pay Club Funds once each, under the ledger id `squadbook:<milestoneId>`.
 *
 * Storage: localStorage (STORAGE_KEYS.squadBook, cleared with the other per-account keys) plus a
 * `user_stats` row (GLOBAL / squad_book). Merges are unions — a card or a claimed milestone is
 * never dropped — and a failed cloud read never overwrites anything.
 */

import { useEffect, useState } from "react";
import type { Player, SquadSlot } from "./types";
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
}

const MAX_RUN_IDS = 100;
const SOURCES: SquadBookSource[] = ["classic", "era", "daily", "weekly"];

export function emptySquadBook(): SquadBookState {
  return { v: 1, cards: {}, claimed: [], runs: [] };
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
  return {
    v: 1,
    cards,
    claimed: [...new Set([...a.claimed, ...b.claimed])],
    runs: [...new Set([...a.runs, ...b.runs])].slice(-MAX_RUN_IDS),
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
}

export type SquadBookGroupKind = "club" | "decade" | "total" | "set";

export interface SquadBookMilestone {
  id: string;
  kind: SquadBookGroupKind;
  /** Club name / decade label / set name. */
  group: string;
  label: string;
  target: number;
  reward: number;
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
  const decadeSet = new Set<number>();
  const mos = new Set<string>();
  const legends = new Set<string>();
  const champions = new Set<string>();
  const cups = new Set<string>();
  const dreamTeam = new Set<string>();

  for (const p of players) {
    if (byId.has(p.id) || isHiddenPlayer(p)) continue;
    const year = typeof p.year === "number" ? p.year : null;
    const card: SquadBookCatalogCard = { id: p.id, name: p.name, club: p.club, year, decade: decadeOf(year), category: p.category };
    cards.push(card);
    byId.set(p.id, card);
    if (!clubCards.has(p.club)) clubCards.set(p.club, []);
    clubCards.get(p.club)!.push(p.id);
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

  return { cards, byId, clubs, clubCards, clubCurrent, decades, sets, milestones };
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

  const milestoneValue = new Map<string, number>();
  for (const m of catalog.milestones) {
    let value = 0;
    if (m.kind === "total") value = ids.length;
    else if (m.kind === "club") {
      const c = byClub.get(m.group);
      value = m.id.includes("-squad-") ? (c?.currentHave ?? 0) : (c?.have ?? 0);
    } else if (m.kind === "decade") value = byDecade.get(Number.parseInt(m.group, 10))?.have ?? 0;
    else value = bySet.get(m.id.replace(/^set-/, ""))?.have ?? 0;
    milestoneValue.set(m.id, value);
  }

  return { total: ids.length, collectedInCatalog, byClub, byDecade, bySet, milestoneValue };
}

/** Milestones reached but not yet in `state.claimed`. Pure. */
export function pendingSquadBookMilestones(state: SquadBookState, catalog: SquadBookCatalog): SquadBookMilestone[] {
  const progress = computeSquadBookProgress(state, catalog);
  return catalog.milestones.filter((m) => !state.claimed.includes(m.id) && (progress.milestoneValue.get(m.id) ?? 0) >= m.target);
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
  if (Object.keys(merged.cards).length !== cloudCount || merged.claimed.length !== cloud.claimed.length) {
    await saveCloud();
  }
}
