/**
 * Player profile (v1.68): everything the expanded player card shows, assembled from data the game
 * already has. Nothing here is written by hand per player — every line comes from the player
 * database, the honours data (data/*-years.json, man-of-steel-winners.json, lance-todd-winners.json,
 * hall-of-fame.json via Player.hallOfFame) or the coach's own saves (Squad Book + lifetime stats).
 *
 *  - Identity: one real player = folded name + birth year (year cards at different clubs have
 *    different basePlayerIds, so that can't group them). A card with no birth year joins its
 *    namesakes only when they all share one birth year.
 *  - Your history: lifetime stats maps keyed by card id (draftCounts = finished seasons he was in
 *    your squad, playerSeasonWins / Losses, and from v1.68 playerPerfectSeasons / playerTries),
 *    summed over all his cards and the Classic / Era / Ball Knower / Draft buckets.
 *  - Personality: a flavour line and trait chips built only from those facts.
 *
 * Pure (given the honours JSON). Tests: scripts/test-player-profile.ts.
 */

import type { Player, Position, UserStatsData } from "./types";
import type { SquadBookSource, SquadBookState } from "./squad-book";
import { cardRarity, rarityRank, type CardRarity } from "./card-rarity";
import {
  resolveChallengeCupYears,
  resolveDreamTeamYears,
  resolveGoldenBootYears,
  resolveHasLanceToddTrophy,
  resolveLeagueLeadersYears,
  resolveManOfSteelYears,
  resolveSuperLeagueChampionYears,
} from "./players/achievements";
import { POSITION_LABELS } from "./positions";

/* ------------------------------------------------------------------ identity */

export const foldPlayerName = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function cardBirthYear(p: Player): number | null {
  if (typeof p.birthYear === "number" && Number.isFinite(p.birthYear)) return p.birthYear;
  const m = typeof p.dateOfBirth === "string" ? p.dateOfBirth.match(/(\d{4})/) : null;
  return m ? Number(m[1]) : null;
}

const cardYearOf = (p: Player): number | null => {
  const y = p.year ?? p.cardYear;
  return typeof y === "number" && Number.isFinite(y) ? y : null;
};

/** Index of a pool by folded name (build once per pool). */
export type ProfilePoolIndex = Map<string, Player[]>;

export function indexProfilePool(pool: readonly Player[]): ProfilePoolIndex {
  const index: ProfilePoolIndex = new Map();
  for (const p of pool) {
    if (!p?.id || !p.name) continue;
    const key = foldPlayerName(p.name);
    const list = index.get(key);
    if (list) list.push(p);
    else index.set(key, [p]);
  }
  return index;
}

/** Every card of the same real player (the card itself included), deduped by id. */
export function findPlayerCards(player: Player, index: ProfilePoolIndex): Player[] {
  const sameName = index.get(foldPlayerName(player.name)) ?? [];
  const known = new Set(sameName.map(cardBirthYear).filter((y): y is number => y !== null));
  const born = cardBirthYear(player);
  const out = new Map<string, Player>([[player.id, player]]);
  for (const p of sameName) {
    const by = cardBirthYear(p);
    const match =
      born !== null
        ? by === born || (by === null && known.size === 1)
        : known.size <= 1 || by === null;
    if (match && !out.has(p.id)) out.set(p.id, p);
  }
  return [...out.values()];
}

/* ------------------------------------------------------------------ history */

export interface PlayerHistoryMaps {
  seasons: Record<string, number>;
  wins: Record<string, number>;
  losses: Record<string, number>;
  perfect: Record<string, number>;
  tries: Record<string, number>;
}

export const emptyHistoryMaps = (): PlayerHistoryMaps => ({ seasons: {}, wins: {}, losses: {}, perfect: {}, tries: {} });

function addInto(target: Record<string, number>, source: Record<string, number> | undefined): void {
  if (!source || typeof source !== "object") return;
  for (const [id, n] of Object.entries(source)) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) target[id] = (target[id] ?? 0) + n;
  }
}

/** Sum lifetime-stat buckets (pass Classic, Ball Knower, Era, Draft — the stats page's set). */
export function combineHistoryBuckets(buckets: readonly (Partial<UserStatsData> | null | undefined)[]): PlayerHistoryMaps {
  const out = emptyHistoryMaps();
  for (const b of buckets) {
    if (!b) continue;
    addInto(out.seasons, b.draftCounts);
    addInto(out.wins, b.playerSeasonWins);
    addInto(out.losses, b.playerSeasonLosses);
    addInto(out.perfect, b.playerPerfectSeasons);
    addInto(out.tries, b.playerTries);
  }
  return out;
}

/* ------------------------------------------------------------------ profile */

export interface ProfileSeasonCard {
  id: string;
  year: number | null;
  club: string;
  rating: number;
  rarity: CardRarity;
  category: Player["category"];
  position: Position;
  positionLabel: string;
  collected: boolean;
  /** Finished seasons fielded (Squad Book). */
  timesFielded: number;
  /** Honours the data credits him with in this card's own season. */
  honours: string[];
}

export interface ProfileClubSpan {
  club: string;
  cards: number;
  firstYear: number | null;
  lastYear: number | null;
}

export interface ProfileHonours {
  manOfSteel: number[];
  lanceTodd: boolean;
  dreamTeam: number[];
  goldenBoot: number[];
  leagueLeaders: number[];
  superLeagueChampion: number[];
  challengeCup: number[];
  hallOfFame: boolean;
  legend: boolean;
  great: boolean;
  clubLegendAt: string[];
}

export interface ProfileYourHistory {
  /** Finished seasons he was in your squad (lifetime stats, all his cards). */
  seasons: number;
  wins: number;
  losses: number;
  /** 27-0 regular seasons with him (tracked from v1.68). */
  perfectSeasons: number;
  /** Regular-season tries for your sides (tracked from v1.68). */
  tries: number;
  collectedCards: number;
  totalCards: number;
  /** Squad Book appearances summed over his cards. */
  timesFielded: number;
  firstCollectedAt: number | null;
  firstCollectedSource: SquadBookSource | null;
  firstCollectedCardId: string | null;
  /** Dream Team shirt numbers (1-13) held by any of his cards. */
  dreamTeamNumbers: number[];
  favourite: boolean;
}

export interface ProfileTrait {
  id: string;
  label: string;
}

export interface PlayerProfile {
  name: string;
  /** All his card ids (for favourites). */
  cardIds: string[];
  /** The opened card's rarity (lib/card-rarity.ts). */
  rarity: CardRarity;
  /** Best rarity across his cards. */
  bestRarity: CardRarity;
  positionLabel: string;
  nationality: string | null;
  cards: ProfileSeasonCard[];
  clubs: ProfileClubSpan[];
  peak: { rating: number; year: number | null; club: string } | null;
  career: { appearances: number | null; tries: number | null; intlCaps: number | null };
  honours: ProfileHonours;
  hasHonours: boolean;
  yours: ProfileYourHistory;
  collected: boolean;
  /** One or two sentences, from data only. */
  flavour: string;
  /** Your bond with him, when there is one to tell. */
  bond: string | null;
  traits: ProfileTrait[];
}

export interface BuildPlayerProfileInput {
  player: Player;
  index: ProfilePoolIndex;
  book?: SquadBookState | null;
  history?: PlayerHistoryMaps | null;
}

const uniqSorted = (years: number[]) => [...new Set(years.filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);

const positionLabelOf = (p: Player): string => POSITION_LABELS[p.position as Position] ?? String(p.position ?? "");

const maxPositive = (values: (number | undefined | null)[]): number | null => {
  let best: number | null = null;
  for (const v of values) if (typeof v === "number" && Number.isFinite(v) && v > 0 && (best === null || v > best)) best = v;
  return best;
};

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function yearsLabel(years: number[]): string {
  return years.join(", ");
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

function seasonHonours(p: Player): string[] {
  const y = cardYearOf(p);
  if (y === null) return [];
  const out: string[] = [];
  if (resolveManOfSteelYears(p).includes(y)) out.push("Man of Steel");
  if (resolveSuperLeagueChampionYears(p).includes(y)) out.push("Champion");
  if (resolveChallengeCupYears(p).includes(y)) out.push("Challenge Cup");
  if (resolveLeagueLeadersYears(p).includes(y)) out.push("League Leaders");
  if (resolveDreamTeamYears(p).includes(y)) out.push("Dream Team");
  if (resolveGoldenBootYears(p).includes(y)) out.push("Golden Boot");
  return out;
}

const NO_NATIONALITY = new Set(["", "unknown", "n/a", "-", "—"]);

export function buildPlayerProfile({ player, index, book, history }: BuildPlayerProfileInput): PlayerProfile {
  const all = findPlayerCards(player, index);
  const bookCards = book?.cards ?? {};
  const hist = history ?? emptyHistoryMaps();

  const cards: ProfileSeasonCard[] = all
    .map((p) => {
      const rating = typeof p.peakRating === "number" && Number.isFinite(p.peakRating) ? p.peakRating : 0;
      return {
        id: p.id,
        year: cardYearOf(p),
        club: p.club,
        rating,
        rarity: cardRarity(p),
        category: p.category,
        position: p.position,
        positionLabel: positionLabelOf(p),
        collected: Boolean(bookCards[p.id]),
        timesFielded: bookCards[p.id]?.times ?? 0,
        honours: seasonHonours(p),
      };
    })
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.club.localeCompare(b.club) || a.id.localeCompare(b.id));

  // Clubs, in the order he first has a card there.
  const clubMap = new Map<string, ProfileClubSpan>();
  for (const c of cards) {
    const span = clubMap.get(c.club);
    if (!span) {
      clubMap.set(c.club, { club: c.club, cards: 1, firstYear: c.year, lastYear: c.year });
    } else {
      span.cards += 1;
      if (c.year !== null) {
        span.firstYear = span.firstYear === null ? c.year : Math.min(span.firstYear, c.year);
        span.lastYear = span.lastYear === null ? c.year : Math.max(span.lastYear, c.year);
      }
    }
  }
  const clubs = [...clubMap.values()];

  let peak: PlayerProfile["peak"] = null;
  for (const c of cards) {
    if (!peak || c.rating > peak.rating) peak = { rating: c.rating, year: c.year, club: c.club };
  }

  const honours: ProfileHonours = {
    manOfSteel: uniqSorted(all.flatMap(resolveManOfSteelYears)),
    lanceTodd: all.some(resolveHasLanceToddTrophy),
    dreamTeam: uniqSorted(all.flatMap(resolveDreamTeamYears)),
    goldenBoot: uniqSorted(all.flatMap(resolveGoldenBootYears)),
    leagueLeaders: uniqSorted(all.flatMap(resolveLeagueLeadersYears)),
    superLeagueChampion: uniqSorted(all.flatMap(resolveSuperLeagueChampionYears)),
    challengeCup: uniqSorted(all.flatMap(resolveChallengeCupYears)),
    hallOfFame: all.some((p) => p.hallOfFame === true),
    legend: all.some((p) => p.category === "legend"),
    great: all.some((p) => p.great === true),
    clubLegendAt: [...new Set(all.filter((p) => p.clubLegend === true).map((p) => p.club))],
  };
  const hasHonours =
    honours.manOfSteel.length > 0 ||
    honours.lanceTodd ||
    honours.dreamTeam.length > 0 ||
    honours.goldenBoot.length > 0 ||
    honours.leagueLeaders.length > 0 ||
    honours.superLeagueChampion.length > 0 ||
    honours.challengeCup.length > 0 ||
    honours.hallOfFame ||
    honours.legend ||
    honours.great ||
    honours.clubLegendAt.length > 0;

  const career = {
    appearances: maxPositive(all.map((p) => p.appearances)),
    tries: maxPositive(all.map((p) => p.tries)),
    intlCaps: maxPositive(all.map((p) => p.intlCaps)),
  };

  // Your history.
  const ids = cards.map((c) => c.id);
  const sum = (m: Record<string, number>) => ids.reduce((s, id) => s + (m[id] ?? 0), 0);
  let firstAt: number | null = null;
  let firstSource: SquadBookSource | null = null;
  let firstCardId: string | null = null;
  for (const id of ids) {
    const e = bookCards[id];
    if (!e) continue;
    const at = e.firstAt > 0 ? e.firstAt : null;
    if (firstCardId === null || (at !== null && (firstAt === null || at < firstAt))) {
      firstAt = at;
      firstSource = e.source;
      firstCardId = id;
    }
  }
  const idSet = new Set(ids);
  const dreamTeamNumbers = (book?.dreamTeam ?? []).flatMap((id, i) => (id && idSet.has(id) ? [i + 1] : []));
  const yours: ProfileYourHistory = {
    seasons: sum(hist.seasons),
    wins: sum(hist.wins),
    losses: sum(hist.losses),
    perfectSeasons: sum(hist.perfect),
    tries: sum(hist.tries),
    collectedCards: cards.filter((c) => c.collected).length,
    totalCards: cards.length,
    timesFielded: cards.reduce((s, c) => s + c.timesFielded, 0),
    firstCollectedAt: firstAt,
    firstCollectedSource: firstSource,
    firstCollectedCardId: firstCardId,
    dreamTeamNumbers,
    favourite: (book?.favourites ?? []).some((id) => idSet.has(id)),
  };
  const collected = yours.collectedCards > 0;

  const nationalityRaw = typeof player.nationality === "string" ? player.nationality.trim() : "";
  const nationality = NO_NATIONALITY.has(nationalityRaw.toLowerCase()) ? null : nationalityRaw;
  const positionLabel = positionLabelOf(player);
  const bestRarity = cards.reduce<CardRarity>((best, c) => (rarityRank(c.rarity) > rarityRank(best) ? c.rarity : best), "common");

  const profile: PlayerProfile = {
    name: player.name,
    cardIds: ids,
    rarity: cardRarity(player),
    bestRarity,
    positionLabel,
    nationality,
    cards,
    clubs,
    peak,
    career,
    honours,
    hasHonours,
    yours,
    collected,
    flavour: "",
    bond: null,
    traits: [],
  };
  profile.flavour = buildFlavourLine(profile, player);
  profile.bond = buildBondLine(profile);
  profile.traits = buildTraits(profile);
  return profile;
}

/* ------------------------------------------------------------------ personality */

function eraPhrase(profile: PlayerProfile, player: Player): string {
  const years = profile.cards.map((c) => c.year).filter((y): y is number => y !== null);
  if (years.length === 0) return "";
  if (player.category === "current" && profile.cards.every((c) => c.category === "current")) {
    return `${Math.max(...years)}`;
  }
  const first = Math.floor(Math.min(...years) / 10) * 10;
  const last = Math.floor(Math.max(...years) / 10) * 10;
  return first === last ? `${first}s` : `${first}s–${last}s`;
}

/**
 * e.g. "A 2000s–2010s loose forward from England. All 15 of his cards are at Leeds Rhinos.
 * Hall of Fame inductee and Man of Steel 2015." Facts only: era from card years, clubs from cards,
 * the headline honour from the honours data.
 */
export function buildFlavourLine(profile: PlayerProfile, player: Player): string {
  const sentences: string[] = [];
  const era = eraPhrase(profile, player);
  const pos = profile.positionLabel.toLowerCase();
  const who = [era, pos].filter(Boolean).join(" ");
  if (who) {
    const club = profile.clubs.length === 1 && player.category === "current" ? ` ${profile.clubs[0].club}` : "";
    const lead = club ? `${era}${club} ${pos}` : who;
    sentences.push(`A ${lead}${profile.nationality ? ` from ${profile.nationality}` : ""}.`);
  }

  const n = profile.cards.length;
  if (profile.clubs.length === 1 && n >= 3) {
    sentences.push(`All ${n} of his cards are at ${profile.clubs[0].club}.`);
  } else if (profile.clubs.length === 2) {
    sentences.push(`Cards at ${profile.clubs[0].club} and ${profile.clubs[1].club}.`);
  } else if (profile.clubs.length >= 3) {
    sentences.push(`A well-travelled card: ${profile.clubs.length} clubs, from ${profile.clubs[0].club} to ${profile.clubs[profile.clubs.length - 1].club}.`);
  }

  const h = profile.honours;
  const headline: string[] = [];
  if (h.hallOfFame) headline.push("Hall of Fame inductee");
  if (h.manOfSteel.length) headline.push(`Man of Steel ${yearsLabel(h.manOfSteel)}`);
  if (h.lanceTodd) headline.push("Lance Todd Trophy winner");
  if (headline.length < 2 && h.superLeagueChampion.length >= 2) headline.push(`${h.superLeagueChampion.length}-time Super League champion`);
  else if (headline.length < 2 && h.superLeagueChampion.length === 1) headline.push(`Super League champion ${h.superLeagueChampion[0]}`);
  if (headline.length) {
    const text = listJoin(headline.slice(0, 2));
    sentences.push(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
  } else if (profile.peak && profile.peak.rating > 0) {
    sentences.push(`Peaks at ${profile.peak.rating}${profile.peak.year !== null && n > 1 ? ` in ${profile.peak.year}` : ""}.`);
  }
  return sentences.join(" ");
}

/** Your story with him, from your own saves. Null when there isn't one yet. */
export function buildBondLine(profile: PlayerProfile): string | null {
  const y = profile.yours;
  if (y.perfectSeasons > 0) return `Went 27-0 with you ${times(y.perfectSeasons)}.`;
  if (y.dreamTeamNumbers.length) return `Wears No. ${y.dreamTeamNumbers[0]} in your Dream Team.`;
  if (y.seasons >= 5) return `A regular: ${y.seasons} finished seasons in your sides.`;
  if (y.tries >= 10) return `${y.tries} tries for your sides.`;
  if (y.seasons > 0 && y.wins + y.losses > 0 && y.wins / (y.wins + y.losses) >= 0.75) {
    return `Won ${Math.round((y.wins / (y.wins + y.losses)) * 100)}% of his games with you.`;
  }
  return null;
}

export function buildTraits(profile: PlayerProfile): ProfileTrait[] {
  const out: ProfileTrait[] = [];
  const h = profile.honours;
  if (h.hallOfFame) out.push({ id: "hof", label: "Hall of Fame" });
  if (h.legend) out.push({ id: "legend", label: "Legend" });
  else if (h.great) out.push({ id: "great", label: "Great" });
  for (const club of h.clubLegendAt) out.push({ id: `club-legend-${club}`, label: `Club Legend · ${club}` });
  if (profile.clubs.length === 1 && profile.cards.length >= 3) out.push({ id: "one-club", label: "One-club card" });
  if (profile.clubs.length >= 3) out.push({ id: "travelled", label: `${profile.clubs.length} clubs` });
  if (profile.career.intlCaps) out.push({ id: "caps", label: `${profile.career.intlCaps} intl caps` });
  return out;
}
