/**
 * Squad Book collections (v1.66): card rarity, club collection pools and their reward track
 * (claimed by hand, paid once, 100% grants the club's notForSale title), the generated club
 * titles staying out of the Store, the all-time Dream Team, and old books loading cleanly.
 * Run: bun scripts/test-squad-book-collections.ts   (bun only: it mocks the Supabase client module)
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
let cloudBook: unknown = null;
function query(table: string) {
  let key = "";
  const q = {
    select: () => q,
    eq: (col: string, val: string) => { if (col === "stat_key") key = val; return q; },
    maybeSingle: async () => ({ data: table === "user_stats" && key === "squad_book" && cloudBook ? { stat_json: cloudBook } : null, error: null }),
    upsert: async (row: Record<string, unknown>) => {
      if (row.stat_key === "squad_book") cloudBook = JSON.parse(JSON.stringify(row.stat_json));
      return { error: null };
    },
    update: () => ({ eq: async () => ({ error: null }) }),
  };
  return q;
}
mock.module("../src/lib/supabase", () => ({ isSupabaseConfigured: true, supabase: { from: query } }));

let failures = 0;
let checks = 0;
function check(condition: unknown, message: string): void {
  checks += 1;
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
}

async function main(): Promise<void> {
  const sb = await import("../src/lib/squad-book");
  const rarity = await import("../src/lib/card-rarity");
  const rewards = await import("../src/lib/collection-rewards");
  const cos = await import("../src/lib/cosmetics");
  const store = await import("../src/lib/storage/cosmetics-store");
  const funds = await import("../src/lib/storage/club-funds");
  const auth = await import("../src/lib/auth-session");
  const players = await import("../src/lib/players");
  const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
  const flush = () => new Promise((r) => setTimeout(r, 20));

  // ---------------------------------------------------------------- rarity
  check(rarity.cardRarity({ peakRating: 72, category: "current" }) === "common", "72 current card is Common");
  check(rarity.cardRarity({ peakRating: 85, category: "historic" }) === "rare", "85 is Rare");
  check(rarity.cardRarity({ peakRating: 90, category: "historic" }) === "epic", "90 is Epic");
  check(rarity.cardRarity({ peakRating: 82, great: true }) === "epic", "a Great card is at least Epic");
  check(rarity.cardRarity({ peakRating: 95 }) === "legendary", "95 is Legendary");
  check(rarity.cardRarity({ peakRating: 80, category: "legend" }) === "legendary", "Legend cards are Legendary");
  check(rarity.cardRarity({ peakRating: 84, hallOfFame: true }) === "legendary", "Hall of Fame cards are Legendary");
  check(rarity.cardRarity({ peakRating: Number.NaN }) === "common", "bad rating falls back to Common");

  const catalog = sb.getSquadBookCatalog();
  const all = players.getRecruitablePlayers();
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<string, number>;
  for (const c of catalog.cards) counts[c.rarity] += 1;
  check(rarity.CARD_RARITIES.every((r) => counts[r] > 0), `every rarity has cards (${JSON.stringify(counts)})`);
  check(counts.legendary < counts.epic && counts.epic < counts.common + counts.rare, "rarer tiers hold fewer cards");
  check(catalog.cards.filter((c) => c.category === "legend").every((c) => c.rarity === "legendary"), "every Legend card in the catalogue is Legendary");

  // ---------------------------------------------------------------- generated club titles
  const titles = rewards.COLLECTION_REWARD_COSMETICS;
  check(titles.length >= 15, `a title per club (${titles.length})`);
  check(titles.every((t) => t.kind === "title" && t.notForSale && cos.cosmeticById(t.id) === t), "club titles are notForSale titles in COSMETICS");
  check(new Set(cos.COSMETICS.map((c) => c.id)).size === cos.COSMETICS.length, "cosmetic ids still unique");
  check(!cos.cosmeticsOfKind("title").some((c) => rewards.isCollectionRewardId(c.id)), "club titles are not listed in the Store");
  check(cos.nextStoreUnlock(0)?.price !== 0, "a free club title is never the next Store unlock");
  check(rewards.collectionTitleFor("Bradford Bulls") === "title-collector-bradford-bulls", "Bradford Bulls has a title");
  check(cos.titleName("title-collector-bradford-bulls") === "Bradford Bulls Completist", "title name shown on leaderboards");
  check(rewards.collectionTitleFor("Nowhere RLFC") === null, "unknown club has no title");
  check(store.purchaseCosmetic("title-collector-bradford-bulls").success === false, "club titles can't be bought");

  // ---------------------------------------------------------------- pools and tiers
  const LEEDS = "Leeds Rhinos";
  const pool = catalog.clubPlayers.get(LEEDS)!;
  check(pool && pool.size >= rewards.COLLECTION_MIN_POOL, "Leeds has a collection pool");
  check(pool.size < catalog.clubCards.get(LEEDS)!.length, `pool counts players, not cards (${pool.size} players / ${catalog.clubCards.get(LEEDS)!.length} cards)`);
  check([...pool.values()].flat().length === catalog.clubCards.get(LEEDS)!.length, "every Leeds card belongs to one pool player");
  const tiers = catalog.milestones.filter((m) => m.kind === "collection" && m.group === LEEDS);
  check(tiers.map((m) => m.percent).join(",") === "25,50,100", "Leeds has 25/50/100% tiers");
  check(tiers[2]?.target === pool.size, "100% tier needs the whole pool");
  check(tiers[0]?.target === Math.ceil(pool.size / 4), "25% tier rounds up");
  check(tiers[2]?.cosmeticId === "title-collector-leeds-rhinos" && !tiers[0]?.cosmeticId, "only the 100% tier grants the title");
  for (const club of catalog.clubs) {
    const size = catalog.clubPlayers.get(club)?.size ?? 0;
    const has = catalog.milestones.some((m) => m.kind === "collection" && m.group === club);
    if (size < rewards.COLLECTION_MIN_POOL && has) check(false, `${club}: tiny pool has no reward track`);
  }
  check(new Set(catalog.milestones.map((m) => m.id)).size === catalog.milestones.length, "milestone ids unique");

  // ---------------------------------------------------------------- collecting + claiming
  const slot = (p: (typeof all)[number]) => ({ position: p.position, slotIndex: 0, label: "", player: p });
  const firstCards = [...pool.values()].map((ids) => all.find((p) => p.id === ids[0])!).filter(Boolean);
  check(firstCards.length === pool.size, "one card per Leeds player");

  // Two cards of one player count once.
  const multi = [...pool.values()].find((ids) => ids.length >= 2);
  if (multi) {
    const twoCards = multi.slice(0, 2).map((id) => all.find((p) => p.id === id)!);
    sb.recordSquadBookRun({ runId: "multi", mode: "CLASSIC", squad: twoCards.map(slot) });
    const pr = sb.computeSquadBookProgress(sb.getSquadBook(), catalog);
    check(pr.byClubPlayers.get(LEEDS)?.have === 1, "two year cards of one player = one collected player");
    check((pr.byClub.get(LEEDS)?.have ?? 0) === 2, "card count still counts both cards");
  }

  const start = funds.getClubFundsBalance();
  let runNo = 0;
  const recordUpTo = (n: number) => {
    const have = sb.computeSquadBookProgress(sb.getSquadBook(), catalog).byClubPlayers.get(LEEDS)!.have;
    const todo = firstCards.filter((p) => !sb.getSquadBook().cards[p.id]).slice(0, Math.max(0, n - have));
    for (let i = 0; i < todo.length; i += 17) {
      runNo += 1;
      const res = sb.recordSquadBookRun({ runId: `leeds-${runNo}`, mode: "CLASSIC", squad: todo.slice(i, i + 17).map(slot) });
      check(!res.paid.some((l) => l.id.startsWith("squadbook-collection-")), "collection tiers are never auto-paid at season end");
    }
  };
  recordUpTo(tiers[0].target - 1);
  check(sb.claimableCollectionRewards(sb.getSquadBook(), catalog, LEEDS).length === 0, "one short of 25%: nothing to claim");
  check(sb.claimCollectionRewards(LEEDS).claimed.length === 0, "claim below the target does nothing");
  recordUpTo(tiers[0].target);
  const ready = sb.claimableCollectionRewards(sb.getSquadBook(), catalog, LEEDS);
  check(ready.length === 1 && ready[0].percent === 25, "25% tier ready to claim");
  sb.claimSquadBookMilestones();
  check(!sb.getSquadBook().claimed.includes(ready[0].id), "auto-claim leaves the collection tier for the coach");
  const before = funds.getClubFundsBalance();
  const c1 = sb.claimCollectionRewards(LEEDS);
  check(c1.claimed.length === 1 && c1.paid[0]?.amount === 100_000, "claim pays the 25% reward");
  check(funds.getClubFundsBalance() === before + 100_000, "Club Funds credited");
  check(funds.getPaidRunIds().includes(`squadbook:${ready[0].id}`), "ledger id squadbook:<milestone>");
  check(sb.claimCollectionRewards(LEEDS).claimed.length === 0, "second claim is a no-op");

  // Claim list lost: the ledger still refuses a second payout, the claim is repaired.
  const lost = sb.getSquadBook();
  lost.claimed = lost.claimed.filter((id) => id !== ready[0].id);
  storage.setItem(STORAGE_KEYS.squadBook, JSON.stringify(lost));
  const again = sb.claimCollectionRewards(LEEDS);
  check(again.claimed.length === 1 && again.paid.length === 0, "lost claim list: marked claimed, nothing paid twice");
  check(funds.getClubFundsBalance() === before + 100_000, "balance unchanged after lost claim list");

  // Whole pool: 50% + 100% together, title granted once.
  recordUpTo(pool.size);
  const c2 = sb.claimCollectionRewards();
  check(c2.claimed.filter((m) => m.group === LEEDS).length === 2, "50% and 100% claimed together");
  check(c2.cosmetics.includes("title-collector-leeds-rhinos"), "100% grants the Leeds title");
  check(store.ownsCosmetic("title-collector-leeds-rhinos"), "title owned in the cosmetics store");
  check(store.getCosmetics().equipped.title === "title-collector-leeds-rhinos", "title goes on when no title is worn");
  check(funds.getClubFundsBalance() >= start + 100_000 + 250_000 + 1_000_000, "all three tiers paid");

  // Cosmetics wiped (e.g. new device before the cosmetics sync): the backfill re-grants the title.
  storage.removeItem(STORAGE_KEYS.cosmeticsStore);
  check(!store.ownsCosmetic("title-collector-leeds-rhinos"), "title gone with the cosmetics store");
  check(sb.syncCollectionCosmetics().includes("title-collector-leeds-rhinos"), "backfill re-grants a claimed title");
  check(sb.syncCollectionCosmetics().length === 0, "backfill is idempotent");

  // ---------------------------------------------------------------- old books
  const old = { v: 1, cards: { [all[0].id]: { name: all[0].name, club: all[0].club, year: all[0].year, firstAt: 1, source: "classic", times: 1 } }, claimed: ["total-50"], runs: ["r"] };
  const migrated = sb.normalizeSquadBook(old);
  check(migrated.dreamTeam.length === 13 && migrated.dreamTeam.every((id) => id === null), "pre-v1.66 book loads with an empty Dream Team");
  check(migrated.dreamTeamAt === 0 && Object.keys(migrated.cards).length === 1 && migrated.claimed[0] === "total-50", "old cards and claims kept");
  const junk = sb.normalizeSquadBook({ ...old, dreamTeam: [5, "a", "a", null, {}, ...Array(20).fill("z")], dreamTeamAt: "x" });
  check(junk.dreamTeam.length === 13 && junk.dreamTeam[1] === "a" && junk.dreamTeam[2] === null && junk.dreamTeam[0] === null, "junk Dream Team cleaned, duplicates dropped");
  check(junk.dreamTeamAt === 0, "junk timestamp dropped");
  check(sb.normalizeSquadBook({ dreamTeam: "nope" }).dreamTeam.length === 13, "string Dream Team ignored");

  // ---------------------------------------------------------------- Dream Team
  const book = sb.getSquadBook();
  const fbIdx = sb.DREAM_TEAM_SLOTS.findIndex((s) => s.position === "FULLBACK");
  const fbs = sb.dreamTeamCandidates(book, catalog, fbIdx);
  check(fbs.length > 0 && fbs.every((c) => c.positions.includes("FULLBACK") && book.cards[c.id]), "fullback candidates are collected fullbacks");
  check(fbs.every((c, i) => i === 0 || fbs[i - 1].rating >= c.rating), "candidates sorted best first");
  const notCollected = all.find((p) => !book.cards[p.id])!;
  check(sb.setDreamTeamSlotPure(book, 0, notCollected.id) === book, "can't pick a card you haven't collected");
  check(sb.setDreamTeamSlotPure(book, 13, fbs[0].id) === book, "slot 14 doesn't exist");
  const t1 = sb.setDreamTeamSlotPure(book, 0, fbs[0].id, 100);
  check(t1.dreamTeam[0] === fbs[0].id && t1.dreamTeamAt === 100, "pick saved with its time");
  const t2 = sb.setDreamTeamSlotPure(t1, 5, fbs[0].id, 200);
  check(t2.dreamTeam[0] === null && t2.dreamTeam[5] === fbs[0].id, "same card can't sit in two slots (it moves)");
  const t3 = sb.setDreamTeamSlotPure(t2, 5, null, 300);
  check(t3.dreamTeam.every((id) => id === null), "null empties the slot");
  check(sb.mergeSquadBookStates(t1, t2).dreamTeam[5] === fbs[0].id, "merge: newer Dream Team wins");
  check(sb.mergeSquadBookStates(t2, t1).dreamTeam[5] === fbs[0].id, "merge: newer wins whichever side");
  check(sb.mergeSquadBookStates(t1, sb.emptySquadBook()).dreamTeam[0] === fbs[0].id, "merge with a book that never picked keeps the team");

  sb.setDreamTeamSlot(fbIdx, fbs[0].id);
  check(sb.getSquadBook().dreamTeam[fbIdx] === fbs[0].id, "setDreamTeamSlot saves locally");
  const added = sb.recordSquadBookRun({ runId: "after-dream", mode: "CLASSIC", squad: all.filter((p) => !sb.getSquadBook().cards[p.id]).slice(0, 3).map(slot) });
  check(added.newIds.length === 3 && sb.getSquadBook().dreamTeam[fbIdx] === fbs[0].id, "recording a season keeps the Dream Team");

  // Cloud: signed in, a newer team from another device comes down on login; uploads carry it.
  auth.setAuthCache("user-dt", "Coach", "c@example.com");
  const other = sb.setDreamTeamSlotPure(sb.normalizeSquadBook(cloudBook ?? sb.getSquadBook()), 0, fbs[fbs.length - 1].id, Date.now() + 60_000);
  cloudBook = { ...other, cards: { ...sb.getSquadBook().cards } };
  await sb.mergeSquadBookFromCloud();
  await flush();
  check(sb.getSquadBook().dreamTeam[0] === fbs[fbs.length - 1].id, "login merge brings down the newer Dream Team");
  sb.clearDreamTeam();
  await flush();
  check(sb.normalizeSquadBook(cloudBook).dreamTeam.every((id) => id === null), "clearing the team uploads (newest wins)");

  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
