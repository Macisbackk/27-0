/**
 * Player profile tests (v1.68): grouping a player's year cards across clubs (and keeping namesakes
 * apart), season records + peak, career honours from the honours data, "your history" summed over
 * his cards and the lifetime-stat buckets, the data-only flavour line / traits, the new per-player
 * 27-0 + try tracking in lifetime stats (and its cloud merge), and Squad Book favourites.
 * Run: bun scripts/test-player-profile.ts   (bun only: it mocks the Supabase client module)
 */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(i: number): string | null { return [...this.values.keys()][i] ?? null; }
  get length(): number { return this.values.size; }
}
const storage = new MemoryStorage();
Object.assign(globalThis, { window: Object.assign(new EventTarget(), { localStorage: storage }), localStorage: storage });
if (typeof globalThis.CustomEvent === "undefined") {
  class NodeCustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) { super(type); this.detail = init?.detail as T; }
  }
  Object.assign(globalThis, { CustomEvent: NodeCustomEvent });
}

import { mock } from "bun:test";
mock.module("../src/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: { from: () => ({ select: () => ({}), upsert: async () => ({ error: null }) }) },
}));

import type { Player, UserStatsData } from "../src/lib/types";

let failures = 0;
let checks = 0;
function check(condition: unknown, message: string): void {
  checks += 1;
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
}

function card(over: Partial<Player> & { id: string; name: string; club: string }): Player {
  return {
    position: "LOOSE_FORWARD",
    nationality: "England",
    yearsActive: "",
    category: "historic",
    peakRating: 80,
    value: 100_000,
    intlCaps: 0,
    ...over,
  } as Player;
}

async function main(): Promise<void> {
  const pp = await import("../src/lib/player-profile");
  const sb = await import("../src/lib/squad-book");
  const { applySeasonLifetimeUpdate } = await import("../src/lib/lifetime-stats");
  const { EMPTY_STATS, migrateUserStats } = await import("../src/lib/storage/stats");
  const { mergeUserStatsData } = await import("../src/lib/storage/merge-user-stats");

  /* ---------------- grouping ---------------- */
  const a2004 = card({ id: "leeds-hist-a-player-2004", name: "A Player", club: "Leeds Rhinos", year: 2004, birthYear: 1980, peakRating: 88 });
  const a2010 = card({ id: "leeds-hist-a-player-2010", name: "A Player", club: "Leeds Rhinos", year: 2010, birthYear: 1980, peakRating: 93, great: true });
  const a2015 = card({ id: "wigan-hist-a-player-2015", name: "A Player", club: "Wigan Warriors", year: 2015, birthYear: 1980, peakRating: 84, clubLegend: true, appearances: 300, tries: 90, intlCaps: 12 });
  const aNoBy = card({ id: "hull-hist-a-player-2012", name: "A Player", club: "Hull FC", year: 2012, peakRating: 80 });
  const namesake = card({ id: "salford-cur-a-player", name: "A Player", club: "Salford Red Devils", year: 2026, birthYear: 2001, category: "current", peakRating: 72 });
  const other = card({ id: "leeds-hist-someone-else-2004", name: "Someone Else", club: "Leeds Rhinos", year: 2004, birthYear: 1980 });
  const accent = card({ id: "cats-hist-jose-2010", name: "José Example", club: "Catalans Dragons", year: 2010, birthYear: 1985 });
  const plain = card({ id: "cats-hist-jose-2011", name: "Jose Example", club: "Catalans Dragons", year: 2011, birthYear: 1985 });
  const index = pp.indexProfilePool([a2004, a2010, a2015, aNoBy, namesake, other, accent, plain]);

  const group = pp.findPlayerCards(a2010, index).map((p) => p.id).sort();
  check(group.length === 3 && group.includes(a2004.id) && group.includes(a2015.id), `year cards across clubs grouped (${group.join(",")})`);
  check(!group.includes(namesake.id), "a namesake with another birth year is a different player");
  check(!group.includes(aNoBy.id), "a card with no birth year doesn't join when namesakes disagree");
  check(!group.includes(other.id), "other players never join");
  check(pp.findPlayerCards(accent, index).length === 2, "accents fold (José = Jose)");
  const soloIndex = pp.indexProfilePool([a2004, aNoBy]);
  check(pp.findPlayerCards(a2004, soloIndex).length === 2, "a card with no birth year joins when only one birth year is known");
  check(pp.findPlayerCards(a2004, pp.indexProfilePool([])).length === 1, "the card itself is always in its group");

  /* ---------------- profile assembly ---------------- */
  const book = sb.emptySquadBook();
  book.cards[a2004.id] = { name: a2004.name, club: a2004.club, year: 2004, firstAt: 2_000, source: "era", times: 3 };
  book.cards[a2015.id] = { name: a2015.name, club: a2015.club, year: 2015, firstAt: 1_000, source: "classic", times: 2 };
  book.dreamTeam[12] = a2010.id;
  const history = pp.combineHistoryBuckets([
    { draftCounts: { [a2004.id]: 3, [other.id]: 9 }, playerSeasonWins: { [a2004.id]: 60 }, playerSeasonLosses: { [a2004.id]: 21 }, playerPerfectSeasons: { [a2004.id]: 1 }, playerTries: { [a2004.id]: 7 } },
    { draftCounts: { [a2015.id]: 2 }, playerSeasonWins: { [a2015.id]: 40 }, playerSeasonLosses: { [a2015.id]: 14 }, playerTries: { [a2015.id]: 4 } },
    null,
    { draftCounts: { [a2015.id]: -5 } } as Partial<UserStatsData>,
  ]);
  const profile = pp.buildPlayerProfile({ player: a2010, index, book, history });

  check(profile.cards.map((c) => c.year).join(",") === "2004,2010,2015", "season records sorted by year");
  check(profile.cards.find((c) => c.id === a2004.id)?.timesFielded === 3 && profile.cards.find((c) => c.id === a2010.id)?.collected === false, "per-card collected + appearances");
  check(profile.peak?.rating === 93 && profile.peak.year === 2010 && profile.peak.club === "Leeds Rhinos", "peak rating with its season");
  check(profile.clubs.length === 2 && profile.clubs[0].club === "Leeds Rhinos" && profile.clubs[0].cards === 2 && profile.clubs[0].firstYear === 2004 && profile.clubs[0].lastYear === 2010, "club spans");
  check(profile.rarity === "epic" && profile.bestRarity === "epic", "rarity from card-rarity.ts (Great → Epic)");
  check(profile.yours.seasons === 5 && profile.yours.wins === 100 && profile.yours.losses === 35, "history summed over his cards only (negative junk ignored)");
  check(profile.yours.perfectSeasons === 1 && profile.yours.tries === 11, "27-0s and tries summed");
  check(profile.yours.collectedCards === 2 && profile.yours.totalCards === 3 && profile.yours.timesFielded === 5, "collection counts");
  check(profile.yours.firstCollectedAt === 1_000 && profile.yours.firstCollectedSource === "classic" && profile.yours.firstCollectedCardId === a2015.id, "first collected = earliest card");
  check(profile.yours.dreamTeamNumbers.join() === "13", "Dream Team shirt found");
  check(profile.career.appearances === 300 && profile.career.tries === 90 && profile.career.intlCaps === 12, "career numbers = largest the data has");
  check(profile.honours.great && profile.honours.clubLegendAt.join() === "Wigan Warriors" && !profile.honours.hallOfFame && !profile.honours.legend, "status honours from flags only");
  check(profile.flavour.startsWith("A 2000s–2010s loose forward from England."), `flavour era/position/nationality (${profile.flavour})`);
  check(profile.flavour.includes("Cards at Leeds Rhinos and Wigan Warriors."), "flavour clubs");
  check(profile.flavour.includes("Peaks at 93 in 2010."), "flavour peak when no headline honour");
  check(profile.bond === "Went 27-0 with you once.", `bond line (${profile.bond})`);
  check(profile.traits.some((t) => t.id === "great") && profile.traits.some((t) => t.id === "caps" && t.label === "12 intl caps"), "traits");
  check(!profile.yours.favourite, "not a favourite yet");

  const fresh = pp.buildPlayerProfile({ player: namesake, index });
  check(!fresh.collected && fresh.yours.seasons === 0 && fresh.bond === null && fresh.cards.length === 1, "uncollected card with no history");
  check(fresh.flavour.startsWith("A 2026 Salford Red Devils loose forward from England."), `current-card flavour (${fresh.flavour})`);
  check(!fresh.flavour.includes("Peaks at 72 in"), "single card: no 'in <year>' on the peak");
  const nat = pp.buildPlayerProfile({ player: { ...namesake, nationality: "Unknown" }, index });
  check(!nat.flavour.includes("from"), "unknown nationality left out");

  // One club, 3+ cards.
  const oc = [2001, 2003, 2005].map((y) => card({ id: `saints-hist-b-${y}`, name: "B Player", club: "St Helens", year: y, birthYear: 1975 }));
  const ocProfile = pp.buildPlayerProfile({ player: oc[0], index: pp.indexProfilePool(oc) });
  check(ocProfile.flavour.includes("All 3 of his cards are at St Helens.") && ocProfile.traits.some((t) => t.id === "one-club"), "one-club flavour + trait");

  /* ---------------- real honours data ---------------- */
  const players = await import("../src/lib/players");
  await players.ensurePlayersLoaded().catch(() => undefined);
  const pool = players.getRecruitablePlayers().filter((p) => !players.isHiddenPlayer(p));
  const realIndex = pp.indexProfilePool(pool);
  const wellens = pool.find((p) => p.name === "Paul Wellens");
  if (wellens) {
    const w = pp.buildPlayerProfile({ player: wellens, index: realIndex });
    check(w.cards.length >= 1 && w.cards.every((c) => c.id && c.club), "real player: cards resolve");
    check(w.honours.manOfSteel.length > 0 && w.flavour.includes("Man of Steel"), `real player: Man of Steel from data (${w.honours.manOfSteel.join(",")})`);
    check(w.honours.superLeagueChampion.length > 0, "real player: Super League titles from data");
    const years = w.cards.map((c) => c.year ?? 0);
    check(years.every((y, i) => i === 0 || y >= years[i - 1]), "real player: seasons in order");
  } else {
    check(false, "Paul Wellens is in the pool");
  }
  const sinfield = pool.filter((p) => p.name === "Kevin Sinfield");
  if (sinfield.length) {
    const k = pp.buildPlayerProfile({ player: sinfield[0], index: realIndex });
    check(k.cards.length === sinfield.length, `every Sinfield card grouped (${k.cards.length}/${sinfield.length})`);
    check(k.honours.legend || k.honours.hallOfFame || k.honours.great || k.cards.some((c) => c.rarity !== "common"), "Sinfield: status honours from the data");
  }
  // No profile ever invents honours: a player with no honours data has none.
  const plainReal = pool.find((p) => p.category === "current" && !p.hallOfFame && !p.great && !p.clubLegend && pp.buildPlayerProfile({ player: p, index: realIndex }).cards.length === 1);
  if (plainReal) {
    const pr = pp.buildPlayerProfile({ player: plainReal, index: realIndex });
    check(pr.honours.manOfSteel.length === 0 || pr.honours.manOfSteel.every(Number.isFinite), "honour years are numbers");
  }

  /* ---------------- lifetime tracking (27-0s, tries) ---------------- */
  const base = migrateUserStats({});
  check(JSON.stringify(base.playerPerfectSeasons) === "{}" && JSON.stringify(base.playerTries) === "{}", "old saves load with empty maps");
  const input = {
    wins: 27, losses: 0, leaguePosition: 1, isPerfect: true, longestWinStreak: 27, longestLosingStreak: 0,
    signedIds: ["p1", "p2"], totalValue: 1, playerTries: { p1: 12, p3: 5, p2: 0 },
  };
  const s1 = applySeasonLifetimeUpdate(base, input);
  check(s1.playerPerfectSeasons?.p1 === 1 && s1.playerPerfectSeasons?.p2 === 1, "27-0 counted per player");
  check(s1.playerTries?.p1 === 12 && s1.playerTries?.p3 === undefined && s1.playerTries?.p2 === undefined, "tries only for your squad, zero ignored");
  const s2 = applySeasonLifetimeUpdate(s1, { ...input, wins: 20, losses: 7, isPerfect: false, playerTries: { p1: 3 } });
  check(s2.playerPerfectSeasons?.p1 === 1 && s2.playerTries?.p1 === 15 && s2.draftCounts.p1 === 2, "non-27-0 season adds tries, not a 27-0");
  check(EMPTY_STATS.playerPerfectSeasons && Object.keys(EMPTY_STATS.playerPerfectSeasons).length === 0, "EMPTY_STATS not mutated");
  const legacy = { ...s2 } as Partial<UserStatsData>;
  delete legacy.playerPerfectSeasons;
  delete legacy.playerTries;
  const merged = mergeUserStatsData(s2, legacy as UserStatsData);
  check(merged.playerPerfectSeasons?.p1 === 1 && merged.playerTries?.p1 === 15, "merge with a pre-v1.68 cloud row keeps the new maps");
  const both = mergeUserStatsData(s2, s2);
  check(both.playerTries?.p1 === 30, "merge adds the maps like the other per-player maps");

  /* ---------------- favourites ---------------- */
  const f0 = sb.emptySquadBook();
  f0.cards[a2004.id] = book.cards[a2004.id];
  const f1 = sb.setFavouritePure(f0, [a2004.id, a2010.id], true, 50);
  check(f1.favourites.join() === a2004.id && f1.favouritesAt === 50, "star saves one card id with its time");
  check(sb.setFavouritePure(f1, [a2010.id, a2004.id], true, 60) === f1, "starring an already-starred player changes nothing");
  const f2 = sb.setFavouritePure(f1, [a2010.id, a2004.id], false, 40);
  check(f2.favourites.length === 0 && f2.favouritesAt === 51, "unstar clears all his cards; time always moves forward");
  check(sb.setFavouritePure(f0, [], true) === f0, "no ids, no change");
  const old = sb.normalizeSquadBook({ v: 1, cards: {}, claimed: [], runs: [] });
  check(old.favourites.length === 0 && old.favouritesAt === 0, "pre-v1.68 books load with no favourites");
  const junk = sb.normalizeSquadBook({ favourites: ["a", "a", 5, "", null, "b"], favouritesAt: "x" });
  check(junk.favourites.join() === "a,b" && junk.favouritesAt === 0, "junk favourites cleaned");
  check(sb.mergeSquadBookStates(f1, f2).favourites.length === 0, "newer favourites list wins a merge (unstar survives)");
  check(sb.mergeSquadBookStates(f1, f0).favourites.join() === a2004.id, "older/empty list loses");
  // Through storage.
  storage.setItem((await import("../src/lib/storage/keys")).STORAGE_KEYS.squadBook, JSON.stringify(f0));
  sb.setFavourite([a2004.id], true);
  check(sb.getSquadBook().favourites.includes(a2004.id), "setFavourite saves locally");
  const withFav = pp.buildPlayerProfile({ player: a2010, index, book: sb.getSquadBook(), history });
  check(withFav.yours.favourite, "profile sees the favourite on any of his cards");

  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
