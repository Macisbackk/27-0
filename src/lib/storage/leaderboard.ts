import { getPeriodKey } from "../leaderboard";
import {
  mergeLeaderboardStats,
  rankByTracker,
  type LeaderboardTrackerEntry,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
} from "../leaderboard-trackers";
// LeaderboardTrackerRow re-exported for consumers via leaderboard-trackers
import { isSupabaseConfigured, supabase } from "../supabase";
import type {
  GameDifficulty,
  GameMode,
  LeaderboardPeriod,
  LeaderboardRow,
} from "../types";
import { STORAGE_KEYS } from "./keys";
import { getAuthUserId, isLoggedIn } from "../auth-session";
import { getUsername } from "./user";

export interface StoredLeaderboardEntry {
  id: string;
  username: string;
  squadValue: number;
  achievedAt: string;
  period: LeaderboardPeriod;
  periodKey: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  totalWins: number;
  totalLosses: number;
  perfectRuns: number;
  bestRecordWins: number;
  bestRecordLosses: number;
  bestWinPercentage: number;
  challengeCupWins: number;
}

export interface SupabaseLeaderboardRow {
  id: string;
  player_name: string | null;
  coach_name: string | null;
  user_id: string | null;
  score: number;
  mode: string | null;
  difficulty: string | null;
  wins: number | null;
  losses: number | null;
  perfect_runs: number | null;
  best_record_wins: number | null;
  best_record_losses: number | null;
  best_win_percentage: number | null;
  challenge_cup_wins: number | null;
  created_at: string;
  updated_at?: string | null;
}

export type LeaderboardDbMode = "super-league" | "challenge-cup" | "draft";

export function gameModeToDbMode(mode: GameMode): LeaderboardDbMode {
  if (mode === "CHALLENGE_CUP") return "challenge-cup";
  if (mode === "DRAFT") return "draft";
  return "super-league";
}

function dbModeToGameMode(dbMode: LeaderboardDbMode): GameMode {
  if (dbMode === "challenge-cup") return "CHALLENGE_CUP";
  if (dbMode === "draft") return "DRAFT";
  return "CLASSIC";
}

function loadLocalEntries(): StoredLeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      StoredLeaderboardEntry & { wins?: number; losses?: number }
    >;
    return parsed.map((entry) => ({
      ...entry,
      totalWins: entry.totalWins ?? entry.wins ?? 0,
      totalLosses: entry.totalLosses ?? entry.losses ?? 0,
      perfectRuns: entry.perfectRuns ?? 0,
      bestRecordWins: entry.bestRecordWins ?? entry.wins ?? 0,
      bestRecordLosses: entry.bestRecordLosses ?? entry.losses ?? 0,
      bestWinPercentage: entry.bestWinPercentage ?? 0,
      challengeCupWins: entry.challengeCupWins ?? 0,
    }));
  } catch {
    return [];
  }
}

function saveLocalEntries(entries: StoredLeaderboardEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(entries));
}

function getPeriodStart(period: LeaderboardPeriod): Date | null {
  const now = new Date();
  if (period === "ALL_TIME") return null;
  if (period === "MONTHLY") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function toTrackerEntry(
  username: string,
  row: Partial<StoredLeaderboardEntry> & {
    squadValue: number;
    achievedAt: string;
    difficulty: GameDifficulty;
    mode: GameMode;
  }
): LeaderboardTrackerEntry {
  return {
    username,
    squadValue: row.squadValue,
    achievedAt: row.achievedAt,
    difficulty: row.difficulty,
    mode: row.mode,
    totalWins: row.totalWins ?? 0,
    totalLosses: row.totalLosses ?? 0,
    perfectRuns: row.perfectRuns ?? 0,
    bestRecordWins: row.bestRecordWins ?? 0,
    bestRecordLosses: row.bestRecordLosses ?? 0,
    bestWinPercentage: row.bestWinPercentage ?? 0,
    challengeCupWins: row.challengeCupWins ?? 0,
  };
}

function mapLocalToTrackerEntries(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode
): LeaderboardTrackerEntry[] {
  const periodKey = getPeriodKey(period);
  const gameMode = dbModeToGameMode(dbMode);

  const filtered = loadLocalEntries().filter(
    (e) =>
      e.period === period &&
      e.periodKey === periodKey &&
      (e.difficulty ?? "NORMAL") === difficulty &&
      (e.mode ?? "CLASSIC") === gameMode
  );

  const byUser = new Map<string, LeaderboardTrackerEntry>();
  for (const entry of filtered) {
    byUser.set(entry.username, toTrackerEntry(entry.username, entry));
  }
  return [...byUser.values()];
}

function mapSupabaseToTrackerEntries(
  rows: SupabaseLeaderboardRow[],
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode
): LeaderboardTrackerEntry[] {
  const gameMode = dbModeToGameMode(dbMode);
  const byUser = new Map<string, LeaderboardTrackerEntry>();

  for (const row of rows) {
    if ((row.difficulty ?? "NORMAL") !== difficulty) continue;
    const username = row.coach_name ?? row.player_name ?? "Unknown";
    const existing = byUser.get(username);

    const candidate = toTrackerEntry(username, {
      squadValue: row.score,
      achievedAt: row.updated_at ?? row.created_at,
      difficulty: (row.difficulty ?? "NORMAL") as GameDifficulty,
      mode: gameMode,
      totalWins: row.wins ?? 0,
      totalLosses: row.losses ?? 0,
      perfectRuns: row.perfect_runs ?? 0,
      bestRecordWins: row.best_record_wins ?? 0,
      bestRecordLosses: row.best_record_losses ?? 0,
      bestWinPercentage: row.best_win_percentage ?? 0,
      challengeCupWins: row.challenge_cup_wins ?? 0,
    });

    if (!existing || candidate.squadValue > existing.squadValue) {
      byUser.set(username, candidate);
    }
  }

  return [...byUser.values()];
}

function mapTrackerRowsToLegacy(
  rows: LeaderboardTrackerRow[],
  entries: LeaderboardTrackerEntry[]
): LeaderboardRow[] {
  const valueByUser = new Map(entries.map((e) => [e.username, e.squadValue]));
  return rows.map((row) => ({
    rank: row.rank,
    username: row.username,
    squadValue: valueByUser.get(row.username) ?? 0,
    achievedAt: row.achievedAt,
    difficulty: row.difficulty,
    isCurrentUser: row.isCurrentUser,
  }));
}

async function fetchTrackerEntriesFromSupabase(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode
): Promise<LeaderboardTrackerEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let query = supabase
      .from("leaderboard")
      .select(
        "id, player_name, coach_name, user_id, score, mode, difficulty, wins, losses, perfect_runs, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, created_at, updated_at"
      )
      .eq("mode", dbMode)
      .eq("difficulty", difficulty)
      .limit(250);

    const periodStart = getPeriodStart(period);
    if (periodStart) {
      query = query.gte("created_at", periodStart.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return mapSupabaseToTrackerEntries(
      (data ?? []) as SupabaseLeaderboardRow[],
      difficulty,
      dbMode
    );
  } catch (error) {
    console.error("[leaderboard] Supabase fetch failed, using local fallback:", error);
    return null;
  }
}

async function insertToSupabase(
  coachName: string,
  userId: string,
  stats: ReturnType<typeof mergeLeaderboardStats>,
  dbMode: LeaderboardDbMode,
  difficulty: GameDifficulty
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data: existing } = await supabase
      .from("leaderboard")
      .select(
        "id, score, wins, losses, perfect_runs, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins"
      )
      .eq("user_id", userId)
      .eq("mode", dbMode)
      .eq("difficulty", difficulty)
      .maybeSingle();

    const payload = {
      score: stats.squadValue,
      wins: stats.totalWins,
      losses: stats.totalLosses,
      perfect_runs: stats.perfectRuns,
      best_record_wins: stats.bestRecordWins,
      best_record_losses: stats.bestRecordLosses,
      best_win_percentage: stats.bestWinPercentage,
      challenge_cup_wins: stats.challengeCupWins,
      coach_name: coachName,
      player_name: coachName,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from("leaderboard")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("leaderboard").insert({
      ...payload,
      user_id: userId,
      mode: dbMode,
      difficulty,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[leaderboard] Supabase upsert failed:", error);
  }
}

function saveLocalEntry(
  username: string,
  mode: GameMode,
  difficulty: GameDifficulty,
  stats: ReturnType<typeof mergeLeaderboardStats>,
  achievedAt: Date
): void {
  const periods: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];
  let entries = loadLocalEntries();

  for (const period of periods) {
    const periodKey = getPeriodKey(period, achievedAt);
    const existingIndex = entries.findIndex(
      (e) =>
        e.username === username &&
        e.mode === mode &&
        (e.difficulty ?? "NORMAL") === difficulty &&
        e.period === period &&
        e.periodKey === periodKey
    );

    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...existing,
        squadValue: stats.squadValue,
        totalWins: stats.totalWins,
        totalLosses: stats.totalLosses,
        perfectRuns: stats.perfectRuns,
        bestRecordWins: stats.bestRecordWins,
        bestRecordLosses: stats.bestRecordLosses,
        bestWinPercentage: stats.bestWinPercentage,
        challengeCupWins: stats.challengeCupWins,
        achievedAt: achievedAt.toISOString(),
      };
      continue;
    }

    entries.push({
      id: `${Date.now()}-${period}-${Math.random().toString(36).slice(2, 8)}`,
      username,
      squadValue: stats.squadValue,
      achievedAt: achievedAt.toISOString(),
      period,
      periodKey,
      mode,
      difficulty,
      totalWins: stats.totalWins,
      totalLosses: stats.totalLosses,
      perfectRuns: stats.perfectRuns,
      bestRecordWins: stats.bestRecordWins,
      bestRecordLosses: stats.bestRecordLosses,
      bestWinPercentage: stats.bestWinPercentage,
      challengeCupWins: stats.challengeCupWins,
    });
  }

  saveLocalEntries(entries);
}

function getExistingLocalStats(
  username: string,
  mode: GameMode,
  difficulty: GameDifficulty
): Partial<LeaderboardTrackerEntry> | null {
  const allTime = loadLocalEntries().find(
    (e) =>
      e.username === username &&
      e.mode === mode &&
      e.difficulty === difficulty &&
      e.period === "ALL_TIME"
  );
  return allTime ? toTrackerEntry(username, allTime) : null;
}

async function getExistingRemoteStats(
  userId: string,
  dbMode: LeaderboardDbMode,
  difficulty: GameDifficulty
): Promise<Partial<LeaderboardTrackerEntry> | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data } = await supabase
      .from("leaderboard")
      .select(
        "score, wins, losses, perfect_runs, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins"
      )
      .eq("user_id", userId)
      .eq("mode", dbMode)
      .eq("difficulty", difficulty)
      .maybeSingle();

    if (!data) return null;

    return {
      squadValue: data.score ?? 0,
      totalWins: data.wins ?? 0,
      totalLosses: data.losses ?? 0,
      perfectRuns: data.perfect_runs ?? 0,
      bestRecordWins: data.best_record_wins ?? 0,
      bestRecordLosses: data.best_record_losses ?? 0,
      bestWinPercentage: data.best_win_percentage ?? 0,
      challengeCupWins: data.challenge_cup_wins ?? 0,
    };
  } catch {
    return null;
  }
}

export async function addLeaderboardEntry(
  squadValue: number,
  mode: GameMode,
  difficulty: GameDifficulty = "NORMAL",
  options?: {
    wins?: number;
    losses?: number;
    isPerfectSeason?: boolean;
    cupWon?: boolean;
    achievedAt?: Date;
  }
): Promise<void> {
  if (!isLoggedIn()) {
    console.warn("[leaderboard] Skipped save — login required for online leaderboard.");
    return;
  }

  const userId = getAuthUserId();
  const username = getUsername();
  if (!userId || !username) return;
  const achievedAt = options?.achievedAt ?? new Date();
  const wins = options?.wins ?? 0;
  const losses = options?.losses ?? 0;
  const dbMode = gameModeToDbMode(mode);

  const localExisting = getExistingLocalStats(username, mode, difficulty);
  const remoteExisting = await getExistingRemoteStats(userId, dbMode, difficulty);
  const merged = mergeLeaderboardStats(remoteExisting ?? localExisting, {
    squadValue,
    wins,
    losses,
    isPerfectSeason: options?.isPerfectSeason,
    cupWon: options?.cupWon,
  });

  saveLocalEntry(username, mode, difficulty, merged, achievedAt);
  await insertToSupabase(username, userId, merged, dbMode, difficulty);
}

export async function getTrackerLeaderboardAsync(
  tracker: LeaderboardTrackerType,
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  dbMode: LeaderboardDbMode = "super-league"
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const remote = await fetchTrackerEntriesFromSupabase(period, difficulty, dbMode);
  const entries =
    remote ?? mapLocalToTrackerEntries(period, difficulty, dbMode);

  return {
    rows: rankByTracker(entries, tracker, limit, currentUser),
    source: remote ? "remote" : "local",
  };
}

export function getLeaderboard(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50
): LeaderboardRow[] {
  const entries = mapLocalToTrackerEntries(period, difficulty, "super-league");
  const rows = rankByTracker(entries, "squad_value", limit, getUsername() ?? "");
  return mapTrackerRowsToLegacy(rows, entries);
}

export async function getLeaderboardAsync(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  dbMode: LeaderboardDbMode = "super-league"
): Promise<{ rows: LeaderboardRow[]; source: "remote" | "local" }> {
  const remote = await fetchTrackerEntriesFromSupabase(period, difficulty, dbMode);
  const entries =
    remote ?? mapLocalToTrackerEntries(period, difficulty, dbMode);
  const rows = rankByTracker(
    entries,
    "squad_value",
    limit,
    getUsername() ?? ""
  );
  return {
    rows: mapTrackerRowsToLegacy(rows, entries),
    source: remote ? "remote" : "local",
  };
}

export interface CupWinsLeaderboardRow {
  rank: number;
  username: string;
  totalWins: number;
  totalLosses: number;
  isCurrentUser?: boolean;
}

export async function getCupWinsLeaderboardAsync(
  limit = 50
): Promise<CupWinsLeaderboardRow[]> {
  const result = await getTrackerLeaderboardAsync(
    "challenge_cup_wins",
    "ALL_TIME",
    "NORMAL",
    limit,
    "challenge-cup"
  );

  return result.rows.map((row) => ({
    rank: row.rank,
    username: row.username,
    totalWins: Number(row.statDisplay) || 0,
    totalLosses: 0,
    isCurrentUser: row.isCurrentUser,
  }));
}
