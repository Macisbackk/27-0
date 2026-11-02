/** Live match engine: always finishes, deterministic per choices, scores in line with the instant sim. */
import { buildWorld, createCareer } from "../src/lib/career/world";
import { sheetFor } from "../src/lib/career/season";
import { simulateMatch } from "../src/lib/career/match";
import { ALL_CALL_IDS, benchLift, createLiveMatch, previewCall, liveResult, playToEnd, resolveCall, stepMinute, type LiveCallId } from "../src/lib/career/live-match";
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

const seenCalls = new Set<LiveCallId>();
function run(i: number, pick: (n: number, r: () => number) => number, knockout = false) {
  const opp = opponents[i % opponents.length]!;
  const away = sheetFor(s, opp);
  const rng = rngFor("live", i);
  const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "home", knockout, players: s.players, rng });
  let calls = 0;
  let guard = 0;
  while (!m.finished && guard++ < 500) {
    if (m.pending) {
      calls++;
      seenCalls.add(m.pending.id);
      resolveCall(m, m.pending.options[pick(m.pending.options.length, rng)]!.id, rng, s.players);
    } else stepMinute(m, rng, s.players);
  }
  if (!m.finished) fail(`match ${i} never finished`);
  return { m, calls, result: liveResult(m, rng, s.players) };
}

// Always finishes; between 4 and 9 calls; scores add up; tries credited.
const callCounts: number[] = [];
for (let i = 0; i < 600; i++) {
  const { m, calls, result } = run(i, (n, r) => Math.floor(r() * n), i % 3 === 0);
  callCounts.push(calls);
  if (calls < 4 || calls > 9) fail(`match ${i}: expected 4–9 calls, got ${calls}`);
  if (!m.callsDone.includes("team-talk") || !m.callsDone.includes("late")) fail(`match ${i}: missing team talk or late call`);
  if (result.homeScore < 0 || result.awayScore < 0) fail(`match ${i}: negative score`);
  if (m.minute !== 80) fail(`match ${i}: ended at minute ${m.minute}`);
  if (result.homeTries.length * 4 > result.homeScore || result.awayTries.length * 4 > result.awayScore) fail(`match ${i}: tries exceed score`);
  if (i % 3 === 0 && result.homeScore === result.awayScore) fail(`knockout ${i} ended level`);
  for (const id of [...result.homeTries, ...result.awayTries]) if (!s.players[id]) fail(`match ${i}: unknown scorer ${id}`);
}
ok(`600 matches finish at 80', ${Math.min(...callCounts)}–${Math.max(...callCounts)} calls each (avg ${(callCounts.reduce((a, b) => a + b, 0) / callCounts.length).toFixed(1)}), knockouts never level, valid scorers`);
const missing = ALL_CALL_IDS.filter((id) => !seenCalls.has(id));
if (missing.length) fail(`call types never seen in 600 matches: ${missing.join(", ")}`);
ok(`all ${ALL_CALL_IDS.length} call types turn up`);

// Deterministic: same seed + same calls → same match.
const a = run(7, () => 1).result;
const b = run(7, () => 1).result;
if (JSON.stringify(a) !== JSON.stringify(b)) fail("same calls gave different results");
ok("same seed and calls → same result");

// Skip uses the default option and still finishes.
{
  const rng = rngFor("skip");
  const away = sheetFor(s, opponents[0]!);
  const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "away", knockout: true, players: s.players, rng });
  playToEnd(m, rng, s.players);
  if (!m.finished || m.callsDone.length < 4) fail("skip to full time didn't finish with its calls");
  ok("skip to full time finishes");
}

// Balance: live (default calls) within a few points of the instant sim's win rate.
let simW = 0;
let liveW = 0;
const N = 1200;
for (let i = 0; i < N; i++) {
  const opp = opponents[i % opponents.length]!;
  const away = sheetFor(s, opp);
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

// Interchange: the moments name real bench players, and the lift depends on the bench.
{
  const bench = home.bench ?? [];
  if (bench.length !== 4) fail(`user sheet has ${bench.length} on the bench`);
  const benchNames = bench.map((id) => s.players[id]!.name);
  let named = 0;
  let subbed = 0;
  for (let i = 0; i < 3000 && (named < 3 || subbed < 3); i++) {
    const { m } = run(10_000 + i, () => 0);
    for (const e of m.events) {
      if (e.text.startsWith("Bench forwards on: ")) {
        if (!benchNames.some((n) => e.text.includes(n))) fail(`interchange names nobody from the bench: ${e.text}`);
        named++;
      }
      if (e.kind === "call" && / on for /.test(e.text)) {
        const sub = bench.find((id) => e.text.startsWith(s.players[id]!.name));
        if (!sub) fail(`injury change isn't a bench player: ${e.text}`);
        if (!m.home.lineup.includes(sub!) || (m.home.bench ?? []).includes(sub!)) fail("injury sub didn't move from the bench into the XIII");
        if (m.injured && m.home.lineup.includes(m.injured)) fail("injured player still in the XIII");
        if (home.lineup.includes(sub!)) fail("live injury change leaked into the saved team sheet");
        subbed++;
      }
    }
  }
  if (named < 3 || subbed < 3) fail(`interchange/injury moments too rare to check (${named}, ${subbed})`);
  const weak = { ...home, bench: bench.map(() => "") };
  const strong = { ...home, bench: [...home.lineup.slice(0, 4)] };
  const lifts = [benchLift(weak, s.players), benchLift(home, s.players), benchLift(strong, s.players)];
  if (!(lifts[0]! === 0 && lifts[1]! > 0 && lifts[2]! > lifts[1]!)) fail(`bench lift not monotonic: ${lifts.join(", ")}`);
  ok(`bench named in interchange (${named}) and injury changes (${subbed}); lift ${lifts.map((x) => x.toFixed(2)).join(" < ")}`);
}

// Every moment has 2–3 short options with hints, and every option's effect is bounded.
{
  const away = sheetFor(s, opponents[0]!);
  for (const id of ALL_CALL_IDS) {
    const m = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "home", knockout: true, players: s.players, rng: rngFor("opts", id) });
    m.minute = id === "golden-point" ? 80 : 50;
    m.injured = home.lineup[6];
    const call = previewCall(m, id, s.players);
    if (call.options.length < 2 || call.options.length > 3) fail(`${id}: ${call.options.length} options`);
    for (const o of call.options) {
      if (!o.label || !o.hint || o.label.length > 32 || o.hint.length > 80) fail(`${id}/${o.id}: label/hint missing or too long`);
      for (let k = 0; k < 20; k++) {
        const t = createLiveMatch({ home, away, homeName: "Us", awayName: "Them", userSide: "home", knockout: true, players: s.players, rng: rngFor("eff", id, o.id, k) });
        t.minute = m.minute;
        t.injured = home.lineup[6];
        t.pending = previewCall(t, id, s.players);
        const r = rngFor("eff-r", id, o.id, k);
        resolveCall(t, o.id, r, s.players);
        if (t.userAttack < 0.5 || t.userAttack > 2 || t.userDefence < 0.5 || t.userDefence > 1.5) fail(`${id}/${o.id}: effect out of bounds (${t.userAttack}, ${t.userDefence})`);
        if (t.boostAttack > 1.5 || t.boostDefence < 0.5) fail(`${id}/${o.id}: boost out of bounds`);
        if (t.pressureUntil - t.minute > 6) fail(`${id}/${o.id}: pressure too long`);
        if (Math.abs(t.homeScore - t.awayScore) > 6) fail(`${id}/${o.id}: one call swung ${t.homeScore}–${t.awayScore}`);
        playToEnd(t, r, s.players);
        if (!t.finished || t.minute !== 80) fail(`${id}/${o.id}: match didn't finish`);
      }
    }
  }
  ok(`all ${ALL_CALL_IDS.length} moments have 2–3 options with hints; every option's effect is bounded and the match finishes`);
}

// Red cards: about one team in twenty, the player leaves the field and is in the result.
{
  let reds = 0;
  let teams = 0;
  for (let i = 0; i < 1500; i++) {
    const { m, result } = run(20_000 + i, () => 0);
    teams += 2;
    const off = [...(result.homeSentOff ?? []), ...(result.awaySentOff ?? [])];
    reds += off.length;
    for (const id of result.homeSentOff ?? []) if (m.home.lineup.includes(id)) fail("sent-off player still on the field");
    for (const id of result.awaySentOff ?? []) if (m.away.lineup.includes(id)) fail("sent-off player still on the field");
  }
  const rate = reds / teams;
  if (rate < 0.02 || rate > 0.09) fail(`live send-off rate ${rate.toFixed(3)} per team-game`);
  ok(`live send-offs: ${reds} in ${teams} team-games (1 in ${Math.round(teams / Math.max(1, reds))})`);
}

console.log(`\n${passed} passed`);
