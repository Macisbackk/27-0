/**
 * Store + login welcome tests: starter rung / nextStoreUnlock edges, grantCosmetic and purchase
 * idempotence, the once-per-account login welcome, and the cosmetics cloud merge refusing to
 * overwrite the account's cloud copy when the cloud read fails.
 * Run: bun scripts/test-store.ts   (bun only: it mocks the Supabase client module)
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

// A fake Supabase client (bun's module mock): reads of user_stats fail while `cloudDown`,
// writes are recorded. (node_modules may hold a throwing stub of supabase-js, so don't use it.)
import { mock } from "bun:test";
let cloudDown = false;
let cloudCosmetics: unknown = null;
const writes: { table: string; row: unknown }[] = [];
function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () =>
      cloudDown
        ? { data: null, error: { message: "upstream timeout", code: "57014" } }
        : { data: table === "user_stats" && cloudCosmetics ? { stat_json: cloudCosmetics } : null, error: null },
    upsert: async (row: unknown) => { writes.push({ table, row }); return { error: null }; },
    update: (row: unknown) => { writes.push({ table, row }); return { eq: async () => ({ error: null }) }; },
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
  const cos = await import("../src/lib/cosmetics");
  const store = await import("../src/lib/storage/cosmetics-store");
  const funds = await import("../src/lib/storage/club-funds");
  const welcome = await import("../src/lib/storage/login-welcome");
  const auth = await import("../src/lib/auth-session");
  const flush = () => new Promise((r) => setTimeout(r, 20));

  // ---------------------------------------------------------------- nextStoreUnlock
  const cheapest = Math.min(...cos.COSMETICS.filter((c) => !c.notForSale).map((c) => c.price));
  const starters = cos.COSMETICS.filter((c) => c.tier === "starter");
  check(starters.length > 0 && starters.every((c) => c.price >= 150_000 && c.price <= 450_000), "starter rung is £150k–£450k");
  check(cos.nextStoreUnlock(0)?.price === cheapest && cos.nextStoreUnlock(0)?.remaining === cheapest, "empty wallet: cheapest item, full price remaining");
  check(cos.nextStoreUnlock(-500)?.remaining === cheapest, "negative balance treated as 0");
  check(cos.nextStoreUnlock(cheapest)?.remaining === 0, "exact balance: affordable");
  check(cos.nextStoreUnlock(cheapest - 1)?.remaining === 1, "£1 short");
  check(cos.nextStoreUnlock(1e12)?.remaining === 0, "huge balance");
  check(cos.COSMETICS.filter((c) => c.notForSale).every((c) => c.id === cos.BALL_KNOWER_ID), "only Ball Knower is earned, not sold");
  check(cos.nextStoreUnlock(1000, cos.COSMETICS.map((c) => c.id)) === null, "everything owned: no next unlock");
  check(cos.nextStoreUnlock(0, ["title-rookie"])?.id === "title-ball-boy", "owned starter drops out, tie keeps catalogue order");
  const allButOne = cos.COSMETICS.filter((c) => c.id !== "title-27-0-legend").map((c) => c.id);
  check(cos.nextStoreUnlock(0, allButOne)?.id === "title-27-0-legend", "only the dearest left");
  check(cos.cosmeticsOfKind("title")[0]?.tier === "starter", "starter items listed first");
  check(new Set(cos.COSMETICS.map((c) => c.id)).size === cos.COSMETICS.length, "unique cosmetic ids");

  // ---------------------------------------------------------------- grant / purchase
  storage.clear();
  check(store.grantCosmetic(cos.CHALK_FRAME_ID) === true, "grant adds chalk frame");
  check(store.grantCosmetic(cos.CHALK_FRAME_ID) === false, "second grant is a no-op");
  check(store.getCosmetics().owned.filter((id) => id === cos.CHALK_FRAME_ID).length === 1, "owned once");
  check(store.getCosmetics().equipped.frame === cos.CHALK_FRAME_ID, "granted frame equipped into empty slot");
  check(store.grantCosmetic("not-a-thing") === false, "unknown id refused");
  const bal0 = funds.getClubFundsBalance();
  const buy = store.purchaseCosmetic(cos.CHALK_FRAME_ID);
  check(!buy.success && buy.reason === "owned" && funds.getClubFundsBalance() === bal0, "buying a granted item charges nothing");
  funds.setClubFundsBalance(225_000);
  const r1 = store.purchaseCosmetic("pitch-training");
  const r2 = store.purchaseCosmetic("pitch-training");
  check(r1.success && funds.getClubFundsBalance() === 0 && !r2.success, "exact-balance purchase once");
  check(!store.purchaseCosmetic("title-rookie").success, "can't buy at £0");

  // ---------------------------------------------------------------- login welcome
  storage.clear();
  auth.setAuthCache("user-1", "Coach", "c@example.com");
  const startBal = funds.getClubFundsBalance();
  const w1 = welcome.grantLoginWelcome();
  const w2 = welcome.grantLoginWelcome();
  check(w1 !== null && w2 === null, "welcome pays once");
  check(funds.getClubFundsBalance() === startBal + welcome.LOGIN_WELCOME_AMOUNT, "welcome £100k exactly once");
  check(store.ownsCosmetic(cos.CHALK_FRAME_ID), "welcome grants chalk");
  // Second device: ledger synced, cosmetics row not yet → frame regranted, no cash.
  const ledger = [...funds.getPaidRunIds()];
  const b = funds.getClubFundsBalance();
  storage.clear();
  funds.mergeClubFundsFromCloud({ balance: b, totalEarned: b, paidRunIds: ledger });
  check(welcome.grantLoginWelcome() === null && funds.getClubFundsBalance() === b, "second device: no second payout");
  check(store.ownsCosmetic(cos.CHALK_FRAME_ID), "second device: frame owned");
  // Both devices paid before syncing: merge collapses to one payment.
  storage.clear();
  welcome.grantLoginWelcome();
  const devA = { balance: funds.getClubFundsBalance(), totalEarned: funds.getClubFundsTotalEarned(), paidRunIds: [...funds.getPaidRunIds()] };
  funds.mergeClubFundsFromCloud(devA);
  check(funds.getClubFundsTotalEarned() === devA.totalEarned, "simultaneous first logins don't stack");

  // ---------------------------------------------------------------- cosmetics cloud merge
  await flush();
  storage.clear();
  cloudCosmetics = { owned: ["frame-gold", "title-rookie"], purchaseIds: ["cosmetic-frame-gold"], equipped: { frame: "frame-gold" } };
  writes.length = 0;
  cloudDown = true;
  let rejected = false;
  try { await store.mergeCosmeticsFromCloud(); } catch { rejected = true; }
  await flush();
  check(rejected, "failed cloud read rejects (so the login welcome waits)");
  check(!writes.some((w) => JSON.stringify(w.row).includes("cosmetics_store")), "failed cloud read never uploads the local (empty) store over the cloud copy");
  cloudDown = false;
  await store.mergeCosmeticsFromCloud();
  await flush();
  const merged = store.getCosmetics();
  check(merged.owned.includes("frame-gold") && merged.owned.includes("title-rookie"), "good read merges cloud items in");
  check(merged.equipped.frame === "frame-gold", "cloud equipped choice wins");
  const m = store.mergeCosmeticsStates({ owned: ["pitch-dusk"], equipped: { pitch: "pitch-dusk" } }, { owned: ["frame-gold"] });
  check(m.owned.length === 2 && m.equipped.pitch === "pitch-dusk", "merge is a union and keeps local equips");

  if (failures > 0) {
    console.error(`\n${failures} of ${checks} checks failed.`);
    process.exit(1);
  }
  console.log(`Store: all ${checks} checks passed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
