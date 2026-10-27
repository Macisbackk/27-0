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
  finishDepartures,
  renewContract,
  releaseExpiring,
  renewalFee,
  contractOf,
  currentStage,
  markStageSeen,
  promotionPicture,
  leagueOverPicture,
  boardGoal,
  boardTargetForRank,
  nextStop,
  simToNextStop,
  skipIdleWeeks,
  seasonProgress,
  userStreak,
  userFixture,
  recommendedRenewals,
  buildWorld,
  isFreeAgentListing,
  isWindowOpen,
  playerWage,
  signingCost,
  wagesDueNow,
  windowStatus,
  type CareerState,
} from "../src/lib/career";

/** Players who have retired (or otherwise left the world) in any career this run: they must never come back. */
const gone = new Set<string>();
function noGhosts(s: CareerState, label: string) {
  const back: string[] = [];
  for (const c of Object.values(s.clubs)) for (const id of c.squad) if (gone.has(id)) back.push(`${id}@${c.id}`);
  for (const id of s.freeAgents) if (gone.has(id)) back.push(`${id}@FA`);
  for (const id of Object.keys(s.players)) if (gone.has(id)) back.push(`${id}@players`);
  check(back.length === 0, `${label}: retired players never reappear (${back.slice(0, 3).join(", ")})`);
  const inSquads = new Set(Object.values(s.clubs).flatMap((c) => c.squad));
  check(s.freeAgents.every((id) => !inSquads.has(id) && !!s.players[id]), `${label}: free agents are unattached and real`);
  check(new Set(s.freeAgents).size === s.freeAgents.length, `${label}: no duplicate free agents`);
}

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
  gone.clear(); // real players share ids across careers
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

    const beforeSummer = s;
    s = beginOffseason(s);
    check(s.phase === "departures", `${label}: off-season → departures`);
    // Retirements happen here, at the end of the season: every retiree is gone for good.
    for (const id of Object.keys(beforeSummer.players)) if (!s.players[id] && !id.startsWith("legend-")) gone.add(id);
    check(!windowStatus(s).open, `${label}: window shut during departures`);
    noGhosts(s, `${label} departures`);
    check(!!s.departures, `${label}: departures recorded`);
    // Contracts: renew the first expiring player if affordable, let the next one go.
    const exp = s.departures?.expiring ?? [];
    for (const id of exp) check(s.clubs[s.userClubId]!.squad.includes(id), `${label}: expiring player still at the club until decided`);
    if (exp[0]) {
      const fee = renewalFee(s.players[exp[0]]!);
      const r = renewContract(s, exp[0]);
      if (s.budget >= fee) {
        check(!r.error && r.state.budget === s.budget - fee, `${label}: renewing costs the signing-on fee`);
        check(contractOf(r.state.players[exp[0]]!) >= 1 && !(r.state.departures?.expiring ?? []).includes(exp[0]), `${label}: renewed player has a new deal`);
        s = r.state;
      } else check(r.error === "budget", `${label}: can't renew without the budget`);
    }
    if (exp[1]) {
      const before = s.clubs[s.userClubId]!.squad.length;
      s = releaseExpiring(s, exp[1]);
      check(!s.clubs[s.userClubId]!.squad.includes(exp[1]) && s.freeAgents.includes(exp[1]), `${label}: released player leaves for free agency`);
      check(s.clubs[s.userClubId]!.squad.length === before - 1, `${label}: release shrinks the squad by one`);
    }
    const undecided = [...(s.departures?.expiring ?? [])];
    s = finishDepartures(s);
    check(s.phase === "transfers", `${label}: departures → transfer window`);
    check(isWindowOpen(s) && windowStatus(s).kind === "summer", `${label}: summer window open`);
    if (exp[1]) check(!buildMarket(s, []).some((l) => l.playerId === exp[1]), `${label}: a man you let go can't be re-signed on a free the same summer`);
    for (const id of undecided) check(!s.clubs[s.userClubId]!.squad.includes(id), `${label}: undecided expiring players leave`);
    check(s.clubs[s.userClubId]!.squad.every((id) => contractOf(s.players[id]!) >= 1), `${label}: everyone left is under contract`);
    invariants(s, `${label} window`);

    // Try a sell and a buy each window.
    const me = s.clubs[s.userClubId]!;
    const weakest = me.squad.map((id) => s.players[id]!).sort((a, b) => a.rating - b.rating)[0]!;
    const sold = sellPlayer(s, weakest.id);
    if (!sold.error) s = sold.state;
    if (!sold.error && sold.soldTo === null) {
      check(!buildMarket(s, []).some((l) => l.playerId === weakest.id), `${label}: a player you sold to nobody can't be bought straight back for free`);
    }
    const market = buildMarket(s, legacy.unlockedLegends);
    check(market.length > 0, `${label}: market has players`);
    // Free agents: never a fee. In the summer window nothing is paid at signing (wages go on the bill at kick-off).
    const fas = market.filter(isFreeAgentListing);
    check(fas.every((l) => l.price === 0), `${label}: free agents are listed with no fee`);
    check(fas.every((l) => l.wages === playerWage(s.players[l.playerId]!)), `${label}: free agents list their wages`);
    check(market.filter((l) => l.fromClubId).every((l) => l.price > 0), `${label}: players under contract cost a fee`);
    const fa = fas.find((l) => s.clubs[s.userClubId]!.squad.length < SQUAD_MAX && l.wages <= 2_000_000);
    if (fa) {
      const bought = buyPlayer(s, { ...fa, price: 123_456 }); // even a doctored listing can't charge a fee
      check(!bought.error, `${label}: can sign a free agent`);
      if (!bought.error) {
        check(bought.state.budget === s.budget, `${label}: summer free-agent signing costs £0 now (budget ${s.budget} → ${bought.state.budget})`);
        check(bought.state.players[fa.playerId]!.fee === 0, `${label}: free agent's fee recorded as £0`);
        check(!bought.state.freeAgents.includes(fa.playerId), `${label}: signed free agent leaves the pool`);
        s = bought.state;
      }
    }
    const affordable = market.find((l) => signingCost(s, l).total <= s.budget && !s.clubs[s.userClubId]!.squad.includes(l.playerId) && s.clubs[s.userClubId]!.squad.length < SQUAD_MAX);
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
    noGhosts(s, `${label} pre-season`);
    // Pre-season: the window is still open. A free agent costs no fee; the budget moves only by his wages.
    check(windowStatus(s).kind === "preseason", `${label}: window open in pre-season`);
    const pre = buildMarket(s, []).filter(isFreeAgentListing).find((l) => s.budget >= signingCost(s, l).total);
    if (pre && s.clubs[s.userClubId]!.squad.length < SQUAD_MAX) {
      const p = s.players[pre.playerId]!;
      const r = buyPlayer(s, pre);
      check(!r.error, `${label}: pre-season free-agent signing goes through`);
      if (!r.error) {
        const due = wagesDueNow(s, p);
        check(due === playerWage(p), `${label}: before Round 1 a new man's whole season of wages is due`);
        check(r.state.budget === s.budget - due, `${label}: pre-season free agent costs only wages (${s.budget} → ${r.state.budget}, wages ${due})`);
        s = r.state;
      }
    }
  }
  console.log(
    `${clubId.padEnd(22)} prestige ${s.prestige}  division ${s.clubs[s.userClubId]!.division}  history ${s.history
      .map((h) => `${h.year}:${h.division === "super-league" ? "SL" : "CH"}#${h.position}${h.trophies.length ? "[" + h.trophies.join(",") + "]" : ""}`)
      .join(" ")}  legacy ${legacy.lifetimeLegacyPoints}  legends ${legacy.unlockedLegends.length}`
  );
}

// No new career starts in debt.
for (const clubId of ["london-broncos", "leeds-rhinos", "north-wales-crusaders"]) {
  const c = createCareer({ clubId, managerName: "T", seed: `budget-${clubId}` });
  check(c.budget >= 100_000, `${clubId}: new career starts with at least £100k (got ${c.budget})`);
}

// Season stages: one thing at a time.
{
  let s = createCareer({ clubId: "leeds-rhinos", managerName: "Stages", seed: "stages" });
  check(currentStage(s) === "preseason", "stages: a new season opens on pre-season");
  s = playFriendlies(s, friendlyOptions(s).slice(0, 1));
  check(currentStage(s) === "preseason-done", "stages: friendly results get their own stage");
  s = markStageSeen(s, "preseason");
  check(currentStage(s) === "fixture", "stages: then Round 1");
  let guard = 0;
  let sawDeadline = false;
  while (currentStage(s) !== "league-over" && s.phase === "season" && guard++ < 80) {
    if (currentStage(s) === "deadline") {
      sawDeadline = true;
      s = closeDeadlineDay(s);
      continue;
    }
    s = playMatchday(s);
  }
  check(sawDeadline, "stages: Deadline Day is its own stage");
  check(currentStage(s) === "league-over", "stages: the end of the league gets its own stage");
  const lo = leagueOverPicture(s);
  check(lo.position >= 1 && lo.verdict.length > 0, "stages: league-over picture has a position and verdict");
  s = markStageSeen(s, "league-over");
  check(currentStage(s) === "fixture", "stages: then the play-offs / Million Pound Game");
  s = playMatchday(s);
  check(currentStage(s) === "promotion", "stages: promotion and relegation before the Grand Final");
  const pic = promotionPicture(s);
  check(pic.up.length >= 1 && pic.down.length >= 1 && pic.up.length === pic.down.length, "stages: as many go up as down");
  s = markStageSeen(s, "promotion");
  s = playMatchday(s);
  check(s.phase === "review", "stages: Grand Final ends the season");
  for (const id of pic.up) check(s.clubs[id]!.division === "super-league", "stages: promotion picture matches the real outcome (up)");
  for (const id of pic.down) check(s.clubs[id]!.division === "championship", "stages: promotion picture matches the real outcome (down)");
}

// --- The season loop: board target, Sim to the next decision, idle weeks, progress.
{
  // Board targets: sensible bands, never better than expected, always a real place.
  for (const [div, size] of [["super-league", 14], ["championship", 22]] as const) {
    for (let r = 1; r <= size; r++) {
      const t = boardTargetForRank(div, r, size);
      check(t >= 1 && t <= size, `board: ${div} rank ${r} target in range (${t})`);
      check(t >= Math.min(r, size - 2), `board: ${div} rank ${r} target not harder than expected (${t})`);
    }
  }
  for (const seed of ["loop-a", "loop-b", "loop-c", "loop-d"]) {
    for (const division of ["super-league", "championship"] as const) {
      const choice = buildWorld(seed).choices.filter((c) => c.division === division)[seed.charCodeAt(5) % 5]!;
      let s = createCareer({ clubId: choice.id, managerName: "Loop", seed });
      check(s.board?.year === s.year && s.board.target >= 1, `${seed}/${division}: board target set at the start`);
      const goal = boardGoal(s);
      check(goal.target === s.board!.target && goal.label.length > 0 && goal.played === 0, `${seed}/${division}: board goal readable`);
      // Older saves without a board target still get one.
      const old = { ...s, board: undefined } as CareerState;
      check(boardGoal(old).target === goal.target, `${seed}/${division}: old save derives the same target`);
      s = playFriendlies(s, []);
      check(seasonProgress(s).label === "Round 1 of " + seasonProgress(s).total, `${seed}/${division}: progress reads Round 1 of N`);
      // Sim to each stop; the calendar preview says where it stops and how many games it plays.
      let guard = 0;
      let sims = 0;
      while (s.phase === "season" && guard++ < 80) {
        const st = currentStage(s);
        if (st === "deadline") { s = skipIdleWeeks(closeDeadlineDay(s)); continue; }
        if (st === "league-over" || st === "promotion") { s = skipIdleWeeks(markStageSeen(s, st)); continue; }
        check(st === "fixture", `${seed}/${division}: only fixture stage left (${st})`);
        const f = userFixture(s.calendar[s.matchdayIndex], s.userClubId);
        check(!!f, `${seed}/${division}: idle weeks are skipped (md ${s.matchdayIndex})`);
        const stop = f?.kind === "league" ? nextStop(s) : null;
        if (stop && stop.games >= 2) {
          const before = s;
          const after = simToNextStop(s);
          let games = 0;
          for (let i = before.matchdayIndex; i < after.matchdayIndex; i++) if (userFixture(after.calendar[i], s.userClubId)?.result) games++;
          check(games === stop.games, `${seed}/${division}: sim to ${stop.label} played ${games}, preview said ${stop.games}`);
          const stAfter = after.phase === "season" ? currentStage(after) : "done";
          const fAfter = after.phase === "season" ? userFixture(after.calendar[after.matchdayIndex], s.userClubId) : undefined;
          check(stAfter !== "fixture" || (fAfter && fAfter.kind !== "league") || after.phase !== "season", `${seed}/${division}: sim stopped at a decision (${stop.label})`);
          s = skipIdleWeeks(after);
          sims++;
        } else {
          s = skipIdleWeeks(playMatchday(s));
        }
      }
      check(s.phase === "review", `${seed}/${division}: season finishes through sims and stops`);
      check(sims >= 2, `${seed}/${division}: Sim to… offered at least twice (${sims})`);
      check(s.lastOutcome?.boardTarget === s.board?.target, `${seed}/${division}: review keeps the board target`);
      const streak = userStreak(s);
      check(!!streak && streak.length >= 1, `${seed}/${division}: a form run is readable`);
      // Summer: suggested renewals are affordable and all expiring.
      s = beginOffseason(s);
      const keep = recommendedRenewals(s);
      const fees = keep.reduce((t, id) => t + renewalFee(s.players[id]!), 0);
      check(fees <= s.budget, `${seed}/${division}: suggested renewals fit the budget`);
      check(keep.every((id) => s.departures!.expiring.includes(id)), `${seed}/${division}: suggestions are out-of-contract players`);
      for (const id of keep) {
        const r = renewContract(s, id);
        check(!r.error, `${seed}/${division}: suggested renewal goes through`);
        s = r.state;
      }
    }
  }
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
