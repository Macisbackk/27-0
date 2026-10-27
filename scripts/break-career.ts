/**
 * Try to break Manager Mode's newer systems (stages, Deadline Day, departures, contracts,
 * friendlies, bids) with random and adversarial action orders. Run: bun scripts/break-career.ts
 * Prints every problem found; exit 1 if any.
 */
import seedrandom from "seedrandom";
import {
  createCareer,
  playMatchday,
  simToNextBigGame,
  simRestOfSeason,
  beginOffseason,
  finishDepartures,
  finishTransfers,
  renewContract,
  releaseExpiring,
  renewalFee,
  contractOf,
  closeDeadlineDay,
  deadlineDecisionPending,
  currentStage,
  markStageSeen,
  friendlyOptions,
  playFriendlies,
  preseasonOpen,
  buildMarket,
  buyPlayer,
  sellPlayer,
  acceptBid,
  rejectBid,
  isWindowOpen,
  promotionPicture,
  legendCatalog,
  leagueOverPicture,
  clubsIn,
  buildWorld,
  SQUAD_MIN,
  SQUAD_MAX,
  repairLineup,
  tickDeadline,
  pauseDeadline,
  acceptOffer,
  rejectOffer,
  liveOffers,
  deadlineClock,
  isDeadlineDay,
  clubNeed,
  DEADLINE_MINUTES,
  type CareerState,
  wagesDueNow,
} from "../src/lib/career";
import { isCareer } from "../src/lib/career/storage";

const problems: string[] = [];
const notes: string[] = [];
const fail = (m: string) => {
  if (problems.length < 300) problems.push(m);
};

function invariants(s: CareerState, where: string) {
  if (clubsIn(s, "super-league").length !== 14) fail(`${where}: SL has ${clubsIn(s, "super-league").length} clubs`);
  if (clubsIn(s, "championship").length !== 22) fail(`${where}: Champ has ${clubsIn(s, "championship").length} clubs`);
  const seen = new Map<string, string>();
  for (const c of Object.values(s.clubs)) {
    for (const id of c.squad) {
      if (!s.players[id]) fail(`${where}: ${c.name} → missing player ${id}`);
      if (seen.has(id)) fail(`${where}: ${id} in ${seen.get(id)} and ${c.name}`);
      seen.set(id, c.name);
    }
  }
  for (const id of s.freeAgents) {
    if (seen.has(id)) fail(`${where}: free agent ${id} also at ${seen.get(id)}`);
    if (!s.players[id]) fail(`${where}: free agent ${id} has no player record`);
  }
  if (new Set(s.freeAgents).size !== s.freeAgents.length) fail(`${where}: duplicate free agents`);
  const me = s.clubs[s.userClubId]!;
  if (me.squad.length > SQUAD_MAX) fail(`${where}: user squad ${me.squad.length} > max`);
  if (s.phase !== "departures" && me.squad.length < SQUAD_MIN) fail(`${where}: user squad ${me.squad.length} < min (phase ${s.phase})`);
  // During contract decisions the squad can dip under 13; finishDepartures refills and re-picks.
  const lineupMatters = !(s.phase === "departures" && me.squad.length < 13);
  if (lineupMatters && (s.lineup.length !== 13 || new Set(s.lineup).size !== 13 || !s.lineup.every((id) => me.squad.includes(id))))
    fail(`${where}: bad lineup (${s.lineup.length}, uniq ${new Set(s.lineup).size}, notInSquad ${s.lineup.filter((id) => !me.squad.includes(id)).length}, squad ${me.squad.length}, phase ${s.phase})`);
  if (!Number.isFinite(s.budget)) fail(`${where}: budget ${s.budget}`);
  for (const id of me.squad) {
    const p = s.players[id];
    if (!p) continue;
    const c = contractOf(p);
    if (!(c >= 1 && c <= 4) && !(s.phase === "departures" && s.departures?.expiring.includes(id)))
      fail(`${where}: ${p.name} contract ${c} (phase ${s.phase})`);
  }
  if (s.phase === "departures") {
    if (!s.departures) fail(`${where}: departures phase without departures data`);
    for (const id of s.departures?.expiring ?? []) if (!me.squad.includes(id)) fail(`${where}: expiring ${id} not in squad`);
  }
  // Stages must always resolve to something the UI can show.
  if (s.phase === "season") {
    const st = currentStage(s);
    if (!["preseason", "preseason-done", "deadline", "league-over", "promotion", "fixture"].includes(st)) fail(`${where}: odd stage ${st}`);
  }
  // Deadline Day clock: sane numbers, offers only for your players from real clubs.
  if (s.phase === "season" && isDeadlineDay(s)) {
    const c = deadlineClock(s);
    if (!(c.minutesLeft >= 0 && c.minutesLeft <= DEADLINE_MINUTES)) fail(`${where}: deadline clock at ${c.minutesLeft}`);
    if (c.slotsDone < 0 || c.slotsDone > 24) fail(`${where}: deadline slots ${c.slotsDone}`);
    if (deadlineDecisionPending(s) && c.minutesLeft === 0) fail(`${where}: clock at 0:00 but the window is still open`);
    for (const o of liveOffers(s)) {
      if (!s.clubs[o.clubId] || o.clubId === s.userClubId) fail(`${where}: offer from ${o.clubId}`);
      if (!me.squad.includes(o.playerId)) fail(`${where}: live offer for a player you don't have`);
      if (!(o.fee > 0)) fail(`${where}: offer fee ${o.fee}`);
    }
    if (!deadlineDecisionPending(s) && isWindowOpen(s)) fail(`${where}: window still open after Deadline Day shut`);
  }
  if ((s.stagesSeen?.length ?? 0) > 12) fail(`${where}: stagesSeen grew to ${s.stagesSeen!.length}`);
  if (!isCareer(JSON.parse(JSON.stringify(s)))) fail(`${where}: save no longer passes its own validation (phase ${s.phase})`);
}

/** Sell, and check he really went where we said, to a club that wanted him. */
function checkedSell(s: CareerState, id: string): CareerState {
  const p = s.players[id];
  const r = sellPlayer(s, id);
  if (r.error || !p) return r.state;
  if (p.legend) {
    if (r.state.players[id]) fail("sell: legend still exists after the sale");
    return r.state;
  }
  if (r.soldTo) {
    const holders = Object.values(r.state.clubs).filter((c) => c.squad.includes(id)).map((c) => c.id);
    if (holders.length !== 1 || holders[0] !== r.soldTo) fail(`sell: ${p.name} said to join ${r.soldTo}, is at ${holders.join(",") || "nowhere"}`);
    if (r.soldTo === s.userClubId) fail("sell: sold to yourself");
    if (!r.reason) fail("sell: no reason given");
    const need = clubNeed(s, r.soldTo, p);
    if (!need && !/^after cover/.test(r.reason ?? "")) fail(`sell: ${s.clubs[r.soldTo]!.name} didn't need a ${p.pos}`);
    if (!r.state.news[0]?.includes(r.state.clubs[r.soldTo]!.name)) fail("sell: news line doesn't name the buyer");
  } else if (!r.state.freeAgents.includes(id)) fail(`sell: ${p.name} vanished`);
  return r.state;
}

/** Every UI action that the current state allows, as closures. */
function actionsFor(s: CareerState, rng: () => number, legends: string[]): Array<[string, () => CareerState]> {
  const out: Array<[string, () => CareerState]> = [];
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!;
  if (s.phase === "season") {
    const st = currentStage(s);
    if (st === "preseason") {
      const opts = friendlyOptions(s);
      out.push(["friendlies-2", () => playFriendlies(s, opts.slice(0, 2))]);
      out.push(["friendlies-skip", () => playFriendlies(s, [])]);
      out.push(["friendlies-5 (cheat)", () => playFriendlies(s, opts)]);
    }
    if (st === "preseason-done") out.push(["start-season", () => markStageSeen(s, "preseason")]);
    if (st === "league-over") out.push(["pass-league-over", () => markStageSeen(s, "league-over")]);
    if (st === "promotion") out.push(["pass-promotion", () => markStageSeen(s, "promotion")]);
    if (st === "deadline") {
      out.push(["shut-window", () => closeDeadlineDay(s)]);
      out.push(["tick-10", () => tickDeadline(s, 10)]);
      out.push(["tick-10b", () => tickDeadline(s, 10)]);
      out.push(["tick-60", () => tickDeadline(s, 60)]);
      out.push(["tick-huge", () => tickDeadline(s, 5000)]);
      out.push(["tick-bad", () => tickDeadline(s, Number.NaN)]);
      out.push(["pause", () => pauseDeadline(s, rng() < 0.5)]);
      const offers = liveOffers(s);
      if (offers.length) {
        out.push(["accept-offer", () => { const n = acceptOffer(s, pick(offers).id).state; return { ...n, lineup: repairLineup(n, n.lineup) }; }]);
        out.push(["reject-offer", () => rejectOffer(s, pick(offers).id)]);
      }
      out.push(["accept-stale-offer", () => acceptOffer(s, "nope").state]);
    }
    // The engine shouldn't care what the UI shows: play anyway.
    out.push(["play", () => playMatchday(s)]);
    out.push(["sim-big", () => simToNextBigGame(s)]);
    if (rng() < 0.05) out.push(["sim-rest", () => simRestOfSeason(s)]);
    if (s.incomingBid) {
      out.push(["accept-bid", () => { const n = acceptBid(s); return { ...n, lineup: repairLineup(n, n.lineup) }; }]);
      out.push(["reject-bid", () => rejectBid(s)]);
    }
    if (isWindowOpen(s)) {
      const m = buildMarket(s, legends, `mid-${s.matchdayIndex}`);
      if (m.length) out.push(["mid-buy", () => buyPlayer(s, pick(m)).state]);
      const me = s.clubs[s.userClubId]!;
      out.push(["mid-sell", () => checkedSell(s, pick(me.squad))]);
    }
    // Out-of-order calls that must be no-ops.
    out.push(["finishDepartures-in-season", () => finishDepartures(s)]);
    out.push(["finishTransfers-in-season", () => finishTransfers(s)]);
    out.push(["beginOffseason-in-season", () => beginOffseason(s)]);
  } else if (s.phase === "review") {
    out.push(["to-offseason", () => beginOffseason(s)]);
    out.push(["play-in-review", () => playMatchday(s)]);
  } else if (s.phase === "departures") {
    const exp = s.departures?.expiring ?? [];
    if (exp.length) {
      out.push(["renew", () => renewContract(s, pick(exp)).state]);
      out.push(["release", () => releaseExpiring(s, pick(exp))]);
    }
    const me = s.clubs[s.userClubId]!;
    out.push(["renew-not-expiring", () => renewContract(s, pick(me.squad)).state]);
    out.push(["release-not-expiring", () => releaseExpiring(s, pick(me.squad))]);
    out.push(["finish-departures", () => finishDepartures(s)]);
    out.push(["beginOffseason-again", () => beginOffseason(s)]);
    out.push(["finishTransfers-early", () => finishTransfers(s)]);
    out.push(["sell-in-departures", () => sellPlayer(s, pick(me.squad)).state]);
  } else if (s.phase === "transfers") {
    const m = buildMarket(s, legends);
    if (m.length) out.push(["buy", () => buyPlayer(s, pick(m)).state]);
    const me = s.clubs[s.userClubId]!;
    out.push(["sell", () => checkedSell(s, pick(me.squad))]);
    out.push(["finish-transfers", () => finishTransfers(s)]);
    out.push(["renew-in-transfers", () => renewContract(s, pick(me.squad)).state]);
  }
  return out;
}

/* A) random walks through several seasons, every club type */
const clubs = buildWorld("probe").choices.map((c) => c.id);
const t0 = Date.now();
let steps = 0;
for (let run = 0; run < 36; run++) {
  const rng = seedrandom(`break-${run}`);
  const club = clubs[Math.floor(rng() * clubs.length)]!;
  const legends = run % 4 === 0 ? legendCatalog().slice(0, 4).map((l) => l.id) : [];
  let s = createCareer({ clubId: club, managerName: "Breaker", seed: `break-${run}` });
  if (run % 5 === 0) s = { ...s, budget: 5_000_000 };
  if (run % 7 === 0) s = { ...s, budget: 0 };
  let season = 1;
  for (let i = 0; i < 2500 && season <= 4; i++) {
    const acts = actionsFor(s, rng, legends);
    const [name, fn] = acts[Math.floor(rng() * acts.length)]!;
    const before = s.phase;
    try {
      s = fn();
    } catch (e) {
      fail(`run ${run} (${club}) S${season} ${before}: ${name} threw ${e instanceof Error ? e.message : e}`);
      break;
    }
    steps++;
    invariants(s, `run ${run} S${season} ${name}`);
    if (before === "transfers" && s.phase === "season") season++;
  }
}
notes.push(`A) random walks: ${steps} actions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

/* B) targeted checks */
{
  // Renewing everyone, every summer, for 8 seasons: squad keeps its stars, budget can go negative?
  let s = createCareer({ clubId: "wigan-warriors", managerName: "Loyal", seed: "loyal" });
  let minBudget = s.budget;
  let renewals = 0;
  let unaffordable = 0;
  for (let season = 0; season < 8; season++) {
    for (let g = 0; s.phase === "season" && g < 6; g++) s = simRestOfSeason(closeDeadlineDay(s));
    s = beginOffseason(s);
    for (const id of [...(s.departures?.expiring ?? [])]) {
      const r = renewContract(s, id);
      if (r.error === "budget") unaffordable++;
      else if (!r.error) renewals++;
      s = r.state;
    }
    s = finishTransfers(finishDepartures(s));
    minBudget = Math.min(minBudget, s.budget);
  }
  notes.push(`B1) renew-everyone over 8 seasons: ${renewals} renewals, ${unaffordable} unaffordable, lowest budget £${(minBudget / 1000).toFixed(0)}k`);
  invariants(s, "B1 end");
}
{
  // Let everyone go every summer: squad must stay playable.
  let s = createCareer({ clubId: "leeds-rhinos", managerName: "Ruthless", seed: "ruthless" });
  let left = 0;
  for (let season = 0; season < 6; season++) {
    for (let g = 0; s.phase === "season" && g < 6; g++) s = simRestOfSeason(closeDeadlineDay(s));
    s = beginOffseason(s);
    left += s.departures?.expiring.length ?? 0;
    s = finishTransfers(finishDepartures(s));
    invariants(s, `B2 S${season}`);
  }
  notes.push(`B2) let-everyone-go over 6 seasons: ${left} players left; final XIII rating checked by invariants`);
}
{
  // Old save (v1.05 shape): no contracts, no stagesSeen, mid-season and in the transfer window.
  let s = createCareer({ clubId: "hull-fc", managerName: "Old", seed: "old" });
  for (const p of Object.values(s.players)) delete p.contract;
  delete s.stagesSeen;
  s = playFriendlies(s, []);
  if (currentStage(s) !== "fixture") fail(`B3: old save after skipping friendlies shows ${currentStage(s)}`);
  for (let g = 0; s.phase === "season" && g < 6; g++) s = simRestOfSeason(closeDeadlineDay(s));
  s = beginOffseason(s);
  if (!s.departures) fail("B3: old save reached departures without data");
  s = finishTransfers(finishDepartures(s));
  invariants(s, "B3 old save");
  // An old save that was already sitting in the transfer window when the update landed.
  let t = createCareer({ clubId: "hull-fc", managerName: "Old2", seed: "old2" });
  for (let g = 0; t.phase === "season" && g < 6; g++) t = simRestOfSeason(closeDeadlineDay(t));
  t = finishDepartures(beginOffseason(t));
  for (const p of Object.values(t.players)) delete p.contract;
  delete t.departures;
  t = finishTransfers(t);
  invariants(t, "B3 old window save");
}
{
  // Deadline Day: reload-equivalent (JSON round trip) keeps the pause; shutting twice is harmless.
  let s = createCareer({ clubId: "st-helens", managerName: "DD", seed: "dd" });
  s = markStageSeen(playFriendlies(s, friendlyOptions(s).slice(0, 1)), "preseason");
  for (let g = 0; g < 60 && !deadlineDecisionPending(s); g++) s = playMatchday(s);
  const at = s.matchdayIndex;
  const reloaded = JSON.parse(JSON.stringify(s)) as CareerState;
  if (currentStage(reloaded) !== "deadline") fail("B4: Deadline Day stage lost after a reload");
  const tried = playMatchday(reloaded);
  if (tried.matchdayIndex !== at) fail("B4: a matchday was played during Deadline Day");
  const once = closeDeadlineDay(s);
  const twice = closeDeadlineDay(once);
  if (JSON.stringify({ ...once, updatedAt: 0 }) !== JSON.stringify({ ...twice, updatedAt: 0 })) fail("B4: shutting the window twice changed the save");
}
{
  // Stage keys are per year: next season's pre-season results stage still appears.
  let s = createCareer({ clubId: "warrington-wolves", managerName: "Y2", seed: "y2" });
  s = markStageSeen(playFriendlies(s, friendlyOptions(s).slice(0, 2)), "preseason");
  for (let g = 0; s.phase === "season" && g < 200; g++) {
    const st = currentStage(s);
    if (st === "deadline") s = closeDeadlineDay(s);
    else if (st === "league-over") s = markStageSeen(s, "league-over");
    else if (st === "promotion") s = markStageSeen(s, "promotion");
    else s = playMatchday(s);
  }
  s = finishTransfers(finishDepartures(beginOffseason(s)));
  if (!preseasonOpen(s)) fail("B5: season 2 doesn't open on pre-season");
  s = playFriendlies(s, friendlyOptions(s).slice(0, 1));
  if (currentStage(s) !== "preseason-done") fail(`B5: season 2 friendly results stage missing (got ${currentStage(s)})`);
  // League-over and promotion appear in season 2 as well.
  s = markStageSeen(s, "preseason");
  const seenStages = new Set<string>();
  for (let g = 0; s.phase === "season" && g < 200; g++) {
    const st = currentStage(s);
    seenStages.add(st);
    if (st === "deadline") s = closeDeadlineDay(s);
    else if (st === "league-over") s = markStageSeen(s, "league-over");
    else if (st === "promotion") s = markStageSeen(s, "promotion");
    else s = playMatchday(s);
  }
  for (const st of ["deadline", "league-over", "promotion"]) if (!seenStages.has(st)) fail(`B5: season 2 never showed ${st}`);
}
{
  // The promotion picture must match what really happens, across many seeds.
  let mismatches = 0;
  for (let i = 0; i < 12; i++) {
    let s = createCareer({ clubId: clubs[i * 3]!, managerName: "P", seed: `promo-${i}` });
    s = playFriendlies(s, []);
    let pic: ReturnType<typeof promotionPicture> | null = null;
    let lo: ReturnType<typeof leagueOverPicture> | null = null;
    for (let g = 0; s.phase === "season" && g < 200; g++) {
      const st = currentStage(s);
      if (st === "deadline") s = closeDeadlineDay(s);
      else if (st === "league-over") {
        lo = leagueOverPicture(s);
        s = markStageSeen(s, "league-over");
      } else if (st === "promotion") {
        pic = promotionPicture(s);
        s = markStageSeen(s, "promotion");
      } else s = playMatchday(s);
    }
    if (!pic || !lo) {
      fail(`B6 seed ${i}: missing stage pictures`);
      continue;
    }
    for (const id of pic.up) if (s.clubs[id]!.division !== "super-league") mismatches++;
    for (const id of pic.down) if (s.clubs[id]!.division !== "championship") mismatches++;
    const o = s.lastOutcome!;
    if (o.position !== lo.position) fail(`B6 seed ${i}: league-over said ${lo.position}, outcome ${o.position}`);
    if (o.promoted !== pic.up.includes(s.userClubId)) fail(`B6 seed ${i}: promotion picture disagrees with outcome for the user`);
    if (o.relegated !== pic.down.includes(s.userClubId)) fail(`B6 seed ${i}: relegation picture disagrees with outcome for the user`);
  }
  if (mismatches) fail(`B6: ${mismatches} promotion/relegation mismatches`);
}
{
  // Friendlies exploits: replaying, picking the same club twice, playing after Round 1.
  let s = createCareer({ clubId: "castleford-tigers", managerName: "F", seed: "fr" });
  const opts = friendlyOptions(s);
  const b0 = s.budget;
  s = playFriendlies(s, [opts[0]!, opts[0]!, opts[0]!]);
  const once = s.budget - b0;
  s = playFriendlies(s, [opts[1]!]);
  if (s.budget - b0 !== once) fail("B7: friendlies paid out twice");
  if ((s.preseason?.results.length ?? 0) > 2) fail("B7: more than two friendlies played");
  if (new Set(s.preseason?.results.map((r) => r.opponentId)).size !== (s.preseason?.results.length ?? 0)) fail("B7: same friendly opponent twice");
}
{
  // Contract money: renewal fee can't push the budget negative, and a renewal isn't free.
  let s = createCareer({ clubId: "wigan-warriors", managerName: "M", seed: "money" });
  for (let g = 0; s.phase === "season" && g < 6; g++) s = simRestOfSeason(closeDeadlineDay(s));
  s = beginOffseason(s);
  const exp = s.departures?.expiring ?? [];
  if (exp.length) {
    const poor = { ...s, budget: renewalFee(s.players[exp[0]!]!) - 1 };
    const r = renewContract(poor, exp[0]!);
    if (!r.error) fail("B8: renewed without enough budget");
    const rich = renewContract(s, exp[0]!);
    if (!rich.error && rich.state.budget >= s.budget) fail("B8: renewal was free");
    const again = renewContract(rich.state, exp[0]!);
    if (!again.error) fail("B8: renewed the same player twice");
  } else notes.push("B8: no expiring contracts for this seed (skipped)");
}

{
  // B9: every sale goes to a real club that needs the position, and says so.
  let sold = 0;
  let needy = 0;
  for (let i = 0; i < 6; i++) {
    let s = createCareer({ clubId: clubs[i * 5]!, managerName: "Seller", seed: `sell-${i}` });
    for (let g = 0; s.phase === "season" && g < 6; g++) s = simRestOfSeason(closeDeadlineDay(s));
    s = { ...finishDepartures(beginOffseason(s)), budget: 20_000_000 };
    // Fill the squad up first so there's someone to sell.
    for (const l of buildMarket(s, []).slice(0, 10)) s = buyPlayer(s, l).state;
    for (let k = 0; k < 6; k++) {
      const me = s.clubs[s.userClubId]!;
      if (me.squad.length <= SQUAD_MIN) break;
      const id = me.squad[(k * 7) % me.squad.length]!;
      const p = s.players[id]!;
      const before = s;
      s = checkedSell(s, id);
      if (s === before) continue;
      sold++;
      const to = Object.values(s.clubs).find((c) => c.squad.includes(id));
      if (to && clubNeed(before, to.id, p)) needy++;
    }
    invariants(s, `B9 seed ${i}`);
  }
  if (sold < 20) fail(`B9: only ${sold} sales tested`);
  if (needy < sold * 0.9) fail(`B9: only ${needy}/${sold} sales went to a club that needed the player`);
  notes.push(`B9) ${sold} sales: ${needy} to a club short in that position or upgrading there`);
}
{
  // B10: Deadline Day clock. Counts down from 12:00, offers land and lapse, deals land, shuts at 0:00,
  // and the same save gives the same day whether you tick in 10s or skip hours.
  let offersSeen = 0;
  let accepted = 0;
  let wars = 0;
  for (let i = 0; i < 8; i++) {
    let s = createCareer({ clubId: clubs[i * 4 + 1]!, managerName: "DD", seed: `clock-${i}` });
    s = playFriendlies(s, []);
    for (let g = 0; g < 80 && !deadlineDecisionPending(s); g++) s = playMatchday(s);
    if (!deadlineDecisionPending(s)) { fail(`B10 seed ${i}: never reached Deadline Day`); continue; }
    if (deadlineClock(s).minutesLeft !== DEADLINE_MINUTES) fail(`B10 seed ${i}: clock starts at ${deadlineClock(s).minutesLeft}`);
    const start = s;
    const ids = new Set<string>();
    let last = DEADLINE_MINUTES;
    for (let t = 0; t < 100 && deadlineDecisionPending(s); t++) {
      for (const o of liveOffers(s)) {
        if (!ids.has(o.id)) {
          ids.add(o.id);
          offersSeen++;
          if (o.raised) wars++;
        }
      }
      const offers = liveOffers(s);
      if (offers.length && t % 5 === 0) {
        const o = offers[0]!;
        const buyerBefore = s.clubs[o.clubId]!.squad.length;
        const budget = s.budget;
        // The fee lands, and the rest of his season's wages come off the bill.
        const wagesSaved = wagesDueNow(s, s.players[o.playerId]!);
        const r = acceptOffer(s, o.id);
        if (!r.error) {
          accepted++;
          s = { ...r.state, lineup: repairLineup(r.state, r.state.lineup) };
          if (!s.clubs[o.clubId]!.squad.includes(o.playerId)) fail("B10: accepted player didn't join the bidder");
          if (s.clubs[o.clubId]!.squad.length !== buyerBefore + 1) fail("B10: bidder squad size wrong");
          if (s.budget !== budget + o.fee + wagesSaved) fail("B10: fee (plus wages saved) not paid");
          if (liveOffers(s).some((x) => x.playerId === o.playerId)) fail("B10: other offers for a sold player still live");
          if (!acceptOffer(s, o.id).error) fail("B10: accepted the same offer twice");
        }
      }
      s = tickDeadline(s, 10);
      const c = deadlineClock(s);
      if (deadlineDecisionPending(s) && c.minutesLeft !== last - 10) fail(`B10: clock went ${last} → ${c.minutesLeft}`);
      last = c.minutesLeft;
      invariants(s, `B10 seed ${i} t${t}`);
    }
    if (deadlineDecisionPending(s)) fail(`B10 seed ${i}: window still open after 12 hours`);
    if (isWindowOpen(s)) fail(`B10 seed ${i}: market still open after 0:00`);
    // Same day, two ways (no user actions): ten-minute ticks vs hour skips vs shutting at once.
    const a = (() => { let x = start; while (deadlineDecisionPending(x)) x = tickDeadline(x, 10); return x; })();
    const b = (() => { let x = start; while (deadlineDecisionPending(x)) x = tickDeadline(x, 60); return x; })();
    const shut = closeDeadlineDay(start);
    const aiDeals = (x: CareerState) => JSON.stringify((x.transfers ?? []).filter((d) => d.year === x.year && d.deadlineDay && !d.user));
    if (aiDeals(a) !== aiDeals(b)) fail(`B10 seed ${i}: ticking speed changed the day's deals`);
    if (aiDeals(a) !== aiDeals(shut)) fail(`B10 seed ${i}: shutting early changed the league's deals`);
    if (liveOffers(shut).length) fail(`B10 seed ${i}: offers left after shutting`);
    const dd = JSON.parse(aiDeals(a)) as unknown[];
    if (dd.length < 3) fail(`B10 seed ${i}: Deadline Day too quiet (${dd.length} deals)`);
    // Pausing doesn't change anything on its own; old saves without a clock still work.
    const paused = pauseDeadline(start, true);
    if (!deadlineClock(paused).paused || pauseDeadline(paused, true) !== paused) fail("B10: pause not idempotent");
    const old = JSON.parse(JSON.stringify(start)) as CareerState;
    delete old.deadline;
    const oldShut = closeDeadlineDay(old);
    if (deadlineDecisionPending(oldShut)) fail("B10: old save can't shut Deadline Day");
    if (deadlineClock(tickDeadline(old, 30)).minutesLeft !== DEADLINE_MINUTES - 30) fail("B10: old save clock doesn't start");
  }
  if (offersSeen < 8) fail(`B10: only ${offersSeen} offers in 8 Deadline Days`);
  notes.push(`B10) 8 Deadline Days: ${offersSeen} offers (${wars} bidding wars, ${accepted} accepted); same day at any tick speed`);
}

console.log(notes.join("\n"));
if (problems.length) {
  const counts = new Map<string, number>();
  for (const p of problems) {
    const key = p.replace(/run \d+[^:]*:/, "run N:").replace(/S\d+/g, "S").replace(/\d+/g, "#");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`\nPROBLEMS (${problems.length}, ${counts.size} kinds):`);
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`- ×${n} ${k}`);
  console.log("\nFirst few in full:");
  for (const p of problems.slice(0, 15)) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nNO PROBLEMS FOUND");
