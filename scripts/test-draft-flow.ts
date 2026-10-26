/**
 * Classic draft flow tests: spin lock, auto-advance, run progress, save / resume, quick spins,
 * and the end-of-season awards + headlines.
 * Run: npm run test:draft   (or: bun scripts/test-draft-flow.ts)
 */
import {
  buildRunProgressSteps,
  getNextEmptySlotIndex,
  resolveSpinRequest,
} from "../src/lib/game/draft-flow";
import {
  clearRunResume,
  getResumeModeKey,
  getResumeStorageKey,
  loadRunResume,
  parseRunResumeSnapshot,
  RUN_RESUME_VERSION,
  saveRunResume,
  type RunResumeSnapshot,
} from "../src/lib/game/run-resume";
import { resolveQuickSpins } from "../src/lib/storage/spin-settings";
import { getSpinDurationMs, QUICK_SPIN_DURATION_MS, DEFAULT_SPIN_DURATION_MS } from "../src/lib/game/slot-reel";
import { buildEndOfSeasonAwards, buildSeasonHeadlines } from "../src/lib/game/season-headlines";
import { autofillSlotRecruitSquad, generateSlotTeamYearTargetForSlot } from "../src/lib/game/slot-team-year-pick";
import { simulateSeason, type MatchFixture, type SeasonResult } from "../src/lib/game/season-simulation";
import { generateSeasonAwards } from "../src/lib/season-awards";
import { createEmptySquad, FORMATION_SLOT_INDICES, TOTAL_SLOTS } from "../src/lib/positions";
import type { Player, SquadSlot } from "../src/lib/types";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

/* ------------------------------------------------------------ localStorage shim */
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

/* ------------------------------------------------------------------ spin lock */
{
  const free = resolveSpinRequest(null, 4);
  assert(free.slotIndex === 4 && !free.reopenLocked && !free.redirected, "no lock: the tapped slot spins");
  const same = resolveSpinRequest(4, 4);
  assert(same.slotIndex === 4 && same.reopenLocked && !same.redirected, "locked slot reopens its landed spin (no re-roll)");
  const other = resolveSpinRequest(4, 9);
  assert(
    other.slotIndex === 4 && other.reopenLocked && other.redirected,
    "tapping another slot while a spin is locked reopens the locked slot — no peeking"
  );

  // Why it matters: the same spin index gives different teams for different slots, so without
  // the lock Back → another slot would reveal a second result for the same pick.
  const squad = createEmptySquad();
  const seed = "daily-2026-10-26";
  const targets = new Set<string>();
  for (const slot of [0, 1, 5, 8, 11]) {
    const t = generateSlotTeamYearTargetForSlot(seed, 0, new Set(), squad, slot, new Set(), {
      spinVariant: "current",
    });
    if (t) targets.add(t.teamYearKey);
  }
  assert(targets.size > 1, "different slots roll different teams at the same spin index (lock is needed)");
  const again = generateSlotTeamYearTargetForSlot(seed, 0, new Set(), squad, 0, new Set(), { spinVariant: "current" });
  const first = generateSlotTeamYearTargetForSlot(seed, 0, new Set(), squad, 0, new Set(), { spinVariant: "current" });
  assert(again?.teamYearKey === first?.teamYearKey, "a slot's spin is deterministic for the seed + index");
}

/* ------------------------------------------------------------- auto-advance */
{
  const empty = createEmptySquad();
  assert(getNextEmptySlotIndex(empty, null) === FORMATION_SLOT_INDICES[0], "first suggestion is the first slot in team-sheet order");
  const order = FORMATION_SLOT_INDICES as readonly number[];
  const filled = empty.map((s) => (s.slotIndex === order[1] ? { ...s, player: { id: "x" } as Player } : s));
  assert(getNextEmptySlotIndex(filled, order[1]) === order[2], "after signing, the next empty slot in team-sheet order is suggested");
  const lastFirst = getNextEmptySlotIndex(empty, order[order.length - 1]);
  assert(lastFirst === order[0], "suggestion wraps round to the top of the sheet");
  const full = empty.map((s) => ({ ...s, player: { id: `p${s.slotIndex}` } as Player }));
  assert(getNextEmptySlotIndex(full, 3) === null, "no suggestion once the squad is complete");
  const onlyLf = full.map((s) => (s.slotIndex === 11 ? { ...s, player: null } : s));
  assert(getNextEmptySlotIndex(onlyLf, 0, [11]) === null, "locked slots (GOAT mode) are never suggested");
}

/* ----------------------------------------------------------------- progress */
{
  const squadSteps = buildRunProgressSteps("squad", 7, 13);
  assert(
    squadSteps.map((s) => s.label).join(" → ") === "Squad 7/13 → Season → Play-offs",
    "progress reads Squad 7/13 → Season → Play-offs"
  );
  assert(squadSteps[0].state === "active" && squadSteps[1].state === "todo", "draft: squad step active");
  const po = buildRunProgressSteps("playoffs", 13, 13);
  assert(po[0].state === "done" && po[1].state === "done" && po[2].state === "active", "play-offs: earlier steps done");
}

/* ---------------------------------------------------------------- quick spins */
assert(resolveQuickSpins(null, false) === false, "quick spins default off before the first full run");
assert(resolveQuickSpins(null, true) === true, "quick spins default on for returning players");
assert(resolveQuickSpins("0", true) === false, "an explicit off sticks");
assert(resolveQuickSpins("1", false) === true, "an explicit on sticks");
assert(getSpinDurationMs(true) === QUICK_SPIN_DURATION_MS && QUICK_SPIN_DURATION_MS <= 1000, "quick reel is about 0.9s");
assert(getSpinDurationMs(false) === DEFAULT_SPIN_DURATION_MS, "normal reel unchanged");

/* --------------------------------------------------------------- save / resume */
{
  assert(
    getResumeModeKey({ dailyChallengeMode: false, weeklyChallengeMode: false, normalEraMode: true, ballKnower: false, hiddenMode: false }) === "era",
    "Era Classic has its own resume slot"
  );
  assert(
    getResumeModeKey({ dailyChallengeMode: true, weeklyChallengeMode: false, normalEraMode: true, ballKnower: false, hiddenMode: false }) === "daily",
    "the Daily resumes in its own slot"
  );
  assert(
    getResumeModeKey({ dailyChallengeMode: false, weeklyChallengeMode: false, normalEraMode: false, ballKnower: false, hiddenMode: true }) === null,
    "hidden modes never save"
  );

  const seed = "resume-seed-1";
  const auto = autofillSlotRecruitSquad(seed, 0, createEmptySquad(), new Set(), "current", null);
  assert(Boolean(auto), "built a squad to save");
  const partial: SquadSlot[] = createEmptySquad().map((slot, i) =>
    i < 5 ? { ...slot, player: auto!.squad.find((s) => s.slotIndex === slot.slotIndex)!.player } : slot
  );
  const emptySlot = partial.find((s) => !s.player)!;
  const target = generateSlotTeamYearTargetForSlot(seed, 5, new Set(), partial, emptySlot.slotIndex, new Set(), {
    spinVariant: "current",
  })!;
  const snap: RunResumeSnapshot = {
    v: RUN_RESUME_VERSION,
    modeKey: "classic",
    seed,
    runId: `run-${seed}`,
    startedAt: "2026-10-26T10:00:00.000Z",
    squad: partial,
    spinPickIndex: 5,
    respinsRemaining: 2,
    usedTeamYearKeys: ["Wigan Warriors|2026"],
    legendSpinSlotIndex: null,
    legendSpinUsed: false,
    pendingSpin: { slotIndex: emptySlot.slotIndex, target },
    savedAt: "2026-10-26T10:05:00.000Z",
  };
  saveRunResume(snap);
  const loaded = loadRunResume("classic");
  assert(loaded !== null, "a saved run loads back");
  assert(loaded?.seed === seed && loaded?.runId === snap.runId, "resume keeps the same seed and run id");
  assert(loaded?.spinPickIndex === 5 && loaded?.respinsRemaining === 2, "resume keeps spin index and respins left");
  assert(
    loaded?.pendingSpin?.slotIndex === emptySlot.slotIndex && loaded?.pendingSpin?.target.teamYearKey === target.teamYearKey,
    "a landed spin comes back locked to its slot (never re-rolled)"
  );
  assert(
    loaded?.squad.filter((s) => s.player).map((s) => s.player!.id).join() ===
      partial.filter((s) => s.player).map((s) => s.player!.id).join(),
    "resume restores the same signings"
  );
  assert(loadRunResume("era") === null, "a Classic save doesn't leak into Era");

  // Daily / Weekly: only the same day's attempt resumes.
  saveRunResume({ ...snap, modeKey: "daily", seed: "daily-2026-10-26" });
  assert(loadRunResume("daily", "daily-2026-10-26") !== null, "today's Daily attempt resumes");
  assert(loadRunResume("daily", "daily-2026-10-27") === null, "yesterday's Daily is dropped");
  assert(store.get(getResumeStorageKey("daily")) === undefined, "a stale Daily save is cleared");

  // Malformed / empty saves.
  assert(parseRunResumeSnapshot("{not json", "classic") === null, "bad JSON is ignored");
  assert(parseRunResumeSnapshot({ ...snap, squad: [] }, "classic") === null, "bad squad shape is ignored");
  assert(
    parseRunResumeSnapshot({ ...snap, pendingSpin: null, squad: createEmptySquad() }, "classic") === null,
    "a run with no progress isn't offered"
  );
  const filledSlot = partial.find((s) => s.player)!;
  assert(
    parseRunResumeSnapshot({ ...snap, pendingSpin: { slotIndex: filledSlot.slotIndex, target } }, "classic") === null,
    "a pending spin on a filled slot is rejected"
  );
  saveRunResume({ ...snap, squad: createEmptySquad(), pendingSpin: null });
  assert(loadRunResume("classic") === null, "saving an empty run clears the slot");
  saveRunResume(snap);
  clearRunResume("classic");
  assert(loadRunResume("classic") === null, "clearRunResume removes the save");
}

/* ------------------------------------------------------- awards + headlines */
{
  const seed = "awards-seed-7";
  const auto = autofillSlotRecruitSquad(seed, 0, createEmptySquad(), new Set(), "current", null)!;
  assert(auto.squad.filter((s) => s.player).length === TOTAL_SLOTS, "auto squad is full");
  const result = simulateSeason(auto.squad, seed, { currentSeasonOnly: true });
  const poty = generateSeasonAwards(auto.squad, result).find((a) => a.title === "Player of the Season")!;
  const awards = buildEndOfSeasonAwards(auto.squad, result, { playerName: poty.playerName });
  assert(awards.length === 3, "three end-of-season awards");
  assert(awards[0].id === "player-of-season" && awards[0].playerName === poty.playerName, "Player of the Season matches the review award");
  const top = [...result.tryScorers].sort((a, b) => b.tries - a.tries)[0];
  const tryAward = awards.find((a) => a.id === "top-try-scorer");
  assert(!top || top.tries === 0 || (tryAward !== undefined && tryAward.detail.startsWith(`${top.tries} tr`)), "top try scorer uses the season's try totals");
  const names = new Set(auto.squad.map((s) => s.player!.name));
  assert(awards.every((a) => names.has(a.playerName)), "every award goes to someone in the XIII");
  const again = buildEndOfSeasonAwards(auto.squad, result, { playerName: poty.playerName });
  assert(JSON.stringify(again) === JSON.stringify(awards), "awards are deterministic");

  const headlines = buildSeasonHeadlines(result, 3);
  assert(headlines.length === 2, "two headlines");
  assert(JSON.stringify(buildSeasonHeadlines(result, 3)) === JSON.stringify(headlines), "headlines are deterministic");
  const wins = result.fixtures.filter((f) => f.result === "W");
  if (wins.length > 0) {
    const best = wins.reduce((a, b) => (b.pointsFor - b.pointsAgainst > a.pointsFor - a.pointsAgainst ? b : a));
    assert(
      headlines[0].id === "biggest-win" && headlines[0].text.includes(`${best.pointsFor}-${best.pointsAgainst}`),
      "first headline is the biggest win's real score"
    );
  }

  // Hand-built seasons for the other headline branches.
  const fx = (round: number, pf: number, pa: number, extra: Partial<MatchFixture> = {}): MatchFixture =>
    ({
      round,
      opponent: `Club ${round}`,
      isHome: true,
      pointsFor: pf,
      pointsAgainst: pa,
      triesFor: 0,
      triesAgainst: 0,
      scoringFor: { tries: 0, conversions: 0, penalties: 0, dropGoals: 0, points: pf },
      scoringAgainst: { tries: 0, conversions: 0, penalties: 0, dropGoals: 0, points: pa },
      result: pf > pa ? "W" : "L",
      ...extra,
    }) as MatchFixture;
  const base = { wins: 2, losses: 1, isPerfect: false, longestWinStreak: 2, longestLosingStreak: 1 };
  const upset = buildSeasonHeadlines(
    { ...base, fixtures: [fx(1, 20, 10), fx(2, 18, 16, { isUpset: true }), fx(3, 6, 30)] } as Pick<SeasonResult, "fixtures" | "wins" | "losses" | "isPerfect" | "longestWinStreak" | "longestLosingStreak">,
    5
  );
  assert(upset[1].id === "giant-killing" && upset[1].text.includes("18-16"), "an underdog win makes the giant-killing headline");
  const winless = buildSeasonHeadlines(
    { ...base, wins: 0, losses: 5, longestWinStreak: 0, longestLosingStreak: 5, fixtures: [fx(1, 4, 40), fx(2, 10, 12)] },
    12
  );
  assert(winless[0].id === "heaviest-defeat" && winless[0].text.includes("40-4"), "no wins: heaviest defeat leads");
  assert(winless[1].id === "slump", "long losing run makes the slump headline");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
