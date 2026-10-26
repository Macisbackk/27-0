/**
 * Squad Book tests: recording a finished season, dedupe (same card / same run), hidden and
 * non-Classic runs ignored, milestones paying Club Funds exactly once, the union merge never
 * losing a card or a claim, and the cloud merge refusing to touch anything when the read fails.
 * Run: bun scripts/test-squad-book.ts   (bun only: it mocks the Supabase client module)
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
let cloudDown = false;
let cloudBook: unknown = null;
const writes: { table: string; row: Record<string, unknown> }[] = [];
function query(table: string) {
  let key = "";
  const q = {
    select: () => q,
    eq: (col: string, val: string) => { if (col === "stat_key") key = val; return q; },
    maybeSingle: async () =>
      cloudDown
        ? { data: null, error: { message: "upstream timeout", code: "57014" } }
        : { data: table === "user_stats" && key === "squad_book" && cloudBook ? { stat_json: cloudBook } : null, error: null },
    upsert: async (row: Record<string, unknown>) => {
      writes.push({ table, row });
      if (row.stat_key === "squad_book") cloudBook = JSON.parse(JSON.stringify(row.stat_json));
      return { error: null };
    },
    update: (row: Record<string, unknown>) => { writes.push({ table, row }); return { eq: async () => ({ error: null }) }; },
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
  const funds = await import("../src/lib/storage/club-funds");
  const auth = await import("../src/lib/auth-session");
  const owner = await import("../src/lib/storage/account-owner");
  const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
  const players = await import("../src/lib/players");
  const flush = () => new Promise((r) => setTimeout(r, 20));

  const catalog = sb.getSquadBookCatalog();
  const all = players.getRecruitablePlayers();
  check(catalog.cards.length > 1000, "catalogue holds the recruitable cards");
  check(catalog.clubs.length >= 10, "catalogue has the clubs");
  check(catalog.decades.join(",") === "1990,2000,2010,2020", `decades 1990s-2020s (got ${catalog.decades.join(",")})`);
  check(catalog.sets.some((s) => s.id === "men-of-steel" && s.ids.size > 0), "Man of Steel set built from the honours data");
  check(catalog.sets.some((s) => s.id === "legends" && s.ids.size > 0), "Legends set built");
  check(new Set(catalog.milestones.map((m) => m.id)).size === catalog.milestones.length, "milestone ids unique");
  check(owner.ACCOUNT_STORAGE_KEYS.includes(STORAGE_KEYS.squadBook), "squad book is per account");
  check(funds.trimPaidRunIds(["squadbook:total-50", ...Array.from({ length: 400 }, (_, i) => `run-${i}`)]).includes("squadbook:total-50"),
    "ledger trim keeps squad book ids forever");

  // Same player, current card vs era card: two separate entries.
  const sinfield = all.filter((p) => p.name === "Kevin Sinfield");
  check(sinfield.length >= 2, "Kevin Sinfield has several year cards");

  const leeds = all.filter((p) => p.club === "Leeds Rhinos");
  const slot = (p: (typeof all)[number]) => ({ position: p.position, slotIndex: 0, label: "", player: p });

  // --- pure recording / dedupe
  let st = sb.emptySquadBook();
  const r1 = sb.addRunToSquadBook(st, "run-a", [...sinfield.slice(0, 2), sinfield[0]].map((p) => ({ id: p.id, name: p.name, club: p.club, year: p.year })), "era", 1000);
  check(r1.newIds.length === 2, "duplicate card in one squad counted once");
  check(Object.keys(r1.state.cards).length === 2, "two Sinfield year cards are two entries");
  const r2 = sb.addRunToSquadBook(r1.state, "run-a", [{ id: "x", name: "X", club: "Leeds Rhinos" }], "classic", 2000);
  check(r2.newIds.length === 0 && !r2.state.cards.x, "same run id recorded only once");
  const r3 = sb.addRunToSquadBook(r1.state, "run-b", [{ id: sinfield[0].id, name: "K", club: "Leeds Rhinos" }], "classic", 3000);
  check(r3.newIds.length === 0 && r3.state.cards[sinfield[0].id].times === 2, "card fielded again bumps times, not count");
  check(r3.state.cards[sinfield[0].id].source === "era" && r3.state.cards[sinfield[0].id].firstAt === 1000, "first-fielded mode/time kept");

  // --- merge never loses entries
  const a = sb.addRunToSquadBook(sb.emptySquadBook(), "a", leeds.slice(0, 5).map((p) => ({ id: p.id, name: p.name, club: p.club, year: p.year })), "classic", 10).state;
  a.claimed = ["total-50"];
  const b = sb.addRunToSquadBook(sb.emptySquadBook(), "b", leeds.slice(3, 9).map((p) => ({ id: p.id, name: p.name, club: p.club, year: p.year })), "era", 5).state;
  b.claimed = ["club-leeds-rhinos-10"];
  const m = sb.mergeSquadBookStates(a, b);
  check(Object.keys(m.cards).length === 9, `union has all 9 cards (got ${Object.keys(m.cards).length})`);
  check(m.claimed.includes("total-50") && m.claimed.includes("club-leeds-rhinos-10"), "union keeps both claim lists");
  check(m.cards[leeds[3].id].firstAt === 5 && m.cards[leeds[3].id].source === "era", "overlap keeps the earliest entry");
  check(Object.keys(sb.mergeSquadBookStates(m, null).cards).length === 9, "merge with an empty cloud keeps everything");
  check(Object.keys(sb.mergeSquadBookStates(null, m).cards).length === 9, "merge into an empty local keeps everything");
  check(Object.keys(sb.mergeSquadBookStates(m, { cards: "garbage", claimed: 5 }).cards).length === 9, "malformed cloud row loses nothing");

  // --- live recording through recordSquadBookRun (guest), milestones pay once
  const startBalance = funds.getClubFundsBalance();
  const hidden = sb.recordSquadBookRun({ runId: "hidden-1", mode: "CLASSIC", squad: leeds.slice(0, 17).map(slot), hidden: true });
  check(hidden.newIds.length === 0 && Object.keys(sb.getSquadBook().cards).length === 0, "Joe Mellor / Sam Hallas runs don't count");
  sb.recordSquadBookRun({ runId: "draft-1", mode: "DRAFT", squad: leeds.slice(0, 17).map(slot) });
  check(Object.keys(sb.getSquadBook().cards).length === 0, "Draft runs don't count");

  const first = sb.recordSquadBookRun({ runId: "run-1", mode: "CLASSIC", squad: leeds.slice(0, 17).map(slot) });
  check(first.newIds.length === 17, `17 new cards (got ${first.newIds.length})`);
  check(first.paid.some((l) => l.id === "squadbook-club-leeds-rhinos-10"), "Leeds 10-card milestone paid");
  const paidTotal = first.paid.reduce((s, l) => s + l.amount, 0);
  check(funds.getClubFundsBalance() === startBalance + paidTotal && paidTotal >= 10_000, "Club Funds credited");
  check(funds.getPaidRunIds().includes("squadbook:club-leeds-rhinos-10"), "ledger id squadbook:<milestone>");

  const again = sb.recordSquadBookRun({ runId: "run-1", mode: "CLASSIC", squad: leeds.slice(0, 17).map(slot) });
  check(again.newIds.length === 0 && again.paid.length === 0, "same run recorded twice: no-op");
  const sameCards = sb.recordSquadBookRun({ runId: "run-2", mode: "CLASSIC", squad: leeds.slice(0, 17).map(slot), daily: true });
  check(sameCards.newIds.length === 0 && sameCards.paid.length === 0, "same cards in a new run: nothing new, nothing paid");
  check(funds.getClubFundsBalance() === startBalance + paidTotal, "balance unchanged after repeats");

  // Claim list lost (e.g. old device copy) — the ledger still refuses a second payout.
  const lost = sb.getSquadBook();
  lost.claimed = [];
  storage.setItem(STORAGE_KEYS.squadBook, JSON.stringify(lost));
  const reclaimed = sb.claimSquadBookMilestones();
  check(reclaimed.length === 0, "lost claim list: ledger blocks a repeat payout");
  check(funds.getClubFundsBalance() === startBalance + paidTotal, "balance unchanged after lost claim list");
  check(sb.getSquadBook().claimed.includes("club-leeds-rhinos-10"), "claim list repaired");

  // Era run with the Sinfield cards adds separate entries.
  const era = sb.recordSquadBookRun({ runId: "run-3", mode: "CLASSIC", squad: sinfield.map(slot), era: true });
  check(era.newIds.length === sinfield.filter((p) => !leeds.slice(0, 17).some((l) => l.id === p.id)).length, "era cards recorded separately");

  // Total-50 milestone after enough distinct cards.
  const others = all.filter((p) => !sb.getSquadBook().cards[p.id]).slice(0, 40);
  const big = sb.recordSquadBookRun({ runId: "run-4", mode: "CLASSIC", squad: others.map(slot), weekly: true });
  check(big.paid.some((l) => l.id === "squadbook-total-50"), "50-card milestone paid");
  const progress = sb.computeSquadBookProgress(sb.getSquadBook(), catalog);
  check(progress.total >= 50, "progress counts the book");
  check((progress.byClub.get("Leeds Rhinos")?.have ?? 0) >= 17, "club progress counted");

  // --- cloud: signed in, failed read leaves both copies alone
  auth.setAuthCache("user-1", "Coach", "c@example.com");
  const localBefore = storage.getItem(STORAGE_KEYS.squadBook);
  cloudDown = true;
  writes.length = 0;
  let rejected = false;
  try { await sb.mergeSquadBookFromCloud(); } catch { rejected = true; }
  check(rejected, "merge rejects when the cloud read fails");
  check(storage.getItem(STORAGE_KEYS.squadBook) === localBefore, "failed read leaves local untouched");
  check(!writes.some((w) => w.row.stat_key === "squad_book"), "failed read uploads nothing");

  // A record while the cloud is down saves locally but never uploads a partial copy.
  sb.recordSquadBookRun({ runId: "run-5", mode: "CLASSIC", squad: all.filter((p) => !sb.getSquadBook().cards[p.id]).slice(0, 3).map(slot) });
  await flush();
  check(!writes.some((w) => w.row.stat_key === "squad_book"), "upload skipped while cloud read fails");

  // Cloud holds cards this device never saw: merge unions and uploads.
  cloudDown = false;
  const cloudOnly = all.filter((p) => !sb.getSquadBook().cards[p.id]).slice(0, 4);
  cloudBook = sb.addRunToSquadBook(sb.emptySquadBook(), "other-device", cloudOnly.map((p) => ({ id: p.id, name: p.name, club: p.club, year: p.year })), "classic", 1).state;
  (cloudBook as { claimed: string[] }).claimed = ["decade-1990-25"];
  const localCount = Object.keys(sb.getSquadBook().cards).length;
  await sb.mergeSquadBookFromCloud();
  await flush();
  const merged = sb.getSquadBook();
  check(Object.keys(merged.cards).length === localCount + 4, "login merge adds the cloud cards");
  check(merged.claimed.includes("decade-1990-25") && merged.claimed.includes("total-50"), "login merge unions claims");
  const cloudAfter = sb.normalizeSquadBook(cloudBook);
  check(Object.keys(cloudAfter.cards).length === localCount + 4, "union uploaded to the cloud");

  // Upload is read-merge-write: a stale smaller local copy can't shrink the cloud book.
  const small = sb.addRunToSquadBook(sb.emptySquadBook(), "fresh", [], "classic").state;
  storage.setItem(STORAGE_KEYS.squadBook, JSON.stringify(small));
  sb.recordSquadBookRun({ runId: "run-6", mode: "CLASSIC", squad: all.filter((p) => !cloudAfter.cards[p.id]).slice(0, 2).map(slot) });
  await flush();
  check(Object.keys(sb.normalizeSquadBook(cloudBook).cards).length === localCount + 6, "cloud keeps every card after a small device uploads");

  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
