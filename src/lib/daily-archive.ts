import {
  getDailyChallengeDateKey,
  getDailyChallengeScenario,
  type DailyChallengeScenario,
} from "./daily-challenge";

/**
 * Daily archive — replay any of the last DAILY_ARCHIVE_DAYS Dailies as practice: the same rule,
 * the same shared seed (`daily-<date>`, so the same spins and season as everyone had that day).
 *
 * Practice only: an archive run never claims the day's attempt, never touches the streak,
 * freezes, the Daily board, missions, achievements, the Squad Book or Club Funds — GameBoard
 * skips all of that for archive runs (scripts/test-daily-archive.ts checks the storage side).
 * Today's Daily is not in the archive: it is played from the Daily card.
 */
export const DAILY_ARCHIVE_DAYS = 30;

const DAY_MS = 86_400_000;

function dayIndexForKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

function keyForDayIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/** Noon UTC is always inside that UK calendar day. */
export function dateForDailyKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/** The archive's days, newest first: yesterday back to DAILY_ARCHIVE_DAYS days ago (UK days). */
export function getDailyArchiveDateKeys(now = new Date()): string[] {
  const today = dayIndexForKey(getDailyChallengeDateKey(now));
  return Array.from({ length: DAILY_ARCHIVE_DAYS }, (_, i) => keyForDayIndex(today - 1 - i));
}

/** True for a well-formed key that is in the archive window at `now`. */
export function isDailyArchiveDateKey(key: string | null | undefined, now = new Date()): key is string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return getDailyArchiveDateKeys(now).includes(key);
}

/** That day's Daily scenario — identical to what was played on the day. */
export function getDailyArchiveScenario(key: string): DailyChallengeScenario {
  return getDailyChallengeScenario(dateForDailyKey(key));
}

/** Same seed the day's Daily used (GameBoard: `daily-${dateKey}`). */
export function getDailyArchiveSeed(key: string): string {
  return `daily-${key}`;
}

/** Practice run ids never look like a Daily attempt (`run-daily-…`). */
export function getDailyArchiveRunIdPrefix(key: string): string {
  return `run-archive-${key}`;
}

export function getDailyArchiveHref(key: string): string {
  return getDailyArchiveScenario(key).eraMode
    ? `/play?archive=${key}&era=1`
    : `/play?archive=${key}`;
}

export const DAILY_ARCHIVE_PAGE = "/modes/past-dailies";

/** "Tue 20 Oct" for the archive list. */
export function formatDailyArchiveDate(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dateForDailyKey(key));
}
