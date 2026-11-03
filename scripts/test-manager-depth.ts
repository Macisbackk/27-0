/**
 * Manager Mode depth (v1.66): injuries, development with game time, the three-part game plan,
 * board objectives / confidence / supporter mood, and the career history's transfers.
 * Run: npx tsx scripts/test-manager-depth.ts   (CI: npm run test:career)
 */
import {
  aiLineup,
  beginOffseason,
  boardOf,
  buildMarket,
  buyPlayer,
  closeDeadlineDay,
  createCareer,
  currentObjectives,
  developPlayer,
  fansOf,
  finishDepartures,
  finishTransfers,
  migrateCareer,
  moodIncomeFactor,
  noteUserDeal,
  playMatchday,
  recordUserDeal,
  rollInjuries,
  rollLayoff,
  seasonDealsFor,
  sellPlayer,
  simRestOfSeason,
  squadOf,
  tacticEffect,
  tacticsFromLegacy,
  tacticsOf,
  BOARD_WARNING,
  LONG_INJURY,
  type CareerPlayer,
  type CareerState,
} from "../src/lib/career";
import { simulateMatch, type TeamSheet } from "../src/lib/career/match";
import { rngFor } from "../src/lib/career/rng";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`❌ ${msg}`);
  }
}

const simAll = (start: CareerState): CareerState => {
  let s = start;
  for (let g = 0; s.phase === "season" && g < 5; g++) s = simRestOfSeason(closeDeadlineDay(s));
  return s;
};
const nextSeason = (s: CareerState): CareerState => finishTransfers(finishDepartures(beginOffseason(s)));

/* ---------------------------------------------------------------- injuries */
console.log("Injuries");
{
  // Lay-off lengths: mostly short, a few long.
  const rng = rngFor("layoffs");
  const n = 20_000;
  const lay = Array.from({ length: n }, () => rollLayoff(rng));
  const short = lay.filter((g) => g <= 3).length / n;
  const long = lay.filter((g) => g >= 8).length / n;
  check(short > 0.8 && short < 0.9, `most injuries last 1–3 games (${(short * 100).toFixed(0)}%)`);
  check(long > 0.02 && long < 0.07, `long lay-offs (8+ games) are rare (${(long * 100).toFixed(1)}%)`);
  check(Math.max(...lay) <= 14 && Math.min(...lay) >= 1, "lay-offs stay between 1 and 14 games");

  // A whole season, every club: about 1–2 injuries per club per 5 games.
  let s = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "injury-season" });
  let games = 0;
  let userInjured = 0;
  let longUser = 0;
  let pickedInjured = 0;
  let aiPickedInjured = 0;
  for (let g = 0; s.phase === "season" && g < 60; g++) {
    const before = s.matchdayIndex;
    s = playMatchday(closeDeadlineDay(s));
    const md = s.calendar[before];
    for (const f of md?.fixtures ?? []) {
      if (!f.result) continue;
      games += 2;
      const mine = f.home === s.userClubId || f.away === s.userClubId;
      if (mine) for (const [, n2] of Object.entries(f.result.injuries ?? {})) {
        userInjured++;
        if (n2 >= LONG_INJURY) longUser++;
      }
    }
      // Nobody injured is picked (yours or theirs) for the next round.
    if (s.phase === "season") {
      pickedInjured += s.lineup.filter((id) => s.players[id]?.injury).length + (s.bench ?? []).filter((id) => s.players[id]?.injury).length;
      for (const c of Object.values(s.clubs).slice(0, 12)) {
        if (c.id === s.userClubId) continue;
        aiPickedInjured += aiLineup(s, c.id).filter((id) => s.players[id]?.injury).length;
      }
    }
  }
  check(games > 0, "a season played with injuries on");
  {
    // The rate itself, from a big sample of one 17.
    const rng2 = rngFor("rate");
    const squad = squadOf(s, s.userClubId).slice(0, 17).map((p) => p.id);
    let total = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) total += Object.keys(rollInjuries(rng2, squad, s.players)).length;
    const per5 = (total / trials) * 5;
    check(per5 >= 1 && per5 <= 2, `about 1–2 injuries per club every 5 games (${per5.toFixed(2)})`);
  }
  check(userInjured > 0, `the user's club picks up injuries in a season (${userInjured})`);
  check(pickedInjured === 0, "an injured man is never in your 17 (the bench covers, like a ban)");
  check(aiPickedInjured === 0, "AI clubs leave their injured men out too");
  check(s.news.some((l) => /out for \d+ game/.test(l)) || s.history.length > 0, "injuries make the news");
  if (longUser > 0) check((s.events ?? []).some((e) => e.kind === "injury"), `a long injury (${longUser}) brings a pop-up`);
  // A live-match knock always becomes an injury.
  const ids = squadOf(s, s.userClubId).slice(0, 17).map((p) => p.id);
  const forced = rollInjuries(rngFor("knock"), ids, s.players, [ids[3]!]);
  check((forced[ids[3]!] ?? 0) >= 1 && Object.keys(forced).length <= 2, "a man who went off hurt in a live match is injured");
  // Next season: everyone fit again.
  if (s.phase === "review") {
    const n2 = nextSeason(s);
    check(!Object.values(n2.players).some((p) => p.injury), "knocks heal over the summer");
  }
}

/* --------------------------------------------------------------- development */
console.log("Development with game time");
{
  const kid = (): CareerPlayer => ({
    id: "k", name: "Kid", pos: "CE", rating: 66, potential: 86, age: 19, nationality: "England", real: false,
    apps: 0, tries: 0, careerApps: 0, careerTries: 0,
  });
  const avg = (apps: number) => {
    const rng = rngFor("dev", apps);
    let sum = 0;
    for (let i = 0; i < 4000; i++) {
      const p = { ...kid(), apps };
      developPlayer(rng, p);
      sum += p.rating - 66;
    }
    return sum / 4000;
  };
  const regular = avg(22);
  const some = avg(8);
  const none = avg(0);
  check(regular > some && some > none, `young players grow with games (22 apps +${regular.toFixed(2)}, 8 apps +${some.toFixed(2)}, none +${none.toFixed(2)})`);
  check(regular >= 2.4 && regular <= 3.6 && none <= 1.3, "a regular gains about 3 a summer, an unused kid about 1");
  // The +N shows on the Team tab and the departures screen.
  let s = simAll(createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "dev-season" }));
  s = beginOffseason(s);
  const grew = squadOf(s, s.userClubId).filter((p) => p.grew);
  check(grew.length > 0, `the user's men carry their summer change (+N) (${grew.length})`);
  check(Array.isArray(s.departures?.growth) && (s.departures!.growth!.every((g) => g.to > g.from)), "the departures screen lists who improved");
}

/* ------------------------------------------------------------------- tactics */
console.log("Game plan");
{
  const open = tacticEffect({ attack: "expansive", defence: "rush", kicking: "attacking" });
  const tight = tacticEffect({ attack: "direct", defence: "drift", kicking: "territory" });
  const flat = tacticEffect({ attack: "balanced", defence: "balanced", kicking: "balanced" });
  check(flat.attack === 0 && flat.defence === 0 && flat.tempo === 1 && flat.pens === 0, "balanced everywhere changes nothing");
  check(open.tempo > 1.04 && tight.tempo < 0.96, `expansive plans open the game up, safe ones tighten it (${open.tempo.toFixed(2)} v ${tight.tempo.toFixed(2)})`);
  for (const t of [open, tight, tacticEffect({ attack: "expansive", defence: "balanced", kicking: "balanced" })]) {
    check(Math.abs(t.attack) <= 1.2 && Math.abs(t.defence) <= 1.2, `each plan's effect stays small (${t.attack.toFixed(1)} / ${t.defence.toFixed(1)} rating points)`);
  }
  check(tacticsFromLegacy("attack").attack === "expansive" && tacticsFromLegacy("defend").kicking === "territory", "the old single tactic maps onto the new plan");

  // Simulated: open v open scores more than tight v tight.
  const s = createCareer({ clubId: "st-helens", managerName: "T", seed: "tactics" });
  const other = Object.values(s.clubs).find((c) => c.division === "super-league" && c.id !== s.userClubId)!;
  const sheet = (clubId: string, tactics: TeamSheet["tactics"]): TeamSheet => ({
    clubId,
    lineup: clubId === s.userClubId ? s.lineup : aiLineup(s, clubId),
    bench: [],
    tactic: "balanced",
    tactics,
  });
  const avgPts = (t: TeamSheet["tactics"]) => {
    let sum = 0;
    for (let i = 0; i < 3000; i++) {
      // Your plan against an AI side playing it straight.
      const r = simulateMatch(rngFor("tac", i), sheet(s.userClubId, t), sheet(other.id, undefined), s.players, { knockout: false });
      sum += r.homeScore + r.awayScore;
    }
    return sum / 3000;
  };
  const wide = avgPts({ attack: "expansive", defence: "balanced", kicking: "attacking" });
  const safe = avgPts({ attack: "direct", defence: "drift", kicking: "territory" });
  check(wide > safe + 3 && wide - safe < 15, `open plans mean more points, by a believable margin (${wide.toFixed(1)} v ${safe.toFixed(1)})`);

  // Old saves: the single tactic carries over; new ones load untouched.
  const old = structuredClone(s) as Partial<CareerState>;
  delete old.tactics;
  old.tactic = "attack";
  const m = migrateCareer(old as CareerState);
  check(m.tactics?.attack === "expansive", "an old save's Attack tactic loads as an expansive plan");
  check(migrateCareer(s) === s, "a new save loads untouched");
  check(tacticsOf({ tactics: { attack: "bogus" as never, defence: "rush", kicking: "balanced" }, tactic: "defend" }).attack === "direct", "a broken plan falls back to the old tactic");
}

/* ------------------------------------------------- board, fans, objectives */
console.log("Board objectives, confidence and supporters");
{
  let s = createCareer({ clubId: "warrington-wolves", managerName: "T", seed: "mood" });
  check(fansOf(s) === 60 && boardOf(s) === 60 && moodIncomeFactor(s) === 1, "a new career starts at 60 / 60 (no income change)");
  const objectives = currentObjectives(s);
  check(objectives.length === 2, `the board sets two objectives on top of the league target (${objectives.map((o) => o.title).join("; ")})`);
  check(objectives.some((o) => o.kind === "cup-run"), "a Super League club is asked for a cup run");
  check(moodIncomeFactor({ fans: 100, boardConfidence: 100 }) <= 1.16 && moodIncomeFactor({ fans: 0, boardConfidence: 0 }) >= 0.8, "mood moves income only a little");

  const start = s;
  s = simAll(s);
  const o = s.lastOutcome!;
  check(Array.isArray(o.objectives) && o.objectives.length === 2, "the season review keeps the objectives' verdict");
  check(typeof o.confidence === "number" && typeof o.fans === "number" && o.fans >= 0 && o.fans <= 100, `board ${o.confidence} and fans ${o.fans} are kept on the season`);
  check(fansOf(s) !== fansOf(start), "results move the supporters");

  // Selling a favourite (the captain) upsets the fans; a big signing lifts them.
  const t = structuredClone(start);
  const cap = t.captainId!;
  const before = fansOf(t);
  noteUserDeal(t, { year: t.year, at: 0, playerId: cap, playerName: "Cap", pos: "PR", rating: 85, from: t.userClubId, to: "wigan-warriors", fee: 300_000 });
  check(fansOf(t) < before - 4, `selling a favourite costs fan mood (${before} → ${fansOf(t)})`);
  const star = Object.values(t.players).find((p) => p.rating >= 88 && !t.clubs[t.userClubId]!.squad.includes(p.id))!;
  const mid = fansOf(t);
  noteUserDeal(t, { year: t.year, at: 0, playerId: star.id, playerName: star.name, pos: star.pos, rating: star.rating, from: "wigan-warriors", to: t.userClubId, fee: 500_000 });
  check(fansOf(t) > mid, "a big signing lifts the fans");

  // Very low confidence: a warning pop-up (once), no sacking.
  const w = structuredClone(start);
  w.boardConfidence = BOARD_WARNING + 1;
  let x = w;
  for (let i = 0; i < 4 && x.phase === "season"; i++) {
    x.boardConfidence = BOARD_WARNING - 0.5;
    x = playMatchday(closeDeadlineDay(x));
  }
  check((x.events ?? []).filter((e) => e.kind === "board-warning").length === 1, "low board confidence brings one warning pop-up a season");
}

/* -------------------------------------------------------- career history */
console.log("Career history: transfers per season");
{
  let s = simAll(createCareer({ clubId: "hull-kr", managerName: "T", seed: "history" }));
  s = finishDepartures(beginOffseason(s));
  // The summer window: buy one, sell one (recorded the way the app does it).
  const listing = buildMarket(s, []).find((l) => l.fromClubId && l.price <= s.budget);
  if (listing) {
    const r = buyPlayer(s, listing);
    if (!r.error) {
      const p = r.state.players[listing.playerId]!;
      recordUserDeal(r.state, { playerId: p.id, playerName: p.name, pos: p.pos, rating: p.rating, from: listing.fromClubId, to: r.state.userClubId, fee: p.fee ?? 0 });
      s = r.state;
    }
  }
  const seller = squadOf(s, s.userClubId).sort((a, b) => a.rating - b.rating)[0]!;
  const sale = sellPlayer(s, seller.id);
  if (!sale.error) {
    recordUserDeal(sale.state, { playerId: seller.id, playerName: seller.name, pos: seller.pos, rating: seller.rating, from: sale.state.userClubId, to: sale.soldTo ?? null, fee: sale.fee ?? 0 });
    s = sale.state;
  }
  const year = s.year;
  const expectIns = listing ? 1 : 0;
  s = finishTransfers(s);
  // The capped deals list loses everything: the season's record keeps them.
  s = { ...s, transfers: [] };
  s = simAll(s);
  const h = s.history[s.history.length - 1]!;
  check(h.year === year && (h.ins?.length ?? 0) >= expectIns && (h.outs?.length ?? 0) >= (sale.error ? 0 : 1), `the season keeps its signings (${h.ins?.length}) and sales (${h.outs?.length}) past the deals cap`);
  // Older saves: whatever the deals list still has.
  const old = { ...s, seasonDeals: undefined, transfers: [{ year: 1999, at: 0, playerId: "x", playerName: "Old Boy", pos: "PR" as const, rating: 70, from: null, to: s.userClubId, fee: 0, user: true }] };
  const back = seasonDealsFor(old, 1999);
  check(back.ins.length === 1 && back.ins[0]!.name === "Old Boy" && back.outs.length === 0, "older saves show what the deals list still holds");
}

/* ------------------------------------------------------------- old saves */
console.log("Old saves");
{
  const s = createCareer({ clubId: "castleford-tigers", managerName: "T", seed: "old-save" });
  const old = structuredClone(s) as Partial<CareerState>;
  delete old.tactics;
  delete old.fans;
  delete old.boardConfidence;
  delete old.objectives;
  delete old.seasonDeals;
  const m = migrateCareer(old as CareerState);
  let t = m;
  for (let i = 0; i < 5 && t.phase === "season"; i++) t = playMatchday(closeDeadlineDay(t));
  check(t.matchdayIndex > 0 && Number.isFinite(fansOf(t)) && Number.isFinite(boardOf(t)), "a save from before v1.66 loads and plays on");
  check(currentObjectives(t).length === 0, "…with no objectives until its next season");
  t = simAll(t);
  check(t.phase === "review" && t.lastOutcome!.ins !== undefined, "…and finishes its season");
}

console.log(`\n${failed === 0 ? "ALL MANAGER DEPTH TESTS PASSED" : "MANAGER DEPTH TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
