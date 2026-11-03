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
  check(starters.length > 0 && starters.every((c) => c.price >= 50_000 && c.price <= 300_000), "starter rung is £50k–£300k");
  // v1.66 ladder: every kind for sale has something in the starter rung, and day one is affordable.
  for (const kind of ["kit", "pitch", "title", "frame"] as const) {
    check(cos.COSMETICS.some((c) => c.kind === kind && c.tier === "starter" && !c.notForSale), `starter ${kind} exists`);
  }
  check(cos.COSMETICS.filter((c) => !c.notForSale).every((c) => c.price > 0), "every item for sale has a price");
  const themes = await import("../src/lib/ui-themes");
  const themePrices = themes.STYLE_UI_THEMES.map((t) => themes.uiThemePrice(t.id));
  check(themePrices.every((p) => p >= 500_000 && p <= 4_000_000), "themes £500k–£4m");
  check(Math.min(...themePrices) <= 1_000_000, "a theme within £1m");
  check(themes.sortUiThemesForStore(themes.UI_THEMES, ["default"])[1]?.id === "steel", "locked themes cheapest first");
  check(cos.nextStoreUnlock(0)?.price === cheapest && cos.nextStoreUnlock(0)?.remaining === cheapest, "empty wallet: cheapest item, full price remaining");
  check(cos.nextStoreUnlock(-500)?.remaining === cheapest, "negative balance treated as 0");
  check(cos.nextStoreUnlock(cheapest)?.remaining === 0, "exact balance: affordable");
  check(cos.nextStoreUnlock(cheapest - 1)?.remaining === 1, "£1 short");
  check(cos.nextStoreUnlock(1e12)?.remaining === 0, "huge balance");
  const earnedModes = [cos.BALL_KNOWER_ID, cos.ONE_CLUB_MODE_ID, cos.GAUNTLET_MODE_ID, cos.PAST_DAILIES_MODE_ID];
  const earnedKits = [cos.KIT_PERFECT_ID, cos.KIT_29_0_ID, cos.KIT_STREAK_30_ID, cos.KIT_STREAK_100_ID, cos.KIT_MANAGER_GF_ID];
  check(
    cos.COSMETICS.filter((c) => c.notForSale).every((c) => (earnedModes.includes(c.id) && c.kind === "mode") || (earnedKits.includes(c.id) && c.kind === "kit")),
    "only the More modes and achievement kits are earned, not sold"
  );
  check(earnedKits.every((id) => cos.cosmeticById(id)?.notForSale === true && cos.isKitPreset(id)), "every achievement kit is a notForSale preset");
  check(cos.COSMETICS.filter((c) => c.kind === "kit" && c.id !== cos.KIT_DESIGNER_ID).every((c) => cos.isKitPreset(c.id)), "every ready-made kit has a shirt");
  check(!cos.cosmeticsOfKind("kit").some((c) => c.notForSale), "earned kits never listed for sale");
  check(earnedModes.every((id) => cos.cosmeticById(id)?.notForSale === true), "every More mode is a notForSale item");
  check(cos.COSMETICS.filter((c) => c.kind === "mode").every((c) => c.notForSale), "no mode is for sale");
  check(cos.nextStoreUnlock(1000, cos.COSMETICS.map((c) => c.id)) === null, "everything owned: no next unlock");
  check(cos.nextStoreUnlock(0)?.id === "pitch-park", "cheapest first, catalogue order on a tie");
  check(cos.nextStoreUnlock(0, ["pitch-park"])?.id === "title-mascot", "owned starter drops out, tie keeps catalogue order");
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
  funds.setClubFundsBalance(cos.cosmeticById("pitch-training")!.price);
  const r1 = store.purchaseCosmetic("pitch-training");
  const r2 = store.purchaseCosmetic("pitch-training");
  check(r1.success && funds.getClubFundsBalance() === 0 && !r2.success, "exact-balance purchase once");
  check(!store.purchaseCosmetic("title-rookie").success, "can't buy at £0");
  check(!store.purchaseCosmetic(cos.KIT_PERFECT_ID).success, "an achievement kit can't be bought");

  // ---------------------------------------------------------------- ready-made kits
  storage.clear();
  funds.setClubFundsBalance(10_000_000);
  check(store.purchaseCosmetic("kit-blue-hoops").success, "buy a ready-made kit");
  check(store.getCosmetics().equipped.kit === "kit-blue-hoops", "bought kit goes straight on");
  check(store.purchaseCosmetic(cos.KIT_DESIGNER_ID).success, "buy the kit designer");
  let st = store.getCosmetics();
  check(st.kit.enabled && st.equipped.kit === null, "designer on takes the ready-made kit off");
  store.equipCosmetic("kit", "kit-blue-hoops");
  st = store.getCosmetics();
  check(st.equipped.kit === "kit-blue-hoops" && !st.kit.enabled, "wearing a ready-made kit switches the designer off");
  store.equipCosmetic("kit", cos.KIT_DESIGNER_ID);
  check(store.getCosmetics().equipped.kit === "kit-blue-hoops", "the designer is not a ready-made kit slot");
  store.equipCosmetic("kit", "kit-retro-v");
  check(store.getCosmetics().equipped.kit === "kit-blue-hoops", "can't wear a kit you don't own");
  storage.setItem("27-0-cosmetics-store", JSON.stringify({ owned: ["kit-designer"], equipped: { kit: "kit-designer" }, kit: { enabled: true } }));
  check(store.getCosmetics().equipped.kit === null && store.getCosmetics().kit.enabled, "tampered kit slot ignored");

  // ---------------------------------------------------------------- achievement kits
  const ak = await import("../src/lib/achievement-kits");
  const none = { achievements: [], bestDailyStreak: 0, owned: [] };
  check(ak.earnedAchievementKitIds(none).length === 0, "no feats: no kits");
  check(ak.earnedAchievementKitIds({ ...none, achievements: ["perfect-season"] }).includes(cos.KIT_PERFECT_ID), "27-0 earns the Invincibles kit");
  check(ak.earnedAchievementKitIds({ ...none, owned: [cos.BALL_KNOWER_ID] }).includes(cos.KIT_PERFECT_ID), "Ball Knower owned (a past 27-0) earns it too");
  check(ak.earnedAchievementKitIds({ ...none, achievements: ["29-0"] }).includes(cos.KIT_29_0_ID), "29-0 earns its kit");
  check(ak.earnedAchievementKitIds({ ...none, achievements: ["manager-old-trafford"] }).includes(cos.KIT_MANAGER_GF_ID), "Manager Grand Final earns its kit");
  const streak = (n: number) => ak.earnedAchievementKitIds({ ...none, bestDailyStreak: n });
  check(!streak(29).includes(cos.KIT_STREAK_30_ID) && streak(30).includes(cos.KIT_STREAK_30_ID), "30-day streak kit at 30");
  check(!streak(99).includes(cos.KIT_STREAK_100_ID) && streak(100).includes(cos.KIT_STREAK_100_ID), "100-day streak kit at 100");
  check(ak.ACHIEVEMENT_KITS.every((k) => k.earn.length > 0 && cos.cosmeticById(k.id)), "every achievement kit has earn text and a catalogue item");
  storage.clear();
  storage.setItem("27-0-daily-challenge-meta", JSON.stringify({ currentStreak: 3, bestStreak: 31 }));
  const g1 = ak.syncAchievementKits();
  check(g1.includes(cos.KIT_STREAK_30_ID) && !g1.includes(cos.KIT_STREAK_100_ID), "sync grants the 30-day kit from the Daily meta");
  check(ak.syncAchievementKits().length === 0, "sync is idempotent");
  check(store.getCosmetics().equipped.kit === cos.KIT_STREAK_30_ID, "earned kit goes on when no shirt is worn");
  const bal1 = funds.getClubFundsBalance();
  check(!store.purchaseCosmetic(cos.KIT_STREAK_30_ID).success && funds.getClubFundsBalance() === bal1, "earned kit costs nothing");

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
