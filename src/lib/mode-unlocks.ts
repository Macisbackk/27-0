/**
 * More modes are earned, not given (owner, v1.50). Each mode on /modes unlocks with a challenge
 * that fits it:
 *   One-Club XI   win 20+ games in a Classic season with 5 players from one club
 *   Gauntlet      win a Grand Final in Classic
 *   Past Dailies  finish 3 Dailies
 *   Ball Knower   go 27-0 once (v1.47)
 * "Classic" means any ranked Classic run: Classic, Era Classic, Ball Knower, the Daily and the
 * Weekly. Hidden novelty modes, challenge links and the side modes themselves never count.
 *
 * An unlock grants the mode's notForSale cosmetic, so it rides the cosmetics cloud sync and an
 * owned item is never taken away. syncModeUnlocks() backfills from lifetime stats, the run
 * history and the Daily history, so anyone who already met a challenge gets the mode on load.
 * Tests: scripts/test-mode-unlocks.ts.
 */
import {
  BALL_KNOWER_ID,
  GAUNTLET_MODE_ID,
  ONE_CLUB_MODE_ID,
  PAST_DAILIES_MODE_ID,
} from "./cosmetics";
import { SHOW_DAILY_CHALLENGE_UI } from "./feature-flags";
import { countFinishedDailies } from "./daily-challenge";
import type { RunHistoryCard, RunHistoryEntry } from "./records";
import { getAllStats } from "./storage/stats";
import { loadRunHistory } from "./storage/run-history";
import { grantCosmetic, ownsCosmetic } from "./storage/cosmetics-store";

export const ONE_CLUB_UNLOCK_WINS = 20;
export const ONE_CLUB_UNLOCK_PLAYERS = 5;
export const PAST_DAILIES_UNLOCK_COUNT = 3;

export interface ModeUnlock {
  id: string;
  name: string;
  /** The challenge, shown after a 🔒 when locked. */
  text: string;
}

export const ONE_CLUB_UNLOCK_TEXT = `Win ${ONE_CLUB_UNLOCK_WINS}+ games in a Classic season with ${ONE_CLUB_UNLOCK_PLAYERS} players from one club.`;
export const GAUNTLET_UNLOCK_TEXT = "Win a Grand Final in Classic.";
export const PAST_DAILIES_UNLOCK_TEXT = `Finish ${PAST_DAILIES_UNLOCK_COUNT} Dailies.`;
export const BALL_KNOWER_UNLOCK_TEXT = "Go 27-0 once to unlock.";

/** In /modes order. Past Dailies only while the Daily is switched on. */
export const MODE_UNLOCKS: readonly ModeUnlock[] = [
  { id: ONE_CLUB_MODE_ID, name: "One-Club XI", text: ONE_CLUB_UNLOCK_TEXT },
  { id: GAUNTLET_MODE_ID, name: "Gauntlet", text: GAUNTLET_UNLOCK_TEXT },
  ...(SHOW_DAILY_CHALLENGE_UI ? [{ id: PAST_DAILIES_MODE_ID, name: "Past Dailies", text: PAST_DAILIES_UNLOCK_TEXT }] : []),
  { id: BALL_KNOWER_ID, name: "Ball Knower mode", text: BALL_KNOWER_UNLOCK_TEXT },
];

export function modeUnlockById(id: string): ModeUnlock | undefined {
  return MODE_UNLOCKS.find((m) => m.id === id);
}

/* ------------------------------------------------------------------ pure rules */

/** Club identity: era suffix (" '98") stripped, case-folded — the way chemistry links clubs. */
export function unlockClubKey(club: string | null | undefined): string | null {
  if (typeof club !== "string") return null;
  const base = club.trim().replace(/^(.+?) '\d{2}$/, "$1").trim();
  return base ? base.toLowerCase() : null;
}

/** Most players from one club in a squad (clubs as run club names; nulls ignored). */
export function mostFromOneClub(clubs: readonly (string | null | undefined)[]): number {
  const counts = new Map<string, number>();
  let best = 0;
  for (const club of clubs) {
    const key = unlockClubKey(club);
    if (!key) continue;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > best) best = n;
  }
  return best;
}

export function meetsOneClubChallenge(wins: number, clubs: readonly (string | null | undefined)[]): boolean {
  return Number(wins) >= ONE_CLUB_UNLOCK_WINS && mostFromOneClub(clubs) >= ONE_CLUB_UNLOCK_PLAYERS;
}

const CHAMPIONS = "Super League Champions";

/** What the backfill reads: lifetime stats, the local run history and the Daily history. */
export interface ModeUnlockEvidence {
  /** Perfect seasons across the lifetime stats buckets. */
  perfectSeasons: number;
  /** Grand Finals won in Classic / Era Classic / Ball Knower lifetime stats. */
  classicTitles: number;
  /** Finished seasons (hidden modes and side modes are never written here). */
  history: readonly Pick<RunHistoryEntry, "wins" | "perfect" | "finish" | "squad">[];
  /** Finished Daily Challenge days. */
  dailiesFinished: number;
}

export const EMPTY_EVIDENCE: ModeUnlockEvidence = { perfectSeasons: 0, classicTitles: 0, history: [], dailiesFinished: 0 };

/** Mode ids the evidence earns (pure). */
export function earnedModeIds(e: ModeUnlockEvidence): string[] {
  const out: string[] = [];
  const history = Array.isArray(e.history) ? e.history : [];
  const clubsOf = (h: ModeUnlockEvidence["history"][number]): string[] =>
    Array.isArray(h.squad) ? h.squad.map((card: RunHistoryCard) => card.club) : [];
  if (history.some((h) => meetsOneClubChallenge(h.wins, clubsOf(h)))) out.push(ONE_CLUB_MODE_ID);
  if (e.classicTitles > 0 || history.some((h) => h.finish === CHAMPIONS)) out.push(GAUNTLET_MODE_ID);
  if (e.dailiesFinished >= PAST_DAILIES_UNLOCK_COUNT) out.push(PAST_DAILIES_MODE_ID);
  if (e.perfectSeasons > 0 || history.some((h) => h.perfect)) out.push(BALL_KNOWER_ID);
  return out;
}

/** Mode ids a finished Classic regular season earns on the spot (pure). */
export function seasonUnlockIds(input: {
  wins: number;
  perfect: boolean;
  clubs: readonly (string | null | undefined)[];
  /** Hidden novelty mode (Joe Mellor / Super Sam Hallas): never counts. */
  hidden: boolean;
}): string[] {
  if (input.hidden) return [];
  const out: string[] = [];
  if (meetsOneClubChallenge(input.wins, input.clubs)) out.push(ONE_CLUB_MODE_ID);
  if (input.perfect) out.push(BALL_KNOWER_ID);
  return out;
}

/** Mode ids a finished Classic play-off run earns on the spot (pure). */
export function playoffUnlockIds(input: { champion: boolean; hidden: boolean }): string[] {
  return input.champion && !input.hidden ? [GAUNTLET_MODE_ID] : [];
}

/* ------------------------------------------------------------------ storage */

function readStatsTotals(): { perfectSeasons: number; classicTitles: number } {
  try {
    const all = getAllStats() as unknown as Record<string, { totalPerfectSeasons?: number; superLeagueTitles?: number } | undefined>;
    let perfectSeasons = 0;
    let classicTitles = 0;
    for (const [bucket, s] of Object.entries(all)) {
      if (!s || typeof s !== "object") continue;
      perfectSeasons += Math.max(0, Number(s.totalPerfectSeasons) || 0);
      if (bucket === "normal" || bucket === "eraNormal" || bucket === "hard") {
        classicTitles += Math.max(0, Number(s.superLeagueTitles) || 0);
      }
    }
    return { perfectSeasons, classicTitles };
  } catch {
    return { perfectSeasons: 0, classicTitles: 0 };
  }
}

export function readModeUnlockEvidence(): ModeUnlockEvidence {
  const totals = readStatsTotals();
  let history: RunHistoryEntry[] = [];
  try {
    history = loadRunHistory();
  } catch {
    history = [];
  }
  let dailiesFinished = 0;
  try {
    dailiesFinished = countFinishedDailies();
  } catch {
    dailiesFinished = 0;
  }
  return { ...totals, history, dailiesFinished };
}

function safeOwns(id: string): boolean {
  try {
    return ownsCosmetic(id);
  } catch {
    return false;
  }
}

/** Grant each id not yet owned. Returns the ids newly unlocked (idempotent). */
export function grantModeUnlocks(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!modeUnlockById(id) || safeOwns(id)) continue;
    try {
      if (grantCosmetic(id)) out.push(id);
    } catch {
      /* storage blocked: the next sync retries */
    }
  }
  return out;
}

/** Backfill: grant every mode the stored history already earns. Returns the ids newly unlocked. */
export function syncModeUnlocks(): string[] {
  try {
    return grantModeUnlocks(earnedModeIds(readModeUnlockEvidence()));
  } catch {
    return [];
  }
}

export function isModeUnlocked(id: string): boolean {
  if (safeOwns(id)) return true;
  try {
    return earnedModeIds(readModeUnlockEvidence()).includes(id);
  } catch {
    return false;
  }
}

/** Cheap progress for the locked cards on /modes. */
export function getModeUnlockProgress(): { dailiesFinished: number } {
  try {
    return { dailiesFinished: Math.min(PAST_DAILIES_UNLOCK_COUNT, countFinishedDailies()) };
  } catch {
    return { dailiesFinished: 0 };
  }
}

/** How many of the More modes are unlocked (owned ids from the cosmetics store). */
export function countUnlockedModes(owned: readonly string[]): { unlocked: number; total: number } {
  return { unlocked: MODE_UNLOCKS.filter((m) => owned.includes(m.id)).length, total: MODE_UNLOCKS.length };
}

/**
 * Call when a ranked Classic regular season is recorded (after recordCompletedRun, so a counted
 * Daily is already in the Daily history). Returns the ids newly unlocked, for the toast.
 */
export function unlockModesAfterSeason(input: {
  wins: number;
  perfect: boolean;
  clubs: readonly (string | null | undefined)[];
  hidden: boolean;
}): string[] {
  if (input.hidden) return [];
  const now = grantModeUnlocks(seasonUnlockIds(input));
  return [...now, ...syncModeUnlocks().filter((id) => !now.includes(id))];
}

/** Call when a ranked Classic play-off run finishes. Returns the ids newly unlocked. */
export function unlockModesAfterPlayoffs(input: { champion: boolean; hidden: boolean }): string[] {
  if (input.hidden) return [];
  const now = grantModeUnlocks(playoffUnlockIds(input));
  return [...now, ...syncModeUnlocks().filter((id) => !now.includes(id))];
}

/* ------------------------------------------------------------------ Ball Knower (v1.47 API) */

export function hasGone27Nil(): boolean {
  return readStatsTotals().perfectSeasons > 0;
}

export function isBallKnowerUnlocked(): boolean {
  return isModeUnlocked(BALL_KNOWER_ID);
}

export function syncBallKnowerUnlock(): boolean {
  return syncModeUnlocks().includes(BALL_KNOWER_ID);
}
