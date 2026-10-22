/** Live match engine: always finishes, deterministic per choices, scores in line with the instant sim. */
import { buildWorld, createCareer } from "../src/lib/career/world";
import { aiLineup, sheetFor } from "../src/lib/career/season";
import { simulateMatch } from "../src/lib/career/match";
import { createLiveMatch, liveResult, playToEnd, resolveCall, stepMinute } from "../src/lib/career/live-match";
import { rngFor } from "../src/lib/career/rng";

let passed = 0;
const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const ok = (msg: string) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

const clubId = buildWorld("live-test").choices.find((c) => c.division === "super-league")!.id;
const s = createCareer({ clubId, managerName: "Test", seed: "live-test" });
const opponents = Object.values(s.clubs).filter((c) => c.division === "super-league" && c.id !== s.userClubId).map((c) => c.id);
const home = sheetFor(s, s.userClubId);

function run(i: number, pick: (n: number, r: () => number) => number, knockout = false) {
  const opp = opponents[i % opponents.length]!;
  const away = { clubId: opp, lineup: aiLineup(s, opp), tactic: "balanced" as const };
  const rng = rngFor("live", i);
  const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "home", knockout, players: s.players, rng });
  let calls = 0;
  let guard = 0;
  while (!m.finished && guard++ < 500) {
    if (m.pending) {
      calls++;
      resolveCall(m, m.pending.options[pick(m.pending.options.length, rng)]!.id, rng, s.players);
    } else stepMinute(m, rng, s.players);
  }
  if (!m.finished) fail(`match ${i} never finished`);
  return { m, calls, result: liveResult(m, rng, s.players) };
}

// Always finishes with exactly three calls, scores add up, tries credited.
for (let i = 0; i < 300; i++) {
  const { m, calls, result } = run(i, (n, r) => Math.floor(r() * n), i % 3 === 0);
  if (calls !== 3) fail(`match ${i}: expected 3 calls, got ${calls}`);
  if (m.minute !== 80) fail(`match ${i}: ended at minute ${m.minute}`);
  if (result.homeTries.length * 4 > result.homeScore || result.awayTries.length * 4 > result.awayScore) fail(`match ${i}: tries exceed score`);
  if (i % 3 === 0 && result.homeScore === result.awayScore) fail(`knockout ${i} ended level`);
  for (const id of [...result.homeTries, ...result.awayTries]) if (!s.players[id]) fail(`match ${i}: unknown scorer ${id}`);
}
ok("300 matches finish at 80', three calls each, knockouts never level, valid scorers");

// Deterministic: same seed + same calls → same match.
const a = run(7, () => 1).result;
const b = run(7, () => 1).result;
if (JSON.stringify(a) !== JSON.stringify(b)) fail("same calls gave different results");
ok("same seed and calls → same result");

// Skip uses the default option and still finishes.
{
  const rng = rngFor("skip");
  const away = { clubId: opponents[0]!, lineup: aiLineup(s, opponents[0]!), tactic: "balanced" as const };
  const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "away", knockout: true, players: s.players, rng });
  playToEnd(m, rng, s.players);
  if (!m.finished || m.callsDone.length !== 3) fail("skip to full time didn't finish with three calls");
  ok("skip to full time finishes");
}

// Balance: live (default calls) within a few points of the instant sim's win rate.
let simW = 0;
let liveW = 0;
const N = 1200;
for (let i = 0; i < N; i++) {
  const opp = opponents[i % opponents.length]!;
  const away = { clubId: opp, lineup: aiLineup(s, opp), tactic: "balanced" as const };
  const r = simulateMatch(rngFor("bal", i), home, away, s.players, { knockout: false });
  if (r.homeScore > r.awayScore) simW++;
  const rng = rngFor("bal-live", i);
  const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "home", knockout: false, players: s.players, rng });
  playToEnd(m, rng, s.players);
  if (m.homeScore > m.awayScore) liveW++;
}
const gap = (liveW - simW) / N;
console.log(`    sim ${((simW / N) * 100).toFixed(1)}% · live ${((liveW / N) * 100).toFixed(1)}%`);
if (gap < -0.03 || gap > 0.09) fail(`live win rate is ${(gap * 100).toFixed(1)} points off the instant sim`);
ok("live win rate stays close to the instant sim");

console.log(`\n${passed} passed`);
