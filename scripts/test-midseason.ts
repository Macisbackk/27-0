/** Mid-season window: AI deals happen, Deadline Day is busy, bids work, squads stay legal, last line-ups recorded. */
import { buildWorld, createCareer } from "../src/lib/career/world";
import { playMatchday, repairLineup } from "../src/lib/career/season";
import { SQUAD_MAX, SQUAD_MIN } from "../src/lib/career/players";
import { acceptBid, isDeadlineDay, isWindowOpen, rejectBid, seasonDeals, windowBounds } from "../src/lib/career/midseason";
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
    if (s.incomingBid) {
      bidsSeen++;
      if (!isWindowOpen(s)) fail("bid outside the window");
      const before = s.budget;
      if (bidsSeen % 2 === 0) {
        s = acceptBid(s);
        s = { ...s, lineup: repairLineup(s, s.lineup) };
        if (s.budget <= before) fail("accepting a bid didn't pay");
        accepted++;
      } else {
        s = rejectBid(s);
      }
      if (s.incomingBid) fail("bid still open after answering");
    }
    s = playMatchday(s);
    checkWorld(s, `${choice.id} md${s.matchdayIndex}`);
    if (s.lineup.length !== 13 && s.phase === "season") fail(`user lineup has ${s.lineup.length}`);
  }
  if (!sawDeadline) fail(`${choice.id}: never reached Deadline Day`);
  const deals = seasonDeals(s);
  totalDeals += deals.length;
  deadlineDeals += deals.filter((d) => d.deadlineDay).length;
  for (const d of deals) {
    if (d.at < b!.open || d.at > b!.deadline) fail(`deal outside window at ${d.at}`);
    if (d.to && d.to !== s.userClubId && !s.clubs[d.to]) fail("deal to unknown club");
  }
  const ll = s.lastLineups ?? {};
  for (const id of Object.keys(s.clubs)) if (!ll[id] || ll[id]!.lineup.length !== 13) fail(`${id}: no last line-up`);
}
ok(`8 seasons: ${totalDeals} AI/user deals, ${deadlineDeals} on Deadline Day, squads always legal, no player at two clubs`);
if (totalDeals < 8 * 8) fail(`too few deals (${totalDeals})`);
ok(`about ${Math.round(totalDeals / 8)} deals a season`);
if (deadlineDeals < 8 * 3) fail(`Deadline Day too quiet (${deadlineDeals})`);
ok(`Deadline Day averages ${(deadlineDeals / 8).toFixed(1)} deals`);
if (bidsSeen < 4) fail(`only ${bidsSeen} bids in 8 seasons`);
ok(`${bidsSeen} rival bids (${accepted} accepted) handled`);
ok("every club has a 13-man last team sheet at season end");

// Determinism: same save, same deals (both runs start from one saved state).
const start = createCareer({ clubId: choices[0]!.id, managerName: "T", seed: "det" });
const playOut = () => {
  let s = structuredClone(start);
  for (let i = 0; i < 20; i++) s = playMatchday(s);
  return JSON.stringify(seasonDeals(s));
};
const a = playOut();
const b2 = playOut();
if (a !== b2) fail("deals differ for the same save");
ok("same save → same deals");
console.log(`\n${passed} passed`);
