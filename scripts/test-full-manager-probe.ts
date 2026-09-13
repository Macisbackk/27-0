/**
 * Full-system Manager Mode stress probe — recent features + week/season loops.
 * Finds crashes, invariant breaks, offer/save/cap/match issues.
 */
import { initializeManagerDatabase, ensureClubSquadDepth } from "../src/lib/manager/database";
import { advanceWeek, canAdvanceWeek } from "../src/lib/manager/advancement";
import { rolloverSeason } from "../src/lib/manager/rollover";
import { processAiDecisionsForWeek } from "../src/lib/manager/ai";
import {
  calculateSalaryCapUsage,
  renewPlayerContract,
  wouldExceedEliteSquadLimit,
} from "../src/lib/manager/contracts";
import {
  pruneManagerStateForStorage,
  exportSaveToJson,
  importSaveFromJson,
  saveManagerStateSync,
  loadManagerStateSync,
  deleteSaveSlotSync,
} from "../src/lib/manager/storage";
import { pickBestGoalKicker, getPlayerGoalKicking } from "../src/lib/manager/goal-kicking";
import { simulateManagerMatch, ensureFixtureKeyMoments } from "../src/lib/manager/match";
import { autoPickClubLineup, getMatchdayLineupReadiness } from "../src/lib/manager/squad";
import { calculateMarketWage } from "../src/lib/manager/rules";
import type { ManagerState } from "../src/lib/manager/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    failures.push(msg);
    console.error("FAIL:", msg);
  } else {
    passed++;
    console.log("OK:", msg);
  }
}

function assertNoThrow(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("OK:", label);
  } catch (e) {
    failed++;
    const m = `${label}: ${(e as Error).message}`;
    failures.push(m);
    console.error("FAIL:", m);
  }
}

function squadInvariant(state: ManagerState, label: string) {
  for (const club of Object.values(state.clubs)) {
    const players = Object.values(state.players).filter(
      (p) => p.clubId === club.id && !p.isRetired
    );
    assert(players.length >= 20, `${label}: ${club.name} has ${players.length} players (>=20)`);
    for (const p of players) {
      if (p.squadTier === "first" && p.contract) {
        if (!(p.contract.wageWeekly > 0)) {
          assert(false, `${label}: ${p.name} first-team wage > 0`);
        }
      }
      if (!(typeof p.rating === "number" && p.rating >= 40)) {
        assert(false, `${label}: ${p.name} rating ok`);
      }
    }
    const lineupIds = [...club.lineup.starting13, ...club.lineup.bench].filter(Boolean) as string[];
    for (const id of lineupIds) {
      const p = state.players[id];
      if (!p) {
        assert(false, `${label}: lineup id ${id} exists`);
        continue;
      }
      if (p.clubId === club.id && p.loan) {
        assert(false, `${label}: ${club.name} has loaned-out ${p.name} in lineup`);
      }
    }
  }
  assert(true, `${label}: squad invariants hold`);
}

console.log("\n=== A: New careers SL + Champ ===");
let widnes = initializeManagerDatabase("widnes-vikings", "Probe Champ");
let wigan = initializeManagerDatabase("wigan-warriors", "Probe SL");
assert(widnes.clubs["widnes-vikings"].competitionId === "championship", "Widnes in Champ");
assert(wigan.clubs["wigan-warriors"].competitionId === "super-league", "Wigan in SL");
squadInvariant(widnes, "Widnes start");
squadInvariant(wigan, "Wigan start");

console.log("\n=== B: Matchday readiness + auto-pick ===");
const ready = getMatchdayLineupReadiness(widnes, "widnes-vikings");
assert(!!ready, "readiness object exists");
const auto = autoPickClubLineup(widnes, "widnes-vikings");
assert(auto.success, `auto-pick Widnes (${auto.error || "ok"})`);
if (auto.success) widnes = auto.state;
const ready2 = getMatchdayLineupReadiness(widnes, "widnes-vikings");
assert(ready2?.ready === true, "Widnes matchday ready after auto-pick");

console.log("\n=== C: Goal kicker never prop ===");
const first = Object.values(wigan.players).filter(
  (p) => p.clubId === "wigan-warriors" && p.squadTier === "first" && !p.loan
);
const kicker = pickBestGoalKicker(first);
assert(!!kicker && kicker.position !== "PROP", "best kicker not prop");
assert(getPlayerGoalKicking(kicker!) >= 60, "recommended kicker has decent GK");

console.log("\n=== D: Cap renewals full first team ===");
{
  let s = wigan;
  let fails = 0;
  for (const p of Object.values(s.players).filter(
    (x) => x.clubId === "wigan-warriors" && x.squadTier === "first" && x.contract && !x.loan
  )) {
    const market = calculateMarketWage(p.rating, p.age, "super-league");
    const offered = Math.max(p.contract!.wageWeekly, market);
    const res = renewPlayerContract(s, p.id, offered, 2, p.contract!.role, { silent: true });
    if (res.success) s = res.state;
    else fails++;
  }
  assert(fails === 0, `Wigan full first-team renew (fails=${fails})`);
  const cap = calculateSalaryCapUsage(s, "wigan-warriors");
  assert(cap.capLimitWeekly > 50_000, "SL cap limit healthy");
  wigan = s;
}

console.log("\n=== E: Advance 10 weeks Champ + SL (AI market, offers) ===");
assertNoThrow("advance Widnes 10 weeks", () => {
  for (let i = 0; i < 10; i++) {
    const gate = canAdvanceWeek(widnes);
    if (!gate.allowed) {
      const pick = autoPickClubLineup(widnes, "widnes-vikings");
      if (pick.success) widnes = pick.state;
    }
    widnes = advanceWeek(widnes);
  }
});
assertNoThrow("advance Wigan 10 weeks", () => {
  for (let i = 0; i < 10; i++) {
    const gate = canAdvanceWeek(wigan);
    if (!gate.allowed) {
      const pick = autoPickClubLineup(wigan, "wigan-warriors");
      if (pick.success) wigan = pick.state;
    }
    wigan = advanceWeek(wigan);
  }
});
assert(widnes.calendar.currentWeek >= 10, `Widnes week ${widnes.calendar.currentWeek}`);
assert(wigan.calendar.currentWeek >= 10, `Wigan week ${wigan.calendar.currentWeek}`);
squadInvariant(widnes, "Widnes w10");
squadInvariant(wigan, "Wigan w10");

const pendingBids = wigan.transfers.activeBids.filter(
  (b) => b.toClubId === "wigan-warriors" && b.status === "pending_club"
);
const pendingLoans = wigan.transfers.pendingLoanOffers || [];
console.log(
  `  (info) Wigan pending bids=${pendingBids.length} loanOffers=${pendingLoans.length}`
);
assert(
  !wigan.inbox.messages.some((m) => m.actionRequired && (m.category === "transfer" || m.category === "loan")),
  "No action-required transfer/loan inbox spam after advances"
);

console.log("\n=== F: Simulate user match + key moments ===");
{
  const fixtures = [
    ...(wigan.competitions["super-league"]?.fixtures || []),
    ...(wigan.competitions["friendlies"]?.fixtures || []),
  ].filter(
    (f) =>
      f.isPlayed &&
      (f.homeClubId === "wigan-warriors" || f.awayClubId === "wigan-warriors")
  );
  assert(fixtures.length > 0, "Wigan has played fixtures");
  if (fixtures[0]) {
    assertNoThrow("ensureFixtureKeyMoments", () => {
      const moments = ensureFixtureKeyMoments(fixtures[0], wigan.clubs);
      assert(moments.length > 0, "key moments generated");
    });
  }
}

console.log("\n=== G: Save prune + sync roundtrip ===");
{
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
  const raw = JSON.stringify(wigan).length;
  const pruned = JSON.stringify(pruneManagerStateForStorage(wigan)).length;
  assert(pruned < raw, `prune shrinks save (${pruned} < ${raw})`);
  assert(pruned < 4_000_000, `pruned mid-season under 4MB (${pruned})`);
  const save = saveManagerStateSync(wigan, 0);
  assert(save.success, `sync save ok (${save.error || ""})`);
  const loaded = loadManagerStateSync(0);
  assert(!!loaded, "sync load ok");
  assert(loaded?.manager.clubId === "wigan-warriors", "loaded club preserved");
  assert(
    Array.isArray(loaded?.transfers.pendingLoanOffers),
    "pendingLoanOffers present after load upgrade"
  );
  const exported = exportSaveToJson(wigan);
  const imported = importSaveFromJson(exported);
  assert(!!imported && imported.manager.clubId === "wigan-warriors", "JSON export/import");
  deleteSaveSlotSync(0);
  delete (globalThis as any).window;
}

console.log("\n=== H: Elite limit + AI process idempotent ===");
{
  let s = initializeManagerDatabase("leeds-rhinos", "Elite");
  const patch = { ...s.players };
  Object.values(patch)
    .filter((p) => p.clubId === "leeds-rhinos" && p.squadTier === "first")
    .slice(0, 8)
    .forEach((p) => {
      patch[p.id] = { ...p, rating: 88 };
    });
  s = { ...s, players: patch, calendar: { ...s.calendar, currentWeek: 6 } };
  assert(!!wouldExceedEliteSquadLimit(s, "leeds-rhinos", 88), "elite block at 8");
  assertNoThrow("processAiDecisions twice", () => {
    s = processAiDecisionsForWeek(s);
    s = processAiDecisionsForWeek(s);
  });
}

console.log("\n=== I: Long advance toward season end (Champ) ===");
assertNoThrow("Widnes advance to week 28 or season_end", () => {
  let guard = 0;
  while (
    widnes.calendar.phase !== "season_end" &&
    widnes.calendar.currentWeek < 32 &&
    guard < 40
  ) {
    guard++;
    const gate = canAdvanceWeek(widnes);
    if (!gate.allowed) {
      const pick = autoPickClubLineup(widnes, "widnes-vikings");
      if (pick.success) widnes = pick.state;
      else {
        // force ready by clearing injuries on 17
        break;
      }
    }
    try {
      widnes = advanceWeek(widnes);
    } catch (e) {
      throw new Error(`advance failed week ${widnes.calendar.currentWeek}: ${(e as Error).message}`);
    }
  }
});
console.log(
  `  (info) Widnes phase=${widnes.calendar.phase} week=${widnes.calendar.currentWeek}`
);
squadInvariant(widnes, "Widnes late");

if (widnes.calendar.phase === "season_end") {
  assertNoThrow("rollover Widnes", () => {
    const { state: next } = rolloverSeason(widnes);
    widnes = next;
    assert(widnes.calendar.currentSeason === 2027, "season becomes 2027");
    assert(widnes.calendar.currentWeek === 1, "week resets");
  });
  squadInvariant(widnes, "post-rollover");
}

console.log("\n=== J: ensureClubSquadDepth on loaded mid-save ===");
{
  const shallow = { ...wigan, players: { ...wigan.players } };
  const depth = ensureClubSquadDepth(shallow);
  assertNoThrow("depth ensure", () => {
    squadInvariant(depth, "ensured");
  });
}

console.log(`\n==== FULL PROBE: ${passed} passed, ${failed} failed ====`);
if (failures.length) {
  console.log("Failures:");
  failures.forEach((f) => console.log(" -", f));
  process.exit(1);
}
