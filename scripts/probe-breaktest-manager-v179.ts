/**
 * Break-test probe for Manager Mode v1.79 updates.
 * Run: npx tsx scripts/probe-breaktest-manager-v179.ts
 */

const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
};
(globalThis as any).crypto = require("crypto").webcrypto;
(globalThis as any).indexedDB = {
  open() {
    const r: any = {
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      error: new Error("no idb"),
    };
    queueMicrotask(() => r.onerror?.({}));
    return r;
  },
};

async function main() {
  const bugs: string[] = [];
  const ok: string[] = [];

  const { initializeManagerDatabase } = await import("../src/lib/manager/database");
  const {
    confirmFriendlyOpponents,
    needsFriendlySelection,
    autoPickFriendlyOpponents,
  } = await import("../src/lib/manager/competitions");
  const { canAdvanceWeek, advanceWeek } = await import("../src/lib/manager/advancement");
  const { renewAllSquadTierContracts } = await import("../src/lib/manager/contracts");
  const { saveManagerState, loadManagerState, persistManagerProgress } = await import(
    "../src/lib/manager/storage"
  );

  const state0 = initializeManagerDatabase("halifax-panthers", "BreakTest");

  // Instant sim default
  if (state0.settings.matchSimulationSpeed === "instant") ok.push("instant sim default");
  else bugs.push(`sim default is ${state0.settings.matchSimulationSpeed}, expected instant`);

  // Friendly picker pending
  if ((state0.pendingFriendlyOpponents || []).length === 6) ok.push("6 friendly choices");
  else bugs.push(`friendly choices=${state0.pendingFriendlyOpponents?.length}`);

  if (needsFriendlySelection(state0)) ok.push("needsFriendlySelection true");
  else bugs.push("needsFriendlySelection false at start");

  const gate = canAdvanceWeek(state0);
  if (!gate.allowed) ok.push(`advance blocked: ${gate.error}`);
  else bugs.push("advance allowed before friendlies selected");

  // Confirm friendlies
  const picked = (state0.pendingFriendlyOpponents || []).slice(0, 3);
  const conf = confirmFriendlyOpponents(state0, picked);
  if (!conf.success) bugs.push(`confirm friendlies failed: ${conf.error}`);
  else ok.push("confirm 3 friendlies");

  const fWeeks = conf.state.competitions.friendlies.fixtures.map((f) => f.week).sort();
  console.log("friendly_weeks", fWeeks.join(","));

  // Clash detection: user league games on same weeks as friendlies
  const uid = "halifax-panthers";
  const clashes = conf.state.competitions.championship.fixtures.filter(
    (f) =>
      fWeeks.includes(f.week) &&
      (f.homeClubId === uid || f.awayClubId === uid)
  );
  if (clashes.length > 0) {
    bugs.push(
      `FRIENDLY/LEAGUE CLASH weeks ${clashes.map((c) => c.week).join(",")}`
    );
  } else {
    ok.push("no friendly/league week clash for user");
  }

  // Challenge Cup includes user
  const cup = conf.state.competitions["challenge-cup"];
  const inCup = cup.fixtures.some(
    (f) => f.homeClubId === uid || f.awayClubId === uid
  );
  if (inCup) ok.push(`in Challenge Cup (${cup.fixtures[0]?.roundName})`);
  else bugs.push("user NOT in Challenge Cup Last 16");

  // Soft-cap: London shouldn't tower over Halifax by huge margin on top ratings
  const top = (id: string) =>
    Object.values(conf.state.players)
      .filter((p) => p.clubId === id && p.squadTier === "first")
      .map((p) => p.rating)
      .sort((a, b) => b - a)
      .slice(0, 5);
  const halifaxTop = top(uid);
  const londonTop = top("london-broncos");
  const widnesTop = top("widnes-vikings");
  console.log("halifax_top5", halifaxTop.join(","));
  console.log("london_top5", londonTop.join(","));
  console.log("widnes_top5", widnesTop.join(","));
  const gap = (londonTop[0] || 0) - (halifaxTop[0] || 0);
  if (gap > 12) bugs.push(`London still dominates Halifax by ${gap} OVR at #1`);
  else ok.push(`London-Halifax #1 gap ${gap}`);

  // Advance weeks with instant path
  let state = conf.state;
  const gate2 = canAdvanceWeek(state);
  if (!gate2.allowed) bugs.push(`cannot advance after friendlies: ${gate2.error}`);
  else {
    for (let i = 0; i < 3; i++) {
      const before = state.calendar.currentWeek;
      state = advanceWeek(state);
      if (state.calendar.currentWeek !== before + 1) {
        bugs.push(`week did not advance from ${before}`);
        break;
      }
    }
    ok.push(`advanced to week ${state.calendar.currentWeek}`);
  }

  // Check week 3: both friendly and league played?
  const w3Friendly = state.competitions.friendlies.fixtures.filter(
    (f) => f.week === 3 && f.isPlayed
  );
  const w3League = state.competitions.championship.fixtures.filter(
    (f) =>
      f.week === 3 &&
      f.isPlayed &&
      (f.homeClubId === uid || f.awayClubId === uid)
  );
  console.log("w3_friendly_played", w3Friendly.length, "w3_league_user_played", w3League.length);
  if (w3Friendly.length && w3League.length) {
    bugs.push("Week 3 played BOTH friendly and league for user — double fixture");
  }

  // Renew all first team
  const renew = renewAllSquadTierContracts(state, uid, "first", 2);
  if (renew.success || (renew as any).state) ok.push("renewAll first team callable");
  else bugs.push(`renewAll first failed: ${(renew as any).error || "unknown"}`);

  // Autosave persist
  const save = await persistManagerProgress(state);
  if (save.success) {
    const loaded = await loadManagerState("auto");
    if (loaded?.calendar.currentWeek === state.calendar.currentWeek) {
      ok.push("autosave roundtrip");
    } else bugs.push("autosave load week mismatch");
  } else bugs.push(`autosave failed: ${save.error}`);

  // Reject confirm with 2 picks
  const bad = confirmFriendlyOpponents(
    initializeManagerDatabase("batley-bulldogs", "X"),
    (initializeManagerDatabase("batley-bulldogs", "X").pendingFriendlyOpponents || []).slice(
      0,
      2
    )
  );
  if (!bad.success) ok.push("rejects !=3 friendlies");
  else bugs.push("accepted only 2 friendlies");

  // Auto-pick
  const s2 = initializeManagerDatabase("barrow-raiders", "Auto");
  const ap = autoPickFriendlyOpponents(s2);
  if (ap.success && ap.state.competitions.friendlies.fixtures.length === 3) {
    ok.push("auto-pick 3");
  } else bugs.push(`auto-pick failed: ${ap.error}`);

  console.log("\n=== OK ===");
  ok.forEach((m) => console.log("✓", m));
  console.log("\n=== BUGS ===");
  if (bugs.length === 0) console.log("(none)");
  bugs.forEach((m) => console.log("✗", m));
  console.log("\nSUMMARY", { ok: ok.length, bugs: bugs.length });
  if (bugs.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
