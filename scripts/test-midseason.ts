/** In-season transfers: Deadline Day only. AI deals land, offers work, squads stay legal, last line-ups recorded. */
import { buildWorld, createCareer } from "../src/lib/career/world";
import { playMatchday, repairLineup } from "../src/lib/career/season";
import { SQUAD_MAX, SQUAD_MIN } from "../src/lib/career/players";
import { acceptOffer, closeDeadlineDay, deadlineDecisionPending, isDeadlineDay, isWindowOpen, liveOffers, rejectOffer, seasonDeals, tickDeadline, windowBounds, windowStatus } from "../src/lib/career/midseason";
import { beginOffseason, buildMarket, buyPlayer, finishDepartures, finishTransfers, isFreeAgentListing, sellPlayer } from "../src/lib/career/offseason";
import { playerWage, seasonWageShareLeft, wagesDueNow } from "../src/lib/career/players";
import { simRestOfSeason } from "../src/lib/career/season";
import type { CareerState } from "../src/lib/career/types";

let passed = 0;
const fail = (m: string) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};
const ok = (m: string) => {
  passed++;
  console.log(`  ✓ ${m}`);
};

function checkWorld(s: CareerState, where: string) {
  const seen = new Map<string, string>();
  for (const club of Object.values(s.clubs)) {
    if (club.id !== s.userClubId && (club.squad.length < SQUAD_MIN || club.squad.length > SQUAD_MAX)) fail(`${where}: ${club.name} squad ${club.squad.length}`);
    for (const id of club.squad) {
      if (!s.players[id]) fail(`${where}: ${club.name} has unknown player ${id}`);
      if (seen.has(id)) fail(`${where}: ${id} in ${seen.get(id)} and ${club.name}`);
      seen.set(id, club.name);
    }
  }
  for (const id of s.freeAgents) if (seen.has(id)) fail(`${where}: free agent ${id} also at ${seen.get(id)}`);
}

const choices = buildWorld("mid-test").choices;
let totalDeals = 0;
let deadlineDeals = 0;
let bidsSeen = 0;
let accepted = 0;
for (const [n, choice] of choices.filter((_, i) => i % 4 === 0).slice(0, 8).entries()) {
  let s = createCareer({ clubId: choice.id, managerName: "T", seed: `mid-${n}` });
  const b = windowBounds(s);
  if (!b) fail("no window bounds");
  let guard = 0;
  let sawDeadline = false;
  while (s.phase === "season" && guard++ < 80) {
    if (isDeadlineDay(s)) sawDeadline = true;
    // Open only in pre-season (before Round 1 kicks off) and on Deadline Day.
    if (!isDeadlineDay(s) && s.matchdayIndex > 0 && isWindowOpen(s)) fail(`window open away from Deadline Day (md ${s.matchdayIndex})`);
    if (s.matchdayIndex === 0 && windowStatus(s).kind !== "preseason") fail("window not open in pre-season");
    // Deadline Day: run the clock, answering every offer (accept every other one).
    const seenOffers = new Set<string>();
    for (let t = 0; t < 80 && deadlineDecisionPending(s); t++) {
      for (const o of liveOffers(s)) {
        if (seenOffers.has(o.id)) continue;
        seenOffers.add(o.id);
        bidsSeen++;
        const before = s.budget;
        if (bidsSeen % 2 === 0) {
          const r = acceptOffer(s, o.id);
          if (!r.error) {
            s = { ...r.state, lineup: repairLineup(r.state, r.state.lineup) };
            if (s.budget <= before) fail("accepting an offer didn't pay");
            accepted++;
          }
        } else {
          s = rejectOffer(s, o.id);
        }
        if (liveOffers(s).some((x) => x.id === o.id)) fail("offer still open after answering");
      }
      s = tickDeadline(s, 10);
    }
    if (isDeadlineDay(s) && isWindowOpen(s)) fail("window still open after Deadline Day's clock ran out");
    s = playMatchday(closeDeadlineDay(s));
    checkWorld(s, `${choice.id} md${s.matchdayIndex}`);
    if (s.lineup.length !== 13 && s.phase === "season") fail(`user lineup has ${s.lineup.length}`);
  }
  if (!sawDeadline) fail(`${choice.id}: never reached Deadline Day`);
  const deals = seasonDeals(s);
  totalDeals += deals.length;
  deadlineDeals += deals.filter((d) => d.deadlineDay).length;
  for (const d of deals) {
    if (d.at !== b!.deadline) fail(`deal away from Deadline Day at ${d.at}`);
    if (d.to && d.to !== s.userClubId && !s.clubs[d.to]) fail("deal to unknown club");
  }
  const ll = s.lastLineups ?? {};
  for (const id of Object.keys(s.clubs)) if (!ll[id] || ll[id]!.lineup.length !== 13) fail(`${id}: no last line-up`);
}
ok(`8 seasons: ${totalDeals} AI/user deals, ${deadlineDeals} on Deadline Day, squads always legal, no player at two clubs`);
if (totalDeals < 8 * 4) fail(`too few deals (${totalDeals})`);
ok(`about ${Math.round(totalDeals / 8)} deals a season`);
if (deadlineDeals !== totalDeals) fail("a deal happened away from Deadline Day");
if (deadlineDeals < 8 * 3) fail(`Deadline Day too quiet (${deadlineDeals})`);
ok(`Deadline Day averages ${(deadlineDeals / 8).toFixed(1)} deals`);
if (bidsSeen < 4) fail(`only ${bidsSeen} offers in 8 Deadline Days`);
ok(`${bidsSeen} Deadline Day offers (${accepted} accepted) handled`);
ok("every club has a 13-man last team sheet at season end");

// Determinism: same save, same deals (both runs start from one saved state).
const start = createCareer({ clubId: choices[0]!.id, managerName: "T", seed: "det" });
const playOut = () => {
  let s = structuredClone(start);
  for (let i = 0; i < 20; i++) s = playMatchday(closeDeadlineDay(s));
  return JSON.stringify(seasonDeals(s));
};
const a = playOut();
const b2 = playOut();
if (a !== b2) fail("deals differ for the same save");
ok("same save → same deals");
// The window schedule, three seasons running: open in the summer + pre-season, shut from Round 1,
// open on Deadline Day, shut after it until the next summer. AI clubs only deal while it's open.
{
  let s = createCareer({ clubId: choices[3]!.id, managerName: "T", seed: "windows" });
  const aiSquads = (st: CareerState) =>
    JSON.stringify(Object.values(st.clubs).filter((c) => c.id !== st.userClubId).map((c) => [c.id, c.squad]));
  let summerAiSignings = 0;
  for (let season = 1; season <= 3; season++) {
    const year = s.year;
    const seen = { preseason: 0, shutBefore: 0, deadline: 0, shutAfter: 0 };
    let guard = 0;
    while (s.phase === "season" && guard++ < 80) {
      const w = windowStatus(s);
      const b = windowBounds(s)!;
      if (s.matchdayIndex === 0) {
        if (!(w.open && w.kind === "preseason")) fail(`S${season}: pre-season window not open`);
        seen.preseason++;
      } else if (deadlineDecisionPending(s)) {
        if (!(w.open && w.kind === "deadline")) fail(`S${season}: Deadline Day window not open`);
        seen.deadline++;
        s = closeDeadlineDay(s);
        if (isWindowOpen(s)) fail(`S${season}: window open after Deadline Day shut`);
      } else if (s.matchdayIndex < b.deadline) {
        if (w.open || !/Deadline Day/.test(w.detail)) fail(`S${season}: md ${s.matchdayIndex} should be shut until Deadline Day (${w.detail})`);
        seen.shutBefore++;
      } else {
        if (w.open || !/after the season/.test(w.detail)) fail(`S${season}: md ${s.matchdayIndex} should be shut until next season (${w.detail})`);
        seen.shutAfter++;
      }
      // Playing a round never moves a player between AI clubs (the window is shut, or it's pre-season
      // and nobody but you deals then).
      const before = aiSquads(s);
      const dealsBefore = (s.transfers ?? []).length;
      s = playMatchday(s);
      if (aiSquads(s) !== before) fail(`S${season}: AI squads changed while playing md ${s.matchdayIndex - 1}`);
      if ((s.transfers ?? []).length !== dealsBefore) fail(`S${season}: a deal landed while a round was played`);
      if (s.phase === "season" && s.matchdayIndex > 0 && !deadlineDecisionPending(s) && isWindowOpen(s)) fail(`S${season}: window open mid-season`);
    }
    if (!seen.preseason || !seen.shutBefore || !seen.deadline || !seen.shutAfter) fail(`S${season}: missing a window stage ${JSON.stringify(seen)}`);
    if (windowStatus(s).open) fail(`S${season}: window open at the season review`);
    s = beginOffseason(s);
    if (windowStatus(s).open || !/after the summer departures/.test(windowStatus(s).detail)) fail(`S${season}: window open during departures`);
    s = finishDepartures(s);
    if (!(windowStatus(s).open && windowStatus(s).kind === "summer")) fail(`S${season}: summer window not open`);
    s = finishTransfers(s);
    if (!(windowStatus(s).open && windowStatus(s).kind === "preseason")) fail(`S${season + 1}: pre-season window not open`);
    // Every AI deal ever logged happened in a window: the summer or Deadline Day.
    for (const d of s.transfers ?? []) {
      if (d.user) continue;
      if (!d.summer && !d.deadlineDay) fail(`AI deal outside a window: ${d.playerName} (${d.year} md ${d.at})`);
      if (d.summer && d.fee !== 0) fail(`AI summer free-agent signing with a fee: ${d.playerName} ${d.fee}`);
      if (!d.from && d.fee !== 0) fail(`AI paid a fee for a free agent: ${d.playerName} ${d.fee}`);
    }
    summerAiSignings += (s.transfers ?? []).filter((d) => d.summer && !d.user && d.year === year + 1).length;
    checkWorld(s, `windows S${season}`);
  }
  ok(`3 seasons: window open in summer + pre-season and on Deadline Day only; AI deals only in those windows`);
  if (summerAiSignings === 0) fail("AI clubs never signed a free agent in the summer window");
  ok(`AI clubs signed ${summerAiSignings} free agents in 3 summer windows, all for £0`);
}

// Deadline Day: a free agent costs no fee, only the rest of this season's wages; a sale saves them.
{
  let s = createCareer({ clubId: choices[1]!.id, managerName: "T", seed: "dd-free" });
  s = simRestOfSeason(s);
  if (!deadlineDecisionPending(s)) fail("didn't stop on Deadline Day");
  const share = seasonWageShareLeft(s);
  if (!(share > 0 && share < 1)) fail(`wage share on Deadline Day ${share}`);
  s = { ...s, budget: 5_000_000 };
  const market = buildMarket(s, [], "dd");
  const fa = market.find(isFreeAgentListing);
  if (fa) {
    if (fa.price !== 0) fail("Deadline Day free agent listed with a fee");
    const p = s.players[fa.playerId]!;
    const r = buyPlayer(s, fa);
    if (r.error) fail(`couldn't sign a free agent on Deadline Day: ${r.error}`);
    const due = wagesDueNow(s, p);
    if (due !== Math.round((playerWage(p) * share) / 1000) * 1000) fail("Deadline Day wages aren't the rest of the season's");
    if (r.state.budget !== s.budget - due) fail(`Deadline Day free agent cost more than wages: ${s.budget} → ${r.state.budget} (wages ${due})`);
    ok(`Deadline Day free agent: £0 fee, ${due} wages for the rest of the season`);
  } else ok("no free agents on this Deadline Day market (nothing to check)");
  const me = s.clubs[s.userClubId]!;
  const seller = me.squad.map((id) => s.players[id]!).sort((a, b) => a.rating - b.rating)[0]!;
  const sold = sellPlayer(s, seller.id);
  if (!sold.error) {
    if (sold.state.budget !== s.budget + (sold.fee ?? 0) + wagesDueNow(s, seller)) fail("a Deadline Day sale should bank the fee plus the wages saved");
    ok("Deadline Day sale banks the fee and the rest of his wages");
  }
  // And with the window shut, nobody can deal.
  const shut = playMatchday(closeDeadlineDay(s));
  if (buyPlayer(shut, market[0]!).error !== "window-shut") fail("bought with the window shut");
  if (sellPlayer(shut, shut.clubs[shut.userClubId]!.squad[0]!).error !== "window-shut") fail("sold with the window shut");
  ok("no buying or selling while the window is shut");
}

// Old saves: the window is worked out from phase + round alone (no stored flag needed).
{
  const s = createCareer({ clubId: choices[0]!.id, managerName: "T", seed: "old-save" });
  const legacy = { ...s, deadline: undefined, deadlineClosedYear: undefined } as CareerState;
  if (windowStatus(legacy).kind !== "preseason") fail("old save in pre-season: window should be open");
  const mid = playMatchday(playMatchday(legacy));
  if (windowStatus(mid).open) fail("old save mid-season: window should be shut");
  if (windowStatus({ ...mid, phase: "transfers" } as CareerState).kind !== "summer") fail("old save in the summer window: should be open");
  ok("saves from older versions get the right window from their phase and round");
}

console.log(`\n${passed} passed`);
