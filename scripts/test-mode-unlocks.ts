/**
 * More modes unlocks (lib/mode-unlocks.ts, v1.50): each challenge's rule, hidden modes never
 * counting, the backfill from lifetime stats / run history / Daily history, and idempotent grants.
 * Run: bun scripts/test-mode-unlocks.ts   (bun only: it mocks the Supabase client module)
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

// Offline Supabase: grants save locally, cloud writes go nowhere.
import { mock } from "bun:test";
function query() {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async () => ({ error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
  };
  return q;
}
mock.module("../src/lib/supabase", () => ({ isSupabaseConfigured: false, supabase: { from: query } }));

let failures = 0;
let checks = 0;
function check(condition: unknown, message: string): void {
  checks += 1;
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
}
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function main(): Promise<void> {
  const cos = await import("../src/lib/cosmetics");
  const mu = await import("../src/lib/mode-unlocks");
  const store = await import("../src/lib/storage/cosmetics-store");
  const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
  const { RUN_HISTORY_KEY } = await import("../src/lib/storage/run-history");
  const { ONE_CLUB_MODE_ID: ONE, GAUNTLET_MODE_ID: GAUNT, PAST_DAILIES_MODE_ID: PAST, BALL_KNOWER_ID: BK } = cos;

  // ---------------------------------------------------------------- catalogue
  check(mu.MODE_UNLOCKS.length === 4, "four More modes to unlock");
  check(mu.MODE_UNLOCKS.every((m) => cos.cosmeticById(m.id)?.kind === "mode" && cos.cosmeticById(m.id)?.notForSale), "each mode is a notForSale mode item");
  check(mu.MODE_UNLOCKS.every((m) => m.text.length > 0 && m.text.length <= 80), "challenge copy is short");

  // ---------------------------------------------------------------- One-Club XI rule
  const five = ["Wigan Warriors", "Wigan Warriors", "wigan warriors", "Wigan Warriors '98", "Wigan Warriors '05", "Leeds Rhinos", "St Helens", null, ""];
  check(mu.mostFromOneClub(five) === 5, "era suffix and case don't split a club; nulls ignored");
  check(mu.mostFromOneClub([]) === 0, "empty squad: 0");
  check(mu.meetsOneClubChallenge(20, five), "20 wins + 5 from one club: met");
  check(mu.meetsOneClubChallenge(27, five), "27 wins + 5 from one club: met");
  check(!mu.meetsOneClubChallenge(19, five), "19 wins: not met");
  check(!mu.meetsOneClubChallenge(25, five.slice(1)), "4 from one club: not met");
  const fourAndFour = ["Hull FC", "Hull FC", "Hull FC", "Hull FC", "Hull KR", "Hull KR", "Hull KR", "Hull KR"];
  check(!mu.meetsOneClubChallenge(25, fourAndFour), "4 + 4 from two clubs isn't 5 from one");

  // ---------------------------------------------------------------- season / play-off rules
  check(same(mu.seasonUnlockIds({ wins: 22, perfect: false, clubs: five, hidden: false }), [ONE]), "season: One-Club XI");
  check(same(mu.seasonUnlockIds({ wins: 27, perfect: true, clubs: five, hidden: false }), [ONE, BK]), "27-0 with 5 from one club: both");
  check(same(mu.seasonUnlockIds({ wins: 27, perfect: true, clubs: [], hidden: false }), [BK]), "27-0: Ball Knower");
  check(mu.seasonUnlockIds({ wins: 27, perfect: true, clubs: five, hidden: true }).length === 0, "hidden mode season: nothing");
  check(same(mu.playoffUnlockIds({ champion: true, hidden: false }), [GAUNT]), "Grand Final win: Gauntlet");
  check(mu.playoffUnlockIds({ champion: false, hidden: false }).length === 0, "Grand Final lost: nothing");
  check(mu.playoffUnlockIds({ champion: true, hidden: true }).length === 0, "hidden mode Grand Final: nothing");

  // ---------------------------------------------------------------- backfill rule (pure)
  const card = (club: string) => ({ slot: 0, label: "", id: club, name: club, club, year: null, rating: 80 });
  const entry = (o: Partial<{ wins: number; perfect: boolean; finish: string | null; squad: ReturnType<typeof card>[] }>) => ({
    wins: 0, perfect: false, finish: null, squad: [], ...o,
  });
  const E = mu.EMPTY_EVIDENCE;
  check(mu.earnedModeIds(E).length === 0, "no evidence: nothing earned");
  check(same(mu.earnedModeIds({ ...E, history: [entry({ wins: 21, squad: five.filter(Boolean).map((c) => card(c as string)) })] }), [ONE]), "history: 21 wins with 5 from one club");
  check(mu.earnedModeIds({ ...E, history: [entry({ wins: 19, squad: five.filter(Boolean).map((c) => card(c as string)) })] }).length === 0, "history: 19 wins doesn't count");
  check(same(mu.earnedModeIds({ ...E, classicTitles: 1 }), [GAUNT]), "stats: a Classic title");
  check(same(mu.earnedModeIds({ ...E, history: [entry({ finish: "Super League Champions" })] }), [GAUNT]), "history: champions");
  check(mu.earnedModeIds({ ...E, history: [entry({ finish: "Grand Final Runner-Up" })] }).length === 0, "history: runner-up doesn't count");
  check(mu.earnedModeIds({ ...E, dailiesFinished: 2 }).length === 0, "2 Dailies: locked");
  check(same(mu.earnedModeIds({ ...E, dailiesFinished: 3 }), [PAST]), "3 Dailies: Past Dailies");
  check(same(mu.earnedModeIds({ ...E, perfectSeasons: 1 }), [BK]), "stats: a 27-0");
  check(same(mu.earnedModeIds({ ...E, history: [entry({ perfect: true })] }), [BK]), "history: a 27-0");

  // ---------------------------------------------------------------- storage backfill
  storage.clear();
  check(mu.syncModeUnlocks().length === 0, "new player: nothing unlocked");
  check(!mu.isModeUnlocked(ONE) && !mu.isModeUnlocked(GAUNT) && !mu.isModeUnlocked(PAST) && !mu.isModeUnlocked(BK), "new player: all locked");
  check(mu.getModeUnlockProgress().dailiesFinished === 0, "new player: 0 Dailies finished");

  // Lifetime stats: a Grand Final win in Era Classic and a 27-0.
  storage.setItem(STORAGE_KEYS.stats, JSON.stringify({ normal: { totalPerfectSeasons: 1 }, eraNormal: { superLeagueTitles: 2 } }));
  check(same(mu.syncModeUnlocks(), [GAUNT, BK]), "stats backfill: Gauntlet + Ball Knower");
  check(mu.syncModeUnlocks().length === 0, "second sync grants nothing (idempotent)");
  check(store.ownsCosmetic(GAUNT) && store.ownsCosmetic(BK), "granted items are owned");
  check(mu.isBallKnowerUnlocked() && mu.hasGone27Nil(), "Ball Knower helpers still work");

  // Titles in a non-Classic bucket (old Draft / Fantasy) don't unlock the Gauntlet.
  storage.clear();
  storage.setItem(STORAGE_KEYS.stats, JSON.stringify({ normal: {}, draftNormal: { superLeagueTitles: 3 }, fantasy: { superLeagueTitles: 1 } }));
  check(!mu.syncModeUnlocks().includes(GAUNT), "Draft / Fantasy titles don't count");

  // Run history (hidden modes are never written there).
  storage.clear();
  storage.setItem(RUN_HISTORY_KEY, JSON.stringify([
    { id: "r1", variant: "era", wins: 23, perfect: false, finish: "Eliminated in Semi-Final", squad: five.filter(Boolean).map((c) => card(c as string)) },
    { id: "r2", variant: "daily", wins: 18, perfect: false, finish: "Super League Champions", squad: [] },
  ]));
  check(same(mu.syncModeUnlocks(), [ONE, GAUNT]), "history backfill: One-Club XI + Gauntlet");

  // Daily history: finished days in the progress map; the best streak is a floor.
  storage.clear();
  storage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify({ "2026-10-01": { finished: true }, "2026-10-05": { leagueLeaders: true } }));
  check(mu.getModeUnlockProgress().dailiesFinished === 2, "2 finished days counted");
  check(!mu.syncModeUnlocks().includes(PAST), "2 Dailies: still locked");
  storage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify({ "2026-10-01": { finished: true }, "2026-10-05": { leagueLeaders: true }, "2026-10-09": { finished: true }, "2026-10-10": { frozen: true } }));
  check(mu.getModeUnlockProgress().dailiesFinished === 3, "3 finished days (a frozen day isn't one)");
  check(same(mu.syncModeUnlocks(), [PAST]), "3 Dailies: Past Dailies");
  storage.clear();
  storage.setItem(STORAGE_KEYS.dailyChallengeMeta, JSON.stringify({ currentStreak: 0, bestStreak: 5, lastCompletedDateKey: "2026-01-05" }));
  check(mu.syncModeUnlocks().includes(PAST), "best streak of 5 (days trimmed from the map) still unlocks");
  check(mu.getModeUnlockProgress().dailiesFinished === 3, "progress caps at 3");

  // ---------------------------------------------------------------- live grants
  storage.clear();
  check(same(mu.unlockModesAfterSeason({ wins: 24, perfect: false, clubs: five, hidden: false }), [ONE]), "season grant: One-Club XI");
  check(mu.unlockModesAfterSeason({ wins: 24, perfect: false, clubs: five, hidden: false }).length === 0, "season grant is idempotent");
  check(mu.unlockModesAfterSeason({ wins: 27, perfect: true, clubs: five, hidden: true }).length === 0, "hidden-mode season grants nothing");
  check(!store.ownsCosmetic(BK), "hidden-mode 27-0 didn't unlock Ball Knower");
  check(same(mu.unlockModesAfterPlayoffs({ champion: true, hidden: false }), [GAUNT]), "play-off grant: Gauntlet");
  check(mu.unlockModesAfterPlayoffs({ champion: true, hidden: false }).length === 0, "play-off grant is idempotent");
  check(mu.unlockModesAfterPlayoffs({ champion: true, hidden: true }).length === 0, "hidden-mode title grants nothing");
  // A season also picks up a 3rd Daily just recorded.
  storage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify({ "2026-10-01": { finished: true }, "2026-10-02": { finished: true }, "2026-10-03": { finished: true } }));
  check(same(mu.unlockModesAfterSeason({ wins: 10, perfect: false, clubs: [], hidden: false }), [PAST]), "season end picks up the 3rd Daily");

  // ---------------------------------------------------------------- owned items are kept
  storage.clear();
  store.grantCosmetic(GAUNT);
  check(mu.isModeUnlocked(GAUNT), "an owned mode stays unlocked with no evidence");
  check(mu.syncModeUnlocks().length === 0 && store.ownsCosmetic(GAUNT), "sync never takes an owned mode away");
  check(mu.grantModeUnlocks(["title-rookie", "nope"]).length === 0 && !store.ownsCosmetic("title-rookie"), "grantModeUnlocks only grants mode ids");
  check(same(mu.grantModeUnlocks([ONE, ONE]), [ONE]), "duplicate ids grant once");
  const counts = mu.countUnlockedModes(store.getCosmetics().owned);
  check(counts.unlocked === 2 && counts.total === 4, "home badge count: 2 of 4");

  // Corrupt storage never throws.
  storage.setItem(STORAGE_KEYS.stats, "{{not json");
  storage.setItem(RUN_HISTORY_KEY, JSON.stringify({ wins: "lots" }));
  storage.setItem(STORAGE_KEYS.dailyChallengeClaims, "{{");
  storage.setItem(STORAGE_KEYS.dailyChallengeMeta, JSON.stringify({ bestStreak: "lots" }));
  let threw = false;
  try {
    mu.syncModeUnlocks();
    mu.getModeUnlockProgress();
    mu.isModeUnlocked(PAST);
  } catch {
    threw = true;
  }
  check(!threw, "corrupt storage doesn't throw");

  if (failures) {
    console.error(`Mode unlocks: ${failures}/${checks} checks failed.`);
    process.exit(1);
  }
  console.log(`Mode unlocks: all ${checks} checks passed.`);
}

void main();
