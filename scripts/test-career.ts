/**
 * Manager Mode (v2) engine test: plays full careers end to end and checks invariants.
 * Run: npx tsx scripts/test-career.ts   (CI: npm run test:career)
 */
import {
  createCareer,
  playMatchday,
  simRestOfSeason,
  simToNextBigGame,
  beginOffseason,
  buildMarket,
  buyPlayer,
  sellPlayer,
  finishTransfers,
  bankSeason,
  emptyLegacy,
  unlockLegend,
  legendCatalog,
  sortTable,
  clubsIn,
  SQUAD_MIN,
  SQUAD_MAX,
  closeDeadlineDay,
  deadlineDecisionPending,
  windowBounds,
  friendlyOptions,
  playFriendlies,
  preseasonOpen,
  sheetFor,
  type CareerState,
} from "../src/lib/career";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`❌ ${msg}`);
  }
}

function invariants(s: CareerState, label: string) {
  check(clubsIn(s, "super-league").length === 14, `${label}: Super League has 14 clubs`);
  check(clubsIn(s, "championship").length === 22, `${label}: Championship has 22 clubs`);
  const seen = new Set<string>();
  let dup = false;
  for (const c of Object.values(s.clubs)) {
    for (const id of c.squad) {
      if (seen.has(id)) dup = true;
      seen.add(id);
      if (!s.players[id]) check(false, `${label}: ${c.name} squad references missing player ${id}`);
    }
  }
  check(!dup, `${label}: no player is in two squads`);
  const me = s.clubs[s.userClubId]!;
  check(me.squad.length >= SQUAD_MIN && me.squad.length <= SQUAD_MAX, `${label}: user squad size ${me.squad.length} within limits`);
  check(s.lineup.length === 13 && new Set(s.lineup).size === 13 && s.lineup.every((id) => me.squad.includes(id)), `${label}: user lineup valid`);
}

// Deadline Day waits for the manager; the tests always shut the window and carry on.
const simAll = (start: CareerState): CareerState => {
  let s = start;
  for (let g = 0; s.phase === "season" && g < 5; g++) s = simRestOfSeason(closeDeadlineDay(s));
  return s;
};

// --- Determinism: same seed, same season.
{
  const a = simAll(createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "fixed-seed" }));
  const b = simAll(createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "fixed-seed" }));
  check(JSON.stringify(a.tables) === JSON.stringify(b.tables), "same seed → identical season");
}

// --- Deadline Day stops the clock until the manager shuts the window.
{
  let s = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "deadline" });
  s = simRestOfSeason(s);
  const b = windowBounds(s)!;
  check(s.phase === "season" && s.matchdayIndex === b.deadline, "a full-season sim stops on Deadline Day");
  check(deadlineDecisionPending(s), "Deadline Day is waiting for the manager");
  check(playMatchday(s).matchdayIndex === s.matchdayIndex, "nothing kicks off while Deadline Day is open");
  check(simToNextBigGame(s).matchdayIndex === s.matchdayIndex, "big-game sim also waits on Deadline Day");
  s = closeDeadlineDay(s);
  check(!deadlineDecisionPending(s), "shutting the window clears Deadline Day");
  s = simRestOfSeason(s);
  check(s.phase === "review", "after the window shuts the season plays out");
}

// --- Pre-season friendlies.
{
  const s0 = createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "friendlies" });
  check(preseasonOpen(s0), "pre-season is open before Round 1");
  const opts = friendlyOptions(s0);
  check(opts.length >= 4 && opts.length <= 6, `friendly options offered (${opts.length})`);
  check(new Set(opts.map((o) => o.opponentId)).size === opts.length && !opts.some((o) => o.opponentId === s0.userClubId), "friendly opponents are distinct and not you");
  check(JSON.stringify(friendlyOptions(s0)) === JSON.stringify(opts), "friendly options are stable for a save");
  const s1 = playFriendlies(s0, opts.slice(0, 3));
  check(s1.preseason?.results.length === 2, "at most two friendlies are played");
  check(s1.budget === s0.budget + opts[0]!.money + opts[1]!.money, "friendlies bank gate money / fees");
  check(!preseasonOpen(s1), "pre-season closes after the friendlies");
  check(sheetFor(s1, s1.userClubId).boost === 1, "two friendlies = +1 sharpness in the opening rounds");
  check(sheetFor(s0, s0.userClubId).boost === 0, "no friendlies = no sharpness");
  const skipped = playMatchday(s0);
  check(skipped.preseason?.done === true && !preseasonOpen(skipped), "kicking off Round 1 skips pre-season");
  let later = s1;
  for (let i = 0; i < 3; i++) later = playMatchday(later);
  check(sheetFor(later, later.userClubId).boost === 0, "sharpness wears off after three matchdays");
}

// --- Calibration over many seasons.
const slWinsTop: number[] = [];
const slWinsBottom: number[] = [];
const scores: number[] = [];
let homeWins = 0;
let games = 0;
let draws = 0;

for (const [i, clubId] of ["salford-rlfc", "wigan-warriors", "north-wales-crusaders", "york-knights"].entries()) {
  let s = createCareer({ clubId, managerName: "Test", seed: `career-${i}` });
  let legacy = emptyLegacy();
  invariants(s, `${clubId} start`);
  check(s.calendar.length === 33, `${clubId}: 33 matchdays (26 league + 5 cup + 2 play-off)`);
  check(s.challenges.length === 3, `${clubId}: 3 season challenges`);

  for (let season = 1; season <= 6; season++) {
    const label = `${clubId} S${season}`;
    // Mix of play styles: step-by-step, big-game sims, and full sims.
    if (season % 3 === 1) {
      let guard = 0;
      while (s.phase === "season" && guard++ < 50) s = playMatchday(closeDeadlineDay(s));
    } else if (season % 3 === 2) {
      let guard = 0;
      while (s.phase === "season" && guard++ < 50) s = simToNextBigGame(closeDeadlineDay(s));
    } else {
      s = simAll(s);
    }
    check(s.phase === "review", `${label}: season ends in review`);
    const all = s.calendar.flatMap((m) => m.fixtures);
    check(all.every((f) => !!f.result), `${label}: every fixture has a result`);
    check(all.filter((f) => f.kind === "grand-final").length === 1, `${label}: exactly one Grand Final`);
    check(all.filter((f) => f.kind === "mpg").length === 1, `${label}: exactly one Million Pound Game`);
    check(all.filter((f) => f.kind === "cup" && f.round === 5).length === 1, `${label}: exactly one Cup Final`);
    for (const div of ["super-league", "championship"] as const) {
      const rows = s.tables[div];
      const expected = div === "super-league" ? 26 : 21;
      check(rows.every((r) => r.p === expected), `${label}: every ${div} club played ${expected}`);
    }
    for (const f of all) {
      if (!f.result) continue;
      games++;
      scores.push(f.result.homeScore, f.result.awayScore);
      if (f.result.homeScore > f.result.awayScore) homeWins++;
      if (f.result.homeScore === f.result.awayScore) draws++;
      if (f.kind !== "league") check(f.result.homeScore !== f.result.awayScore, `${label}: knockout ${f.label} has a winner`);
    }
    const sl = sortTable(s.tables["super-league"]);
    // Table snapshot is pre-promotion; record top/bottom wins.
    slWinsTop.push(sl[0]!.w);
    slWinsBottom.push(sl[sl.length - 1]!.w);

    const outcome = s.lastOutcome!;
    check(!!outcome, `${label}: outcome recorded`);
    const banked = bankSeason(legacy, s, outcome);
    legacy = banked.legacy;
    check(legacy.legacyPoints >= 0, `${label}: legacy points non-negative`);

    s = beginOffseason(s);
    check(s.phase === "transfers", `${label}: off-season → transfer window`);
    invariants(s, `${label} window`);

    // Try a sell and a buy each window.
    const me = s.clubs[s.userClubId]!;
    const weakest = me.squad.map((id) => s.players[id]!).sort((a, b) => a.rating - b.rating)[0]!;
    const sold = sellPlayer(s, weakest.id);
    if (!sold.error) s = sold.state;
    const market = buildMarket(s, legacy.unlockedLegends);
    check(market.length > 0, `${label}: market has players`);
    const affordable = market.find((l) => l.price <= s.budget);
    if (affordable) {
      const bought = buyPlayer(s, affordable);
      check(!bought.error, `${label}: can buy an affordable player`);
      s = bought.state;
    }
    // Spend legacy on a legend when possible.
    const cheapest = legendCatalog().filter((l) => !legacy.unlockedLegends.includes(l.id)).sort((a, b) => a.unlockCost - b.unlockCost)[0];
    if (cheapest && legacy.legacyPoints >= cheapest.unlockCost) {
      const u = unlockLegend(legacy, cheapest.id);
      check(!u.error, `${label}: unlock legend`);
      legacy = u.legacy;
    }
    s = finishTransfers(s);
    check(s.phase === "season" && s.matchdayIndex === 0, `${label}: next season starts`);
    invariants(s, `${label} next`);
  }
  console.log(
    `${clubId.padEnd(22)} prestige ${s.prestige}  division ${s.clubs[s.userClubId]!.division}  history ${s.history
      .map((h) => `${h.year}:${h.division === "super-league" ? "SL" : "CH"}#${h.position}${h.trophies.length ? "[" + h.trophies.join(",") + "]" : ""}`)
      .join(" ")}  legacy ${legacy.lifetimeLegacyPoints}  legends ${legacy.unlockedLegends.length}`
  );
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(
  `\nCalibration: avg score ${avg(scores).toFixed(1)}, home win ${(100 * homeWins / games).toFixed(0)}%, draws ${(100 * draws / games).toFixed(1)}%, ` +
    `SL leader wins ${avg(slWinsTop).toFixed(1)}/26, SL bottom wins ${avg(slWinsBottom).toFixed(1)}/26`
);
check(avg(scores) > 12 && avg(scores) < 30, "average team score in a realistic range");
check(avg(slWinsTop) >= 17 && avg(slWinsTop) <= 25, "SL leaders win 17–25 of 26");
check(avg(slWinsBottom) >= 2 && avg(slWinsBottom) <= 10, "SL bottom club wins 2–10 of 26");

console.log(`\n${failed === 0 ? "ALL CAREER TESTS PASSED" : "CAREER TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
