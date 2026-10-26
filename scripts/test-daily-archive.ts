/**
 * Daily archive tests: the last 30 UK days (today excluded), each with exactly the rule and the
 * seed that day's Daily had, and practice runs never touch the streak, freezes, the Daily
 * attempt, the Daily board queue, missions or Club Funds.
 * Run: bun scripts/test-daily-archive.ts   (or: npx tsx scripts/test-daily-archive.ts)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  clear(): void {
    this.values.clear();
  }
  snapshot(): string {
    return JSON.stringify([...this.values.entries()].sort());
  }
}
const storage = new MemoryStorage();
Object.assign(globalThis, { window: new EventTarget(), localStorage: storage });
if (typeof globalThis.CustomEvent === "undefined") {
  class NodeCustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail as T;
    }
  }
  Object.assign(globalThis, { CustomEvent: NodeCustomEvent });
}

let passed = 0;
let failed = 0;
function check(condition: unknown, message: string): void {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}
const DAY = 86_400_000;

async function main(): Promise<void> {
  const archive = await import("../src/lib/daily-archive");
  const daily = await import("../src/lib/daily-challenge");

  // -------------------------------------------------------------------------
  // The window
  // -------------------------------------------------------------------------
  for (const iso of ["2026-10-26T09:00:00Z", "2026-03-29T00:30:00Z", "2026-10-25T23:30:00Z", "2027-01-01T00:10:00Z"]) {
    const now = new Date(iso);
    const keys = archive.getDailyArchiveDateKeys(now);
    const today = daily.getDailyChallengeDateKey(now);
    check(keys.length === archive.DAILY_ARCHIVE_DAYS && keys.length === 30, `${iso}: 30 days`);
    check(!keys.includes(today), `${iso}: today (${today}) is not in the archive`);
    check(new Set(keys).size === 30, `${iso}: no duplicate days`);
    const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - DAY).toISOString().slice(0, 10);
    check(keys[0] === yesterday, `${iso}: newest is yesterday (${keys[0]})`);
    for (let i = 1; i < keys.length; i++) {
      check(Date.parse(keys[i - 1]!) - Date.parse(keys[i]!) === DAY, `${iso}: consecutive days ${keys[i]}`);
    }
    check(archive.isDailyArchiveDateKey(keys[29], now), `${iso}: 30 days ago is playable`);
    const tooOld = new Date(Date.parse(`${keys[29]}T12:00:00Z`) - DAY).toISOString().slice(0, 10);
    check(!archive.isDailyArchiveDateKey(tooOld, now), `${iso}: 31 days ago is not`);
    check(!archive.isDailyArchiveDateKey(today, now), `${iso}: today is not an archive day`);
  }
  for (const bad of [null, undefined, "", "2026-1-1", "yesterday", "2026-10-25T00:00", "../etc"]) {
    check(!archive.isDailyArchiveDateKey(bad as string | null, new Date("2026-10-26T09:00:00Z")), `rejects ${String(bad)}`);
  }

  // -------------------------------------------------------------------------
  // Same rule, same seed, same href shape as the day's Daily
  // -------------------------------------------------------------------------
  const now = new Date("2026-10-26T09:00:00Z");
  for (const key of archive.getDailyArchiveDateKeys(now)) {
    const onTheDay = daily.getDailyChallengeScenario(new Date(`${key}T08:00:00Z`));
    const replay = archive.getDailyArchiveScenario(key);
    check(JSON.stringify(replay) === JSON.stringify(onTheDay), `${key}: same scenario as on the day (${replay.ruleTitle})`);
    check(archive.getDailyArchiveSeed(key) === `daily-${key}`, `${key}: same seed as the Daily (daily-<date>)`);
    check(
      archive.getDailyArchiveHref(key) === (replay.eraMode ? `/play?archive=${key}&era=1` : `/play?archive=${key}`),
      `${key}: href carries the era flag`
    );
    check(!archive.getDailyArchiveRunIdPrefix(key).startsWith("run-daily-"), `${key}: practice run ids never look like a Daily run`);
  }
  check(archive.formatDailyArchiveDate("2026-10-20") === "Tue 20 Oct", `date label (${archive.formatDailyArchiveDate("2026-10-20")})`);

  // -------------------------------------------------------------------------
  // Never touches the streak, the attempt, the board or Club Funds
  // -------------------------------------------------------------------------
  storage.clear();
  // A real counted Daily today first, so there is state to protect.
  const today = new Date();
  check(daily.claimDailyChallengeAttempt("run-daily-real", today) === true, "today's real attempt claimed");
  daily.recordDailyChallengeRunResult({ runId: "run-daily-real", phase: "regular", regularWins: 20, leaguePosition: 8 });
  const streakBefore = daily.getDailyChallengeStreak();
  const before = storage.snapshot();
  for (const key of archive.getDailyArchiveDateKeys(today)) {
    archive.getDailyArchiveScenario(key);
    archive.getDailyArchiveSeed(key);
    archive.getDailyArchiveHref(key);
    archive.isDailyArchiveDateKey(key, today);
    // Even if an archive run's result reached the Daily recorder, it isn't the day's attempt.
    const runId = `${archive.getDailyArchiveRunIdPrefix(key)}-x`;
    check(
      daily.recordDailyChallengeRunResult({ runId, phase: "regular", regularWins: 27, leaguePosition: 1 }) === null,
      `${key}: an archive run is never recorded as a Daily result`
    );
  }
  check(storage.snapshot() === before, "archive functions write nothing (streak, attempt, board queue, funds untouched)");
  check(daily.getDailyChallengeStreak() === streakBefore, "streak unchanged");
  check(daily.getDailyChallengeAttemptUsed(today), "today's attempt still the real one");

  // GameBoard wiring (source checks — the board is a React component): archive runs are side
  // modes; side modes return before any stats / leaderboard / Club Funds / mission / Daily code.
  const board = readFileSync(join(__dirname, "..", "src", "components", "GameBoard.tsx"), "utf8");
  const finalize = board.slice(board.indexOf("const finalizeRegularSeason = useCallback"), board.indexOf("const finalizePlayoffRun = useCallback"));
  const guard = finalize.indexOf("if (isSideMode)");
  check(guard > 0, "finalizeRegularSeason has the side-mode guard");
  for (const call of ["recordCompletedRun(", "awardClubFundsForRun(", "reportMissionEvent(", "markDailyChallengeLeagueLeaders(", "triggerQuickSeasonAchievements(", "submitWeeklyScore("]) {
    const at = finalize.indexOf(call);
    check(at > guard, `finalizeRegularSeason: ${call} only after the side-mode return`);
  }
  check(finalize.indexOf("recordSquadBookRun(") > guard, "side modes don't add to the Squad Book (its sets pay Club Funds)");
  const playoff = board.slice(board.indexOf("const finalizePlayoffRun = useCallback"), board.indexOf("useEffect(() => {\n    if (phase !== \"review\" || reviewStage !== \"regular\""));
  check(playoff.indexOf("if (isSideMode)") > 0 && playoff.indexOf("if (isSideMode)") < playoff.indexOf("recordPlayoffCompletion("), "play-off recording skipped for side modes");
  check(/if \(isSideMode\) playoffFundsAwardedRef\.current = true/.test(board), "play-off Club Funds skipped for side modes");
  check(/isSideMode =\s*sideMode != null && !dailyChallengeMode && !weeklyChallengeMode/.test(board), "a side mode is never also the Daily or Weekly");
  check(/resumeModeKey = isSlotRecruitMode (&& !challenge )?&& !isSideMode/.test(board), "archive runs never take over the Daily's saved run");
  const page = readFileSync(join(__dirname, "..", "src", "app", "play", "PlayPageClient.tsx"), "utf8");
  check(/sideModeAllowed = (!hasChallengeParam && )?!isDaily && !isWeekly/.test(page), "/play?daily=1&archive=… plays the real Daily, never both");
  // The claim only happens for the real Daily.
  check(/if \(dailyChallengeMode\) setDailyAttemptCounts\(claimDailyChallengeAttempt/.test(board), "only the real Daily claims the day's attempt");

  console.log(`\nDaily archive: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
