import { getPeriodKey } from "../leaderboard";
import { isSupabaseConfigured, supabase } from "../supabase";
import type {
  GameDifficulty,
  GameMode,
  LeaderboardPeriod,
  LeaderboardRow,
} from "../types";
import { STORAGE_KEYS } from "./keys";
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
  wins?: number;
  losses?: number;
}

export interface SupabaseLeaderboardRow {
  id: string;
  player_name: string;
  score: number;
  mode: string | null;
  difficulty: string | null;
  wins: number | null;
  losses: number | null;
  created_at: string;
}

export type LeaderboardDbMode = "super-league" | "challenge-cup";

export function gameModeToDbMode(mode: GameMode): LeaderboardDbMode {
  return mode === "CHALLENGE_CUP" ? "challenge-cup" : "super-league";
}

function loadLocalEntries(): StoredLeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
    if (!raw) return [];
    return JSON.parse(raw) as StoredLeaderboardEntry[];
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

function dedupeByBestScore(
  rows: { username: string; squadValue: number; achievedAt: string; difficulty: GameDifficulty }[],
  limit: number
): LeaderboardRow[] {
  const currentUser = getUsername();
  const bestByUser = new Map<
    string,
    { squadValue: number; achievedAt: string; difficulty: GameDifficulty }
  >();

  for (const row of rows) {
    const existing = bestByUser.get(row.username);
    if (!existing || row.squadValue > existing.squadValue) {
      bestByUser.set(row.username, {
        squadValue: row.squadValue,
        achievedAt: row.achievedAt,
        difficulty: row.difficulty,
      });
    }
  }

  const sorted = [...bestByUser.entries()]
    .sort((a, b) => b[1].squadValue - a[1].squadValue)
    .slice(0, limit);

  return sorted.map(([username, data], index) => ({
    rank: index + 1,
    username,
    squadValue: data.squadValue,
    achievedAt: data.achievedAt,
    difficulty: data.difficulty,
    isCurrentUser: username === currentUser,
  }));
}

function mapLocalToRows(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode,
  limit: number
): LeaderboardRow[] {
  const periodKey = getPeriodKey(period);
  const gameMode: GameMode =
    dbMode === "challenge-cup" ? "CHALLENGE_CUP" : "CLASSIC";

  const filtered = loadLocalEntries().filter(
    (e) =>
      e.period === period &&
      e.periodKey === periodKey &&
      (e.difficulty ?? "NORMAL") === difficulty &&
      (e.mode ?? "CLASSIC") === gameMode
  );

  filtered.sort((a, b) => b.squadValue - a.squadValue);

  const seen = new Set<string>();
  const deduped: StoredLeaderboardEntry[] = [];

  for (const entry of filtered) {
    if (seen.has(entry.username)) continue;
    seen.add(entry.username);
    deduped.push(entry);
    if (deduped.length >= limit) break;
  }

  const currentUser = getUsername();
  return deduped.map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    squadValue: entry.squadValue,
    achievedAt: entry.achievedAt,
    difficulty: entry.difficulty ?? "NORMAL",
    isCurrentUser: entry.username === currentUser,
  }));
}

function mapSupabaseRows(
  rows: SupabaseLeaderboardRow[],
  difficulty: GameDifficulty,
  limit: number
): LeaderboardRow[] {
  return dedupeByBestScore(
    rows
      .filter((row) => (row.difficulty ?? "NORMAL") === difficulty)
      .map((row) => ({
        username: row.player_name,
        squadValue: row.score,
        achievedAt: row.created_at,
        difficulty: (row.difficulty ?? "NORMAL") as GameDifficulty,
      })),
    limit
  );
}

async function fetchFromSupabase(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode,
  limit: number
): Promise<LeaderboardRow[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let query = supabase
      .from("leaderboard")
      .select(
        "id, player_name, score, mode, difficulty, wins, losses, created_at"
      )
      .eq("mode", dbMode)
      .eq("difficulty", difficulty)
      .order("score", { ascending: false })
      .limit(250);

    const periodStart = getPeriodStart(period);
    if (periodStart) {
      query = query.gte("created_at", periodStart.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return mapSupabaseRows((data ?? []) as SupabaseLeaderboardRow[], difficulty, limit);
  } catch (error) {
    console.error("[leaderboard] Supabase fetch failed, using local fallback:", error);
    return null;
  }
}

async function insertToSupabase(
  username: string,
  squadValue: number,
  dbMode: LeaderboardDbMode,
  difficulty: GameDifficulty,
  wins: number,
  losses: number
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("leaderboard").insert({
      player_name: username,
      score: squadValue,
      mode: dbMode,
      difficulty,
      wins,
      losses,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[leaderboard] Supabase insert failed:", error);
  }
}

function saveLocalEntry(
  squadValue: number,
  mode: GameMode,
  difficulty: GameDifficulty,
  wins: number,
  losses: number,
  achievedAt: Date
): void {
  const username = getUsername();
  const periods: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];
  const entries = loadLocalEntries();

  for (const period of periods) {
    entries.push({
      id: `${Date.now()}-${period}-${Math.random().toString(36).slice(2, 8)}`,
      username,
      squadValue,
      achievedAt: achievedAt.toISOString(),
      period,
      periodKey: getPeriodKey(period, achievedAt),
      mode,
      difficulty,
      wins,
      losses,
    });
  }

  saveLocalEntries(entries);
}

export async function addLeaderboardEntry(
  squadValue: number,
  mode: GameMode,
  difficulty: GameDifficulty = "NORMAL",
  options?: {
    wins?: number;
    losses?: number;
    achievedAt?: Date;
  }
): Promise<void> {
  const username = getUsername();
  const achievedAt = options?.achievedAt ?? new Date();
  const wins = options?.wins ?? 0;
  const losses = options?.losses ?? 0;
  const dbMode = gameModeToDbMode(mode);

  saveLocalEntry(squadValue, mode, difficulty, wins, losses, achievedAt);
  await insertToSupabase(username, squadValue, dbMode, difficulty, wins, losses);
}

export function getLeaderboard(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50
): LeaderboardRow[] {
  return mapLocalToRows(period, difficulty, "super-league", limit);
}

export async function getLeaderboardAsync(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  dbMode: LeaderboardDbMode = "super-league"
): Promise<{ rows: LeaderboardRow[]; source: "remote" | "local" }> {
  const remote = await fetchFromSupabase(period, difficulty, dbMode, limit);
  if (remote) return { rows: remote, source: "remote" };
  return {
    rows: mapLocalToRows(period, difficulty, dbMode, limit),
    source: "local",
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
  const currentUser = getUsername();

  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("player_name, wins, losses")
      .eq("mode", "challenge-cup");

    if (error) throw error;

    const aggregated = new Map<string, { wins: number; losses: number }>();
    for (const row of data ?? []) {
      const name = row.player_name as string;
      const existing = aggregated.get(name) ?? { wins: 0, losses: 0 };
      aggregated.set(name, {
        wins: existing.wins + (row.wins ?? 0),
        losses: existing.losses + (row.losses ?? 0),
      });
    }

    return [...aggregated.entries()]
      .sort((a, b) => b[1].wins - a[1].wins)
      .slice(0, limit)
      .map(([username, stats], index) => ({
        rank: index + 1,
        username,
        totalWins: stats.wins,
        totalLosses: stats.losses,
        isCurrentUser: username === currentUser,
      }));
  } catch (error) {
    console.error("[leaderboard] Cup wins fetch failed:", error);
    return [];
  }
}
