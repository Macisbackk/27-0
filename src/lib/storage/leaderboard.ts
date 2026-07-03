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
  ModeVariant,
} from "../types";
import { normalizeModeVariant } from "../mode-variant";
import { STORAGE_KEYS } from "./keys";
import { getAuthUserId, isLoggedIn } from "../auth-session";
import { getUsername } from "./user";
import { getTrophyCabinetLeaderboardAsync } from "./trophy-cabinet-leaderboard";
import { getAllStats } from "./stats";
import type { UserStatsData } from "../types";

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
  winlessSeasons: number;
  bestRecordWins: number;
  bestRecordLosses: number;
  bestWinPercentage: number;
  challengeCupWins: number;
  cupFinals: number;
  bestCupFinishRank: number;
  bestCupFinishLabel: string;
  cupWinPercentage: number;
  leagueTitles?: number;
  superLeagueTitles?: number;
  /** Super League Current vs Era — defaults to current for legacy rows. */
  modeVariant?: ModeVariant;
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
  winless_seasons: number | null;
  best_record_wins: number | null;
  best_record_losses: number | null;
  best_win_percentage: number | null;
  challenge_cup_wins: number | null;
  cup_finals: number | null;
  best_cup_finish: string | null;
  best_cup_finish_rank: number | null;
  cup_win_percentage: number | null;
  mode_variant: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type LeaderboardDbMode =
  | "super-league"
  | "draft"
  | "fantasy"
  | "club-funds"
  | "trophy-cabinet"
  | "cup-team-wins";

export function normalizeLeaderboardGameMode(mode: GameMode): GameMode {
  return mode;
}

export function gameModeToDbMode(mode: GameMode): LeaderboardDbMode {
  if (mode === "DRAFT") return "draft";
  if (mode === "FANTASY") return "fantasy";
  return "super-league";
}

function dbModeToGameMode(dbMode: LeaderboardDbMode): GameMode {
  if (dbMode === "draft") return "DRAFT";
  if (dbMode === "fantasy") return "FANTASY";
  return "CLASSIC";
}

function resolveLeaderboardDifficulty(
  dbMode: LeaderboardDbMode,
  difficulty: GameDifficulty
): GameDifficulty {
  return dbMode === "fantasy" ? "NORMAL" : difficulty;
}

const SUPABASE_SELECT_EXTENDED =
  "id, player_name, coach_name, user_id, score, mode, difficulty, mode_variant, wins, losses, perfect_runs, winless_seasons, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, cup_finals, best_cup_finish, best_cup_finish_rank, cup_win_percentage, created_at, updated_at";

const SUPABASE_SELECT_BASE =
  "id, player_name, coach_name, user_id, score, mode, difficulty, mode_variant, wins, losses, perfect_runs, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, created_at, updated_at";

function applySquadValueLeaderboardReset(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEYS.squadValueLeaderboardReset)) return;

  const entries = loadLocalEntriesRaw().map((entry) => ({
    ...entry,
    squadValue: 0,
  }));
  saveLocalEntries(entries);
  localStorage.setItem(STORAGE_KEYS.squadValueLeaderboardReset, "1");
}

function loadLocalEntriesRaw(): StoredLeaderboardEntry[] {
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
      winlessSeasons: entry.winlessSeasons ?? 0,
      bestRecordWins: entry.bestRecordWins ?? entry.wins ?? 0,
      bestRecordLosses: entry.bestRecordLosses ?? entry.losses ?? 0,
      bestWinPercentage: entry.bestWinPercentage ?? 0,
      challengeCupWins: entry.challengeCupWins ?? 0,
      cupFinals: entry.cupFinals ?? 0,
      bestCupFinishRank: entry.bestCupFinishRank ?? 0,
      bestCupFinishLabel: entry.bestCupFinishLabel ?? "",
      cupWinPercentage: entry.cupWinPercentage ?? 0,
      modeVariant: normalizeModeVariant(entry.modeVariant),
    }));
  } catch {
    return [];
  }
}

function loadLocalEntries(): StoredLeaderboardEntry[] {
  applySquadValueLeaderboardReset();
  return loadLocalEntriesRaw();
}

function saveLocalEntries(entries: StoredLeaderboardEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(entries));
}

/** Clears guest/offline leaderboard cache in this browser. */
export function clearLocalLeaderboard(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.leaderboard);
  localStorage.removeItem(STORAGE_KEYS.cupLeaderboard);
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
    winlessSeasons: row.winlessSeasons ?? 0,
    bestRecordWins: row.bestRecordWins ?? 0,
    bestRecordLosses: row.bestRecordLosses ?? 0,
    bestWinPercentage: row.bestWinPercentage ?? 0,
    challengeCupWins: row.challengeCupWins ?? 0,
    cupFinals: row.cupFinals ?? 0,
    bestCupFinishRank: row.bestCupFinishRank ?? 0,
    bestCupFinishLabel: row.bestCupFinishLabel ?? "",
    cupWinPercentage: row.cupWinPercentage ?? 0,
    leagueTitles: row.leagueTitles ?? 0,
    superLeagueTitles: row.superLeagueTitles ?? 0,
  };
}

function resolveLeaderboardModeVariant(
  dbMode: LeaderboardDbMode,
  modeVariant: ModeVariant = "current"
): ModeVariant {
  if (dbMode === "super-league") {
    return normalizeModeVariant(modeVariant);
  }
  return "current";
}

export function isGuestLeaderboardName(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "guest" ||
    normalized === "coach" ||
    normalized === "__local_guest__"
  );
}

function mapLocalToTrackerEntries(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode,
  modeVariant: ModeVariant = "current"
): LeaderboardTrackerEntry[] {
  const periodKey = getPeriodKey(period);
  const gameMode = dbModeToGameMode(dbMode);
  const effectiveDifficulty = resolveLeaderboardDifficulty(dbMode, difficulty);
  const effectiveVariant = resolveLeaderboardModeVariant(dbMode, modeVariant);

  const filtered = loadLocalEntries().filter(
    (e) =>
      e.period === period &&
      e.periodKey === periodKey &&
      (e.difficulty ?? "NORMAL") === effectiveDifficulty &&
      normalizeLeaderboardGameMode(e.mode ?? "CLASSIC") === gameMode &&
      normalizeModeVariant(e.modeVariant) === effectiveVariant
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
  dbMode: LeaderboardDbMode,
  modeVariant: ModeVariant = "current"
): LeaderboardTrackerEntry[] {
  const gameMode = dbModeToGameMode(dbMode);
  const effectiveVariant = resolveLeaderboardModeVariant(dbMode, modeVariant);
  const byUser = new Map<string, LeaderboardTrackerEntry>();

  for (const row of rows) {
    if ((row.difficulty ?? "NORMAL") !== difficulty) continue;
    if (dbMode === "super-league") {
      const rowVariant = normalizeModeVariant(
        row.mode_variant != null ? row.mode_variant : effectiveVariant
      );
      if (rowVariant !== effectiveVariant) continue;
    }
    const username = row.coach_name ?? row.player_name ?? "Unknown";
    if (isGuestLeaderboardName(username)) continue;
    const userKey = row.user_id ?? username;
    const existing = byUser.get(userKey);

    const candidate = toTrackerEntry(username, {
      squadValue: row.score,
      achievedAt: row.updated_at ?? row.created_at,
      difficulty: (row.difficulty ?? "NORMAL") as GameDifficulty,
      mode: gameMode,
      totalWins: row.wins ?? 0,
      totalLosses: row.losses ?? 0,
      perfectRuns: row.perfect_runs ?? 0,
      winlessSeasons: row.winless_seasons ?? 0,
      bestRecordWins: row.best_record_wins ?? row.wins ?? 0,
      bestRecordLosses: row.best_record_losses ?? row.losses ?? 0,
      bestWinPercentage: row.best_win_percentage ?? 0,
      challengeCupWins: row.challenge_cup_wins ?? 0,
      cupFinals: row.cup_finals ?? 0,
      bestCupFinishRank: row.best_cup_finish_rank ?? 0,
      bestCupFinishLabel: row.best_cup_finish ?? "",
      cupWinPercentage: row.cup_win_percentage ?? 0,
    });

    if (!existing) {
      byUser.set(userKey, candidate);
      continue;
    }

    // One row per account — prefer the row with richer merged stats.
    const existingCupRank = existing.bestCupFinishRank ?? 0;
    const candidateCupRank = candidate.bestCupFinishRank ?? 0;
    const shouldReplace =
      candidate.squadValue > existing.squadValue ||
      candidate.totalWins > existing.totalWins ||
      candidate.challengeCupWins > existing.challengeCupWins ||
      candidateCupRank > existingCupRank;

    if (shouldReplace) {
      byUser.set(userKey, candidate);
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
  dbMode: LeaderboardDbMode,
  modeVariant: ModeVariant = "current"
): Promise<LeaderboardTrackerEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  const effectiveDifficulty = resolveLeaderboardDifficulty(dbMode, difficulty);
  const effectiveVariant = resolveLeaderboardModeVariant(dbMode, modeVariant);

  const runQuery = async (select: string) => {
    let query = supabase
      .from("leaderboard")
      .select(select)
      .eq("mode", dbMode)
      .eq("difficulty", effectiveDifficulty)
      .limit(250);

    if (dbMode === "super-league") {
      query = query.eq("mode_variant", effectiveVariant);
    }

    const periodStart = getPeriodStart(period);
    if (periodStart) {
      query = query.gte("created_at", periodStart.toISOString());
    }

    return query;
  };

  try {
    let result = await runQuery(SUPABASE_SELECT_EXTENDED);
    if (result.error) {
      console.warn(
        "[leaderboard] Extended Supabase select failed, retrying base columns:",
        result.error.message
      );
      result = await runQuery(SUPABASE_SELECT_BASE);
    }
    if (result.error) throw result.error;

    return mapSupabaseToTrackerEntries(
      (result.data ?? []) as unknown as SupabaseLeaderboardRow[],
      effectiveDifficulty,
      dbMode,
      modeVariant
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
  difficulty: GameDifficulty,
  modeVariant: ModeVariant = "current"
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const effectiveVariant = resolveLeaderboardModeVariant(dbMode, modeVariant);

  try {
    let existingQuery = supabase
      .from("leaderboard")
      .select(
        "id, score, wins, losses, perfect_runs, winless_seasons, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, cup_finals, best_cup_finish, best_cup_finish_rank, cup_win_percentage"
      )
      .eq("user_id", userId)
      .eq("mode", dbMode)
      .eq("difficulty", difficulty);

    if (dbMode === "super-league") {
      existingQuery = existingQuery.eq("mode_variant", effectiveVariant);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    const payload = {
      score: stats.squadValue,
      wins: stats.totalWins,
      losses: stats.totalLosses,
      perfect_runs: stats.perfectRuns,
      winless_seasons: stats.winlessSeasons,
      best_record_wins: stats.bestRecordWins,
      best_record_losses: stats.bestRecordLosses,
      best_win_percentage: stats.bestWinPercentage,
      challenge_cup_wins: stats.challengeCupWins,
      cup_finals: stats.cupFinals,
      best_cup_finish: stats.bestCupFinishLabel || null,
      best_cup_finish_rank: stats.bestCupFinishRank,
      cup_win_percentage: stats.cupWinPercentage,
      mode_variant: effectiveVariant,
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

function isRicherTrackerEntry(
  candidate: LeaderboardTrackerEntry,
  existing: LeaderboardTrackerEntry
): boolean {
  if (candidate.squadValue > existing.squadValue) return true;
  if (candidate.totalWins > existing.totalWins) return true;
  if (candidate.challengeCupWins > existing.challengeCupWins) return true;
  if ((candidate.bestCupFinishRank ?? 0) > (existing.bestCupFinishRank ?? 0)) {
    return true;
  }
  const cWins = candidate.bestRecordWins ?? candidate.totalWins;
  const eWins = existing.bestRecordWins ?? existing.totalWins;
  const cLosses = candidate.bestRecordLosses ?? candidate.totalLosses;
  const eLosses = existing.bestRecordLosses ?? existing.totalLosses;
  return cWins > eWins || (cWins === eWins && cLosses < eLosses);
}

function mergeTrackerEntryLists(
  ...lists: LeaderboardTrackerEntry[][]
): LeaderboardTrackerEntry[] {
  const byUser = new Map<string, LeaderboardTrackerEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const existing = byUser.get(entry.username);
      if (!existing || isRicherTrackerEntry(entry, existing)) {
        byUser.set(entry.username, entry);
      }
    }
  }
  return [...byUser.values()];
}

function hasTrackerActivity(entry: LeaderboardTrackerEntry): boolean {
  return (
    entry.squadValue > 0 ||
    entry.totalWins > 0 ||
    entry.totalLosses > 0 ||
    entry.perfectRuns > 0 ||
    entry.winlessSeasons > 0 ||
    entry.challengeCupWins > 0
  );
}

function userStatsToClassicTrackerEntry(
  username: string,
  stats: UserStatsData,
  difficulty: GameDifficulty
): LeaderboardTrackerEntry {
  const wins = stats.seasonWins + stats.playoffWins;
  const losses = stats.seasonLosses + stats.playoffLosses;
  const games = wins + losses;
  const bestWins = stats.bestRecordWins || stats.bestOverallSeasonWins || wins;
  const bestLosses =
    stats.bestRecordLosses || stats.bestOverallSeasonLosses || losses;

  return {
    username,
    squadValue: stats.highestSquadValue,
    achievedAt: new Date().toISOString(),
    difficulty,
    mode: "CLASSIC",
    totalWins: wins,
    totalLosses: losses,
    perfectRuns: stats.totalPerfectSeasons,
    winlessSeasons: stats.totalWinlessSeasons,
    bestRecordWins: bestWins,
    bestRecordLosses: bestLosses,
    bestWinPercentage: games > 0 ? (wins / games) * 100 : 0,
    challengeCupWins: 0,
    cupFinals: 0,
    bestCupFinishRank: 0,
    bestCupFinishLabel: "",
    cupWinPercentage: 0,
    leagueTitles: 0,
    superLeagueTitles: 0,
  };
}

function getSupplementalEraNormalEntries(
  difficulty: GameDifficulty
): LeaderboardTrackerEntry[] {
  const username = getUsername();
  if (!username) return [];

  const entry = userStatsToClassicTrackerEntry(
    username,
    getAllStats().eraNormal,
    difficulty
  );
  return hasTrackerActivity(entry) ? [entry] : [];
}

function getSupplementalNormalCurrentEntries(
  difficulty: GameDifficulty
): LeaderboardTrackerEntry[] {
  const username = getUsername();
  if (!username) return [];

  const bucket = difficulty === "HARD" ? "hard" : "normal";
  const entry = userStatsToClassicTrackerEntry(
    username,
    getAllStats()[bucket],
    difficulty
  );
  return hasTrackerActivity(entry) ? [entry] : [];
}

function buildTrackerEntries(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty,
  dbMode: LeaderboardDbMode,
  modeVariant: ModeVariant,
  remote: LeaderboardTrackerEntry[] | null
): LeaderboardTrackerEntry[] {
  const local = mapLocalToTrackerEntries(period, difficulty, dbMode, modeVariant);
  let entries =
    remote !== null ? mergeTrackerEntryLists(remote, local) : local;

  if (period !== "ALL_TIME") return entries;

  if (dbMode === "super-league" && modeVariant === "era") {
    entries = mergeTrackerEntryLists(
      entries,
      getSupplementalEraNormalEntries(difficulty)
    );
  } else if (
    dbMode === "super-league" &&
    modeVariant === "current" &&
    period === "ALL_TIME"
  ) {
    entries = mergeTrackerEntryLists(
      entries,
      getSupplementalNormalCurrentEntries(difficulty)
    );
  }

  return entries;
}

function saveLocalEntry(
  username: string,
  mode: GameMode,
  difficulty: GameDifficulty,
  stats: ReturnType<typeof mergeLeaderboardStats>,
  achievedAt: Date,
  modeVariant: ModeVariant = "current"
): void {
  const periods: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];
  let entries = loadLocalEntries();
  const storageMode = normalizeLeaderboardGameMode(mode);
  const effectiveVariant =
    storageMode === "CLASSIC"
      ? normalizeModeVariant(modeVariant)
      : "current";

  for (const period of periods) {
    const periodKey = getPeriodKey(period, achievedAt);
    const existingIndex = entries.findIndex(
      (e) =>
        e.username === username &&
        normalizeLeaderboardGameMode(e.mode) === storageMode &&
        (e.difficulty ?? "NORMAL") === difficulty &&
        e.period === period &&
        e.periodKey === periodKey &&
        normalizeModeVariant(e.modeVariant) === effectiveVariant
    );

    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...existing,
        squadValue: stats.squadValue,
        totalWins: stats.totalWins,
        totalLosses: stats.totalLosses,
        perfectRuns: stats.perfectRuns,
        winlessSeasons: stats.winlessSeasons,
        bestRecordWins: stats.bestRecordWins,
        bestRecordLosses: stats.bestRecordLosses,
        bestWinPercentage: stats.bestWinPercentage,
        challengeCupWins: stats.challengeCupWins,
        cupFinals: stats.cupFinals,
        bestCupFinishRank: stats.bestCupFinishRank,
        bestCupFinishLabel: stats.bestCupFinishLabel,
        cupWinPercentage: stats.cupWinPercentage,
        modeVariant: effectiveVariant,
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
      mode: storageMode,
      difficulty,
      totalWins: stats.totalWins,
      totalLosses: stats.totalLosses,
      perfectRuns: stats.perfectRuns,
      winlessSeasons: stats.winlessSeasons,
      bestRecordWins: stats.bestRecordWins,
      bestRecordLosses: stats.bestRecordLosses,
      bestWinPercentage: stats.bestWinPercentage,
      challengeCupWins: stats.challengeCupWins,
      cupFinals: stats.cupFinals,
      bestCupFinishRank: stats.bestCupFinishRank,
      bestCupFinishLabel: stats.bestCupFinishLabel,
      cupWinPercentage: stats.cupWinPercentage,
      modeVariant: effectiveVariant,
    });
  }

  saveLocalEntries(entries);
}

function getExistingLocalStats(
  username: string,
  mode: GameMode,
  difficulty: GameDifficulty,
  modeVariant: ModeVariant = "current"
): Partial<LeaderboardTrackerEntry> | null {
  const storageMode = normalizeLeaderboardGameMode(mode);
  const effectiveVariant =
    storageMode === "CLASSIC"
      ? normalizeModeVariant(modeVariant)
      : "current";
  const allTime = loadLocalEntries().find(
    (e) =>
      e.username === username &&
      normalizeLeaderboardGameMode(e.mode) === storageMode &&
      e.difficulty === difficulty &&
      e.period === "ALL_TIME" &&
      normalizeModeVariant(e.modeVariant) === effectiveVariant
  );
  return allTime ? toTrackerEntry(username, allTime) : null;
}

async function getExistingRemoteStats(
  userId: string,
  dbMode: LeaderboardDbMode,
  difficulty: GameDifficulty,
  modeVariant: ModeVariant = "current"
): Promise<Partial<LeaderboardTrackerEntry> | null> {
  if (!isSupabaseConfigured) return null;

  const effectiveVariant = resolveLeaderboardModeVariant(dbMode, modeVariant);

  try {
    let query = supabase
      .from("leaderboard")
      .select(
        "score, wins, losses, perfect_runs, winless_seasons, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, cup_finals, best_cup_finish, best_cup_finish_rank, cup_win_percentage"
      )
      .eq("user_id", userId)
      .eq("mode", dbMode)
      .eq("difficulty", difficulty);

    if (dbMode === "super-league") {
      query = query.eq("mode_variant", effectiveVariant);
    }

    const { data } = await query.maybeSingle();

    if (!data) return null;

    return {
      squadValue: data.score ?? 0,
      totalWins: data.wins ?? 0,
      totalLosses: data.losses ?? 0,
      perfectRuns: data.perfect_runs ?? 0,
      winlessSeasons: data.winless_seasons ?? 0,
      bestRecordWins: data.best_record_wins ?? 0,
      bestRecordLosses: data.best_record_losses ?? 0,
      bestWinPercentage: data.best_win_percentage ?? 0,
      challengeCupWins: data.challenge_cup_wins ?? 0,
      cupFinals: data.cup_finals ?? 0,
      bestCupFinishRank: data.best_cup_finish_rank ?? 0,
      bestCupFinishLabel: data.best_cup_finish ?? "",
      cupWinPercentage: data.cup_win_percentage ?? 0,
      leagueTitles: 0,
      superLeagueTitles: 0,
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
    cupFinish?: string;
    isPlayoffPhaseUpdate?: boolean;
    achievedAt?: Date;
    modeVariant?: ModeVariant;
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
  const storageMode = normalizeLeaderboardGameMode(mode);
  const dbMode = gameModeToDbMode(storageMode);
  const effectiveDifficulty = resolveLeaderboardDifficulty(dbMode, difficulty);
  const modeVariant = normalizeModeVariant(options?.modeVariant);

  const localExisting = getExistingLocalStats(
    username,
    storageMode,
    effectiveDifficulty,
    modeVariant
  );
  const remoteExisting = await getExistingRemoteStats(
    userId,
    dbMode,
    effectiveDifficulty,
    modeVariant
  );
  const merged = mergeLeaderboardStats(remoteExisting ?? localExisting, {
    squadValue,
    wins,
    losses,
    isPerfectSeason: options?.isPerfectSeason,
    cupWon: options?.cupWon,
    cupFinish: options?.cupFinish,
    isPlayoffPhaseUpdate: options?.isPlayoffPhaseUpdate,
  });

  saveLocalEntry(
    username,
    storageMode,
    effectiveDifficulty,
    merged,
    achievedAt,
    modeVariant
  );
  await insertToSupabase(
    username,
    userId,
    merged,
    dbMode,
    effectiveDifficulty,
    modeVariant
  );
}

export async function getTrackerLeaderboardAsync(
  tracker: LeaderboardTrackerType,
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  dbMode: LeaderboardDbMode = "super-league",
  modeVariant: ModeVariant = "current"
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  if (dbMode === "trophy-cabinet") {
    return getTrophyCabinetLeaderboardAsync(tracker, limit);
  }

  const currentUser = getUsername() ?? "";
  const effectiveDifficulty = resolveLeaderboardDifficulty(dbMode, difficulty);
  const remote = await fetchTrackerEntriesFromSupabase(
    period,
    effectiveDifficulty,
    dbMode,
    modeVariant
  );
  const entries = buildTrackerEntries(
    period,
    effectiveDifficulty,
    dbMode,
    modeVariant,
    remote
  );

  return {
    rows: rankByTracker(entries, tracker, limit, currentUser),
    source: remote ? "remote" : "local",
  };
}

export function getLeaderboard(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  modeVariant: ModeVariant = "current"
): LeaderboardRow[] {
  const entries = mapLocalToTrackerEntries(
    period,
    difficulty,
    "super-league",
    modeVariant
  );
  const rows = rankByTracker(entries, "best_record", limit, getUsername() ?? "");
  return mapTrackerRowsToLegacy(rows, entries);
}

export async function getLeaderboardAsync(
  period: LeaderboardPeriod,
  difficulty: GameDifficulty = "NORMAL",
  limit = 50,
  dbMode: LeaderboardDbMode = "super-league",
  modeVariant: ModeVariant = "current"
): Promise<{ rows: LeaderboardRow[]; source: "remote" | "local" }> {
  const remote = await fetchTrackerEntriesFromSupabase(
    period,
    difficulty,
    dbMode,
    modeVariant
  );
  const entries = buildTrackerEntries(
    period,
    difficulty,
    dbMode,
    modeVariant,
    remote
  );
  const rows = rankByTracker(
    entries,
    "best_record",
    limit,
    getUsername() ?? ""
  );
  return {
    rows: mapTrackerRowsToLegacy(rows, entries),
    source: remote ? "remote" : "local",
  };
}
