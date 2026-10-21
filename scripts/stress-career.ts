/**
 * Manager Mode stress / fuzz harness (not run in CI — slow). `npx tsx scripts/stress-career.ts`
 * A) random action fuzz with invariant checks after every action
 * B) long soak for drift (ratings, money, squad sizes, save size, speed)
 * C) exploit probes (buy→sell arbitrage, stale listings, double unlock)
 */
import {
  createCareer, playMatchday, simToNextBigGame, simRestOfSeason, beginOffseason, finishTransfers,
  buildMarket, buyPlayer, sellPlayer, sellPrice, bankSeason, emptyLegacy, unlockLegend, legendCatalog,
  autoPickLineup, squadOf, clubsIn, clubRating, repairLineup, SQUAD_MIN, SQUAD_MAX, LINEUP_SLOTS,
  buildWorld, type CareerState, type CareerLegacy, type Tactic,
} from "../src/lib/career";
import seedrandom from "seedrandom";

const problems: string[] = [];
const fail = (m: string) => { if (problems.length < 200) problems.push(m); };

function invariants(s: CareerState, where: string) {
  if (clubsIn(s, "super-league").length !== 14) fail(`${where}: SL has ${clubsIn(s, "super-league").length} clubs`);
  if (clubsIn(s, "championship").length !== 22) fail(`${where}: Champ has ${clubsIn(s, "championship").length} clubs`);
  const seen = new Map<string, string>();
  for (const c of Object.values(s.clubs)) {
    if (c.squad.length < 13) fail(`${where}: ${c.name} has only ${c.squad.length} players`);
    for (const id of c.squad) {
      if (!s.players[id]) fail(`${where}: ${c.name} → missing player ${id}`);
      if (seen.has(id)) fail(`${where}: ${id} in ${seen.get(id)} and ${c.name}`);
      seen.set(id, c.name);
    }
  }
  for (const id of s.freeAgents) if (seen.has(id)) fail(`${where}: free agent ${id} also at ${seen.get(id)}`);
  const me = s.clubs[s.userClubId]!;
  if (me.squad.length < SQUAD_MIN || me.squad.length > SQUAD_MAX) fail(`${where}: user squad ${me.squad.length}`);
  if (s.lineup.length !== 13 || new Set(s.lineup).size !== 13 || !s.lineup.every((id) => me.squad.includes(id))) fail(`${where}: bad lineup`);
  for (const p of Object.values(s.players)) {
    if (!Number.isFinite(p.rating) || p.rating < 40 || p.rating > 99) fail(`${where}: ${p.name} rating ${p.rating}`);
    if (!Number.isFinite(p.age) || p.age < 15 || p.age > 45) fail(`${where}: ${p.name} age ${p.age}`);
  }
  if (!Number.isFinite(s.budget)) fail(`${where}: budget ${s.budget}`);
  if (s.prestige < 1 || s.prestige > 5) fail(`${where}: prestige ${s.prestige}`);
  if (s.phase === "season" && s.matchdayIndex > s.calendar.length) fail(`${where}: matchdayIndex overflow`);
  for (const div of ["super-league", "championship"] as const) {
    const rows = s.tables[div];
    if (s.phase === "season" && rows.length !== clubsIn(s, div).length) fail(`${where}: ${div} table rows ${rows.length}`);
  }
}

/* ---------------- A) fuzz ---------------- */
const allClubs = buildWorld("probe").choices.map((c) => c.id);
let actions = 0;
const tA = Date.now();
for (let run = 0; run < 40; run++) {
  const rng = seedrandom(`fuzz-${run}`);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!;
  let s: CareerState;
  try {
    s = createCareer({ clubId: pick(allClubs), managerName: run % 5 === 0 ? "" : `<script>alert(${run})</script>`, seed: `fuzz-seed-${run}` });
  } catch (e) { fail(`run ${run}: createCareer threw ${e}`); continue; }
  let legacy: CareerLegacy = { ...emptyLegacy(), legacyPoints: run % 3 === 0 ? 5000 : 0 };
  for (let season = 0; season < 5; season++) {
    let guard = 0;
    while (s.phase === "season" && guard++ < 200) {
      actions++;
      const r = rng();
      const where = `run ${run} S${season} md${s.matchdayIndex}`;
      try {
        if (r < 0.45) s = playMatchday(s);
        else if (r < 0.55) s = simToNextBigGame(s);
        else if (r < 0.58) s = simRestOfSeason(s);
        else if (r < 0.7) s = { ...s, tactic: pick<Tactic>(["attack", "balanced", "defend"]) };
        else if (r < 0.9) {
          const squad = squadOf(s, s.userClubId);
          const slot = Math.floor(rng() * 13);
          const p = pick(squad);
          const lineup = [...s.lineup];
          const ex = lineup.indexOf(p.id);
          if (ex >= 0) lineup[ex] = lineup[slot]!;
          lineup[slot] = p.id;
          s = { ...s, lineup: repairLineup(s, lineup) };
        } else s = { ...s, lineup: autoPickLineup(squadOf(s, s.userClubId)) };
      } catch (e) { fail(`${where}: action threw ${e instanceof Error ? e.stack : e}`); break; }
      invariants(s, where);
    }
    if (s.phase !== "review") { fail(`run ${run} S${season}: season did not end (phase ${s.phase})`); break; }
    const banked = bankSeason(legacy, s, s.lastOutcome!);
    legacy = banked.legacy;
    try { s = beginOffseason(s); } catch (e) { fail(`run ${run}: beginOffseason threw ${e}`); break; }
    invariants(s, `run ${run} window ${season}`);
    // random transfers
    for (let t = 0; t < 12; t++) {
      actions++;
      try {
        if (rng() < 0.5) {
          const squad = s.clubs[s.userClubId]!.squad;
          const r2 = sellPlayer(s, pick(squad));
          if (!r2.error) s = r2.state;
        } else {
          const market = buildMarket(s, legacy.unlockedLegends);
          if (market.length) { const r2 = buyPlayer(s, pick(market)); if (!r2.error) s = r2.state; }
        }
        if (rng() < 0.2) {
          const l = pick(legendCatalog());
          const u = unlockLegend(legacy, l.id);
          if (!u.error) legacy = u.legacy;
        }
      } catch (e) { fail(`run ${run} transfers: threw ${e}`); }
      invariants(s, `run ${run} transfer ${t}`);
    }
    try { s = finishTransfers(s); } catch (e) { fail(`run ${run}: finishTransfers threw ${e}`); break; }
    invariants(s, `run ${run} start S${season + 1}`);
  }
}
console.log(`A) fuzz: ${actions} actions in ${((Date.now() - tA) / 1000).toFixed(1)}s, problems so far ${problems.length}`);

/* ---------------- B) soak ---------------- */
for (const club of ["wigan-warriors", "cornwall-rlfc"]) {
  let s = createCareer({ clubId: club, managerName: "Soak", seed: `soak-${club}` });
  const avgTop = (div: "super-league" | "championship") => {
    const ids = clubsIn(s, div);
    return ids.reduce((sum, id) => sum + clubRating(s, id), 0) / ids.length;
  };
  console.log(`\nB) soak ${club}`);
  for (let season = 1; season <= 30; season++) {
    const t0 = performance.now();
    s = simRestOfSeason(s);
    const tSeason = performance.now() - t0;
    const o = s.lastOutcome!;
    s = beginOffseason(s);
    s = finishTransfers(s);
    invariants(s, `soak ${club} S${season}`);
    if (season % 5 === 0 || season === 1)
      console.log(`  S${String(season).padStart(2)} ${o.division === "super-league" ? "SL" : "CH"}#${String(o.position).padStart(2)}  SL avg XIII ${avgTop("super-league").toFixed(1)}  CH avg ${avgTop("championship").toFixed(1)}  you ${clubRating(s, s.userClubId).toFixed(1)}  budget £${(s.budget / 1e6).toFixed(2)}M  players ${Object.keys(s.players).length}  FA ${s.freeAgents.length}  save ${(JSON.stringify(s).length / 1024).toFixed(0)}KB  sim ${tSeason.toFixed(0)}ms`);
  }
}

/* ---------------- C) exploits ---------------- */
console.log("\nC) exploits");
{
  let s = createCareer({ clubId: "leeds-rhinos", managerName: "X", seed: "exploit" });
  s = simRestOfSeason(s); s = beginOffseason(s);
  s = { ...s, budget: 10_000_000 };
  const legacy = { ...emptyLegacy(), unlockedLegends: legendCatalog().map((l) => l.id) };
  const market = buildMarket(s, legacy.unlockedLegends);
  // legend arbitrage
  const leg = market.find((l) => l.legend)!;
  const b1 = buyPlayer(s, leg);
  if (!b1.error) {
    const fee = leg.price; const back = sellPrice(b1.state, leg.playerId);
    console.log(`  legend ${leg.playerId}: buy ${fee} → sell ${back} (${back > fee ? "PROFIT EXPLOIT" : "ok"})`);
    if (back > fee) fail(`exploit: legend buy ${fee} sell ${back}`);
  }
  // free agent / market arbitrage
  for (const l of market.filter((x) => !x.legend).slice(0, 30)) {
    const b = buyPlayer(s, l);
    if (b.error) continue;
    const back = sellPrice(b.state, l.playerId);
    if (back > l.price) { fail(`exploit: ${l.fromClubId ? "club" : "free agent"} buy ${l.price} sell ${back}`); console.log(`  arbitrage: ${l.fromClubId ?? "FA"} buy ${l.price} → sell ${back}`); break; }
  }
  // stale listing: buy same listing twice
  const l = market.find((x) => !x.legend && x.fromClubId)!;
  const once = buyPlayer(s, l); const twice = once.error ? null : buyPlayer(once.state, l);
  console.log(`  stale listing re-buy → ${twice?.error ?? "ALLOWED (bug)"}`);
  if (twice && !twice.error) fail("exploit: same listing bought twice");
  // legend bought twice
  if (!b1.error) { const again = buyPlayer(b1.state, leg); console.log(`  legend re-buy → ${again.error ?? "ALLOWED (bug)"}`); if (!again.error) fail("exploit: legend bought twice"); }
  // double unlock
  const u1 = unlockLegend({ ...emptyLegacy(), legacyPoints: 1000 }, legendCatalog()[0]!.id);
  const u2 = unlockLegend(u1.legacy, legendCatalog()[0]!.id);
  console.log(`  double unlock → ${u2.error ?? "ALLOWED (bug)"}`);
  // bank twice
  const s2 = simRestOfSeason(createCareer({ clubId: "wigan-warriors", managerName: "B", seed: "bank" }));
  const once2 = bankSeason(emptyLegacy(), s2, s2.lastOutcome!).legacy;
  const twice2 = bankSeason(once2, s2, s2.lastOutcome!).legacy;
  console.log(`  bank same season twice: ${once2.legacyPoints} → ${twice2.legacyPoints}`);
  if (twice2.legacyPoints !== once2.legacyPoints) fail("exploit: season banked twice");
}

console.log(`\n${problems.length ? `PROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "NO PROBLEMS FOUND"}`);
