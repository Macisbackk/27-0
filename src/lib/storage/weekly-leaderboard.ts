import { getAuthUserId, isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import {
  canClaimWeeklyTop10,
  getPreviousWeeklyChallengeWeekKey,
  getWeeklyChallengeEntry,
  getWeeklyChallengeWeekKey,
  getWeeklyTop10Reward,
  getWeeklyTop10RunId,
  loadWeeklyChallengeState,
  markWeeklyChallengeEntrySynced,
  rankWeeklyEntries,
  rememberWeeklyChallengeLastWeek,
  WEEKLY_TOP10_RANK,
  type WeeklyBoardEntry,
  type WeeklyChallengeEntry,
  type WeeklyRankedEntry,
} from "../weekly-challenge";
import { awardClubFundsLines } from "./club-funds";

/**
 * Weekly Challenge board: table `weekly_challenge_entries`, one row per coach per ISO week
 * (supabase/migrations/20261025120000_weekly_challenge.sql). The ranked attempt is inserted
 * after its regular season and, if it reached the play-offs, updated once with the play-off
 * result. The database refuses a second entry, a second update and any write to a closed week.
 */
const TABLE = "weekly_challenge_entries";

export interface WeeklyLeaderboardRow extends WeeklyRankedEntry {
  isCurrentUser: boolean;
}

function canSubmit(): { userId: string; coachName: string } | null {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (!isLoggedIn() || !userId || !coachName || isGuestLeaderboardName(coachName)) return null;
  if (!isSupabaseConfigured) return null;
  return { userId, coachName };
}

async function readMyRow(
  weekKey: string,
  userId: string
): Promise<{ run_id: string; is_final: boolean } | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("run_id, is_final")
    .eq("week_key", weekKey)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { run_id: string; is_final: boolean } | null) ?? null;
}

let weeklyRpcMissing = false;

/**
 * v1.18: scores go through the `submit_weekly_challenge_entry` RPC, which takes the per-round
 * results (not a score), recomputes the score, checks the result is structurally possible,
 * rate-limits and flags suspicious entries (supabase/migrations/20261027120000_challenge_score_rpcs.sql).
 * Returns false when the RPC isn't deployed yet, so the caller falls back to the direct write.
 */
async function pushEntryViaRpc(entry: WeeklyChallengeEntry, coachName: string): Promise<boolean> {
  if (weeklyRpcMissing) return false;
  const { error } = await supabase.rpc("submit_weekly_challenge_entry", {
    p_week_key: entry.weekKey,
    p_run_id: entry.runId,
    p_coach_name: coachName,
    p_regular_wins: entry.input.regularWins,
    p_league_leaders: entry.input.leagueLeaders,
    p_playoff_wins: entry.final ? entry.input.playoffWins : 0,
    p_grand_final: entry.final ? entry.input.grandFinalWon : false,
    p_is_final: entry.final,
  });
  if (error && (error.code === "PGRST202" || error.code === "42883")) {
    weeklyRpcMissing = true;
    return false;
  }
  if (!error) {
    markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, entry.final ? "final" : "regular");
    return true;
  }
  if (error.code === "23514") {
    // Refused for good (closed week, another run already posted, impossible result).
    markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, "final", true);
    return true;
  }
  // Rate-limited (54000) or offline: try again on the next flush.
  throw error;
}

async function pushEntry(entry: WeeklyChallengeEntry, userId: string, coachName: string): Promise<void> {
  if (entry.rejected || entry.synced === "final") return;
  if (entry.synced === "regular" && !entry.final) return;
  if (await pushEntryViaRpc(entry, coachName)) return;

  if (entry.synced === "none") {
    const { error } = await supabase.from(TABLE).insert({
      week_key: entry.weekKey,
      user_id: userId,
      coach_name: coachName,
      run_id: entry.runId,
      regular_wins: entry.input.regularWins,
      league_leaders: entry.input.leagueLeaders,
      playoff_wins: entry.input.playoffWins,
      grand_final: entry.input.grandFinalWon,
      score: entry.score,
      is_final: entry.final,
    });
    if (!error) {
      markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, entry.final ? "final" : "regular");
      return;
    }
    if (error.code !== "23505") {
      // Check violations (e.g. the week rolled over mid-run) will never succeed: stop retrying.
      if (error.code === "23514") {
        markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, "final", true);
        return;
      }
      throw error;
    }
    // Already a row this week: ours from an earlier try whose reply was lost, or another device's.
    const row = await readMyRow(entry.weekKey, userId);
    if (!row || row.run_id !== entry.runId) {
      markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, "final", true);
      return;
    }
    if (row.is_final || !entry.final) {
      markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, row.is_final ? "final" : "regular");
      return;
    }
  }

  // The regular season is on the board; add the play-off result (once).
  const { error } = await supabase
    .from(TABLE)
    .update({
      playoff_wins: entry.input.playoffWins,
      grand_final: entry.input.grandFinalWon,
      score: entry.score,
      is_final: true,
    })
    .eq("week_key", entry.weekKey)
    .eq("user_id", userId)
    .eq("run_id", entry.runId)
    .eq("is_final", false);
  if (error && error.code !== "23514") throw error;
  // No row updated, or refused: it's already final or the week has closed. Either way the
  // regular-season score stays on the board and there's nothing left to send.
  markWeeklyChallengeEntrySynced(entry.weekKey, entry.runId, "final");
}

let inFlight: Promise<void> | null = null;

/**
 * Send this week's ranked entry to the board if the board is behind the device. Safe to call
 * often: one request chain at a time, and a no-op for guests, practice runs and synced entries.
 */
export function flushWeeklyChallengeEntry(): Promise<void> {
  if (inFlight) return inFlight;
  const who = canSubmit();
  const entry = getWeeklyChallengeEntry();
  if (!who || !entry) return Promise.resolve();
  inFlight = pushEntry(entry, who.userId, who.coachName)
    .catch((error) => {
      console.error("[weekly-leaderboard] submit failed:", error);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function fetchBoard(weekKey: string, limit: number): Promise<WeeklyBoardEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("user_id, coach_name, score, created_at")
      .eq("week_key", weekKey)
      .gt("score", 0)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? [])
      .filter((row) => typeof row.coach_name === "string" && typeof row.score === "number")
      .map((row) => ({
        userId: (row.user_id as string | null) ?? undefined,
        username: row.coach_name as string,
        score: row.score as number,
        createdAt: (row.created_at as string) ?? "",
      }));
  } catch (error) {
    console.error("[weekly-leaderboard] fetch failed:", error);
    return null;
  }
}

/**
 * A week's top `limit` (default 50, this week by default). For this week the signed-in coach's
 * on-device entry is merged in so their row shows straight after a run, before the write lands.
 */
export async function getWeeklyLeaderboardAsync(
  weekKey = getWeeklyChallengeWeekKey(),
  limit = 50
): Promise<{ rows: WeeklyLeaderboardRow[]; source: "remote" | "local" }> {
  const isThisWeek = weekKey === getWeeklyChallengeWeekKey();
  const who = canSubmit();
  if (isThisWeek) await flushWeeklyChallengeEntry();

  const local = isThisWeek ? getWeeklyChallengeEntry() : null;
  const mine: WeeklyBoardEntry[] =
    who && local && !local.rejected && local.score > 0
      ? [{ userId: who.userId, username: who.coachName, score: local.score, createdAt: new Date().toISOString() }]
      : [];

  const remote = await fetchBoard(weekKey, limit);
  // The server row wins over the local copy for timestamps (ties go to the earlier entry).
  const merged = remote
    ? [...remote, ...mine.filter((m) => !remote.some((r) => r.userId === m.userId && r.score >= m.score))]
    : mine;
  const rows = rankWeeklyEntries(merged)
    .slice(0, limit)
    .map((row) => ({ ...row, isCurrentUser: Boolean(who && row.userId === who.userId) }));
  return { rows, source: remote ? "remote" : "local" };
}

export interface WeeklyLastWeekResult {
  weekKey: string;
  rank: number;
  /** Club Funds paid just now for a top-10 finish (0 if none, or already paid earlier). */
  awardedNow: number;
}

/**
 * Home card: last week's finish for the signed-in coach, read from that week's final board
 * (the DB refuses writes to a closed week). A top-10 finish pays WEEKLY_TOP10_REWARD once:
 * the Club Funds ledger id (getWeeklyTop10RunId) makes the award idempotent, and the result is
 * cached on-device (with a paid flag) so the board is read once per week. Returns null when the
 * coach wasn't in last week's top 10, is a guest, or the board can't be read right now.
 */
export async function checkWeeklyLastWeekFinish(
  now = new Date()
): Promise<WeeklyLastWeekResult | null> {
  const userId = getAuthUserId();
  if (!isLoggedIn() || !userId) return null;
  const weekKey = getPreviousWeeklyChallengeWeekKey(now);
  if (!canClaimWeeklyTop10(weekKey, now)) return null;

  const cached = loadWeeklyChallengeState().lastWeek;
  let rank: number | null;
  if (cached && cached.weekKey === weekKey) {
    rank = cached.rank;
    if (cached.paid || getWeeklyTop10Reward(rank) === 0) {
      return rank !== null ? { weekKey, rank, awardedNow: 0 } : null;
    }
  } else {
    const board = await fetchBoard(weekKey, WEEKLY_TOP10_RANK);
    if (!board) return null; // unreadable right now: try again next visit
    rank = rankWeeklyEntries(board).find((row) => row.userId === userId)?.rank ?? null;
  }

  return settleWeeklyLastWeek(weekKey, rank, now);
}

/**
 * Pay (once) and remember a finished week's result. Exported for scripts/test-weekly.ts.
 * Double-pay guards, any one of which is enough: the ledger id is idempotent and dated (kept
 * 45 days, longer than the week in which it can be claimed), the on-device cache records
 * `paid`, and only the week just gone can be claimed at all.
 */
export function settleWeeklyLastWeek(
  weekKey: string,
  rank: number | null,
  now = new Date()
): WeeklyLastWeekResult | null {
  const reward = canClaimWeeklyTop10(weekKey, now) ? getWeeklyTop10Reward(rank) : 0;
  if (rank === null || reward === 0) {
    rememberWeeklyChallengeLastWeek(weekKey, rank, false);
    return null;
  }
  const payout = awardClubFundsLines(getWeeklyTop10RunId(weekKey), [
    {
      id: "weekly-top10",
      label: `Weekly Challenge: Top 10 finish (${weekKey})`,
      amount: reward,
    },
  ]);
  rememberWeeklyChallengeLastWeek(weekKey, rank, true);
  return { weekKey, rank, awardedNow: payout.awarded ? payout.total : 0 };
}
