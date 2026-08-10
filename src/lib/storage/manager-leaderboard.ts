import {
  getDefaultTrackerForManagerDbMode,
  getTrackersForManagerDbMode,
  isTrackerValidForManagerDbMode,
  rankByTracker,
  type LeaderboardTrackerEntry,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
  type ManagerLeaderboardDbMode,
} from "../leaderboard-trackers";
import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import {
  loadManagerStats,
} from "../manager/managerStats";
import type { ManagerLifetimeStats } from "../manager/types";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";

const LOCAL_GUEST_KEY = "__local_guest__";
const SUPER_LEAGUE_MODE = "manager-super-league";
const CHALLENGE_CUP_MODE = "manager-challenge-cup";

/**
 * Manager leaderboard WCC Wins payload version. 1 = initial rollout —
 * old rows with no `wcc_wins` column (or stale `winless_seasons` data,
 * which is ignored) safely default to 0 via `?? 0` on read.
 */
export const MANAGER_WCC_WINS_VERSION = 1;

export const MANAGER_LEADERBOARD_MODES: {
  id: ManagerLeaderboardDbMode;
  label: string;
}[] = [
  { id: "manager-super-league", label: "Super League" },
  { id: "manager-challenge-cup", label: "Challenge Cup" },
];

export {
  getDefaultTrackerForManagerDbMode,
  getTrackersForManagerDbMode,
  isTrackerValidForManagerDbMode,
  type ManagerLeaderboardDbMode,
};

interface ManagerTrackerLeaderboardEntry {
  userId?: string;
  username: string;
  stats: Omit<
    LeaderboardTrackerEntry,
    "username" | "achievedAt" | "difficulty" | "mode"
  >;
  updatedAt: string;
}

type LocalManagerLeaderboardStore = {
  tracker: Record<string, ManagerTrackerLeaderboardEntry>;
};

function managerStatsToTrackerPayload(
  stats: ManagerLifetimeStats
): Omit<LeaderboardTrackerEntry, "username" | "achievedAt" | "difficulty" | "mode"> {
  const wins = Math.round(stats.wins);
  const losses = Math.round(stats.losses);
  const games = wins + losses;
  const bestWins = stats.bestRecordWins ?? wins;
  const bestLosses = stats.bestRecordLosses ?? losses;
  const bestGames = bestWins + bestLosses;
  return {
    squadValue: 0,
    totalWins: wins,
    totalLosses: losses,
    perfectRuns: Math.round(stats.perfectSeasons),
    wccWins: Math.round(stats.worldClubChallengeWins ?? 0),
    bestRecordWins: bestWins,
    bestRecordLosses: bestLosses,
    bestWinPercentage: bestGames > 0 ? Math.round((bestWins / bestGames) * 100) : 0,
    challengeCupWins: Math.round(stats.challengeCups),
    cupFinals: Math.round(stats.cupFinals),
    bestCupFinishRank: 0,
    bestCupFinishLabel: "",
    cupWinPercentage: 0,
    leagueTitles: Math.round(stats.leagueTitles),
    superLeagueTitles: Math.round(stats.superLeagueTitles),
    seasonsCompleted: Math.round(stats.seasonsCompleted),
  };
}

function hasManagerLeaderboardActivity(stats: ManagerLifetimeStats): boolean {
  return (
    stats.seasonsCompleted > 0 ||
    stats.careersStarted > 0 ||
    stats.wins > 0 ||
    stats.losses > 0 ||
    stats.leagueTitles > 0 ||
    stats.superLeagueTitles > 0 ||
    stats.challengeCups > 0 ||
    stats.worldClubChallengeWins > 0
  );
}

function loadLocalStore(): LocalManagerLeaderboardStore {
  if (typeof window === "undefined") {
    return { tracker: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.managerLeaderboard);
    if (!raw) return { tracker: {} };
    const parsed = JSON.parse(raw) as Partial<LocalManagerLeaderboardStore>;
    return {
      tracker: parsed.tracker ?? {},
    };
  } catch {
    return { tracker: {} };
  }
}

function saveLocalStore(store: LocalManagerLeaderboardStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.managerLeaderboard, JSON.stringify(store));
}

function updateLocalTrackerEntry(
  username: string,
  stats: ManagerLifetimeStats,
  userId?: string
): void {
  const payload = managerStatsToTrackerPayload(stats);
  const store = loadLocalStore();
  const existing = store.tracker[username];
  store.tracker[username] = {
    username,
    stats: payload,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  saveLocalStore(store);
}

async function upsertTrackerModeOnline(
  mode: string,
  stats: ManagerLifetimeStats
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured
  ) {
    return;
  }

  const payload = managerStatsToTrackerPayload(stats);

  try {
    const { data: existing, error: selectError } = await supabase
      .from("leaderboard")
      .select("id")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .maybeSingle();

    if (selectError) throw selectError;

    const row = {
      coach_name: coachName,
      player_name: coachName,
      score: mode === SUPER_LEAGUE_MODE ? stats.leagueTitles : 0,
      league_titles: mode === SUPER_LEAGUE_MODE ? stats.leagueTitles : 0,
      wins: payload.totalWins,
      losses: payload.totalLosses,
      perfect_runs: payload.perfectRuns,
      wcc_wins: payload.wccWins,
      seasons_completed: payload.seasonsCompleted,
      best_record_wins: payload.bestRecordWins,
      best_record_losses: payload.bestRecordLosses,
      best_win_percentage: payload.bestWinPercentage,
      challenge_cup_wins: payload.challengeCupWins,
      cup_finals: payload.cupFinals,
      mode_variant: "current",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("leaderboard")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("leaderboard").insert({
      ...row,
      user_id: userId,
      mode,
      difficulty: "NORMAL",
    });
    if (error) throw error;
  } catch (err) {
    console.error("[manager-leaderboard] tracker submit failed:", err);
  }
}

export function syncManagerLeaderboard(
  stats: ManagerLifetimeStats = loadManagerStats()
): void {
  if (!hasManagerLeaderboardActivity(stats)) return;

  if (isLoggedIn()) {
    const username = getUsername();
    const userId = getAuthUserId() ?? undefined;
    if (!username || isGuestLeaderboardName(username)) return;

    updateLocalTrackerEntry(username, stats, userId);
    void upsertTrackerModeOnline(SUPER_LEAGUE_MODE, stats);
    void upsertTrackerModeOnline(CHALLENGE_CUP_MODE, stats);
    return;
  }

  updateLocalTrackerEntry(LOCAL_GUEST_KEY, stats);
}

export function syncManagerLeaderboardOnLoad(): void {
  syncManagerLeaderboard();
}

async function fetchRemoteTrackerEntries(
  mode: string
): Promise<LeaderboardTrackerEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select(
        "coach_name, score, league_titles, wins, losses, perfect_runs, wcc_wins, seasons_completed, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, cup_finals, updated_at, created_at"
      )
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data?.length) return [];

    return data
      .filter((row) => row.coach_name)
      .map((row) => ({
        username: row.coach_name as string,
        squadValue: 0,
        achievedAt:
          (row.updated_at as string) ?? (row.created_at as string) ?? "",
        difficulty: "NORMAL" as const,
        mode: "CLASSIC" as const,
        totalWins: row.wins ?? 0,
        totalLosses: row.losses ?? 0,
        perfectRuns: row.perfect_runs ?? 0,
        wccWins: (row as { wcc_wins?: number }).wcc_wins ?? 0,
        bestRecordWins: row.best_record_wins ?? row.wins ?? 0,
        bestRecordLosses: row.best_record_losses ?? row.losses ?? 0,
        bestWinPercentage: row.best_win_percentage ?? 0,
        challengeCupWins: row.challenge_cup_wins ?? 0,
        cupFinals: row.cup_finals ?? 0,
        bestCupFinishRank: 0,
        bestCupFinishLabel: "",
        cupWinPercentage: 0,
        leagueTitles:
          typeof (row as { league_titles?: number }).league_titles === "number"
            ? (row as { league_titles: number }).league_titles
            : typeof row.score === "number"
              ? row.score
              : 0,
        superLeagueTitles: 0,
        seasonsCompleted:
          (row as { seasons_completed?: number }).seasons_completed ?? 0,
      }));
  } catch (err) {
    console.error("[manager-leaderboard] tracker fetch failed:", err);
    return null;
  }
}

function buildLiveTrackerEntry(
  stats: ManagerLifetimeStats,
  currentUser: string
): LeaderboardTrackerEntry | null {
  if (!hasManagerLeaderboardActivity(stats)) return null;
  if (currentUser && !isGuestLeaderboardName(currentUser)) {
    return {
      username: currentUser,
      achievedAt: new Date().toISOString(),
      difficulty: "NORMAL",
      mode: "CLASSIC",
      ...managerStatsToTrackerPayload(stats),
    };
  }
  return {
    username: "You",
    achievedAt: new Date().toISOString(),
    difficulty: "NORMAL",
    mode: "CLASSIC",
    ...managerStatsToTrackerPayload(stats),
  };
}

function buildLocalTrackerEntries(): LeaderboardTrackerEntry[] {
  const store = loadLocalStore();
  return Object.values(store.tracker)
    .filter((entry) => !isGuestLeaderboardName(entry.username))
    .map((entry) => ({
      username: entry.username,
      achievedAt: entry.updatedAt,
      difficulty: "NORMAL" as const,
      mode: "CLASSIC" as const,
      ...entry.stats,
      seasonsCompleted: entry.stats.seasonsCompleted ?? 0,
    }));
}

async function getManagerTrackerLeaderboardAsync(
  dbMode: "manager-super-league" | "manager-challenge-cup",
  tracker: LeaderboardTrackerType,
  limit: number
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const stats = loadManagerStats();
  const remoteMode =
    dbMode === "manager-super-league" ? SUPER_LEAGUE_MODE : CHALLENGE_CUP_MODE;

  syncManagerLeaderboard(stats);

  const liveEntry = buildLiveTrackerEntry(stats, currentUser);
  const remote = await fetchRemoteTrackerEntries(remoteMode);
  const local = buildLocalTrackerEntries();

  const merged = new Map<string, LeaderboardTrackerEntry>();
  if (remote !== null) {
    for (const entry of remote) {
      merged.set(entry.username.toLowerCase(), entry);
    }
  } else {
    for (const entry of local) {
      merged.set(entry.username.toLowerCase(), entry);
    }
  }
  if (liveEntry) {
    merged.set(liveEntry.username.toLowerCase(), liveEntry);
  }

  let entries = [...merged.values()];
  if (tracker === "manager_league_titles") {
    entries = entries.filter((entry) => entry.leagueTitles > 0);
  }
  if (tracker === "manager_seasons_completed") {
    entries = entries.filter((entry) => (entry.seasonsCompleted ?? 0) > 0);
  }

  return {
    source: remote !== null ? "remote" : "local",
    rows: rankByTracker(entries, tracker, limit, currentUser, {
      recordMetric: "best",
    }),
  };
}

export async function getManagerLeaderboardAsync(
  dbMode: ManagerLeaderboardDbMode,
  tracker: LeaderboardTrackerType,
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  if (
    dbMode === "manager-super-league" ||
    dbMode === "manager-challenge-cup"
  ) {
    return getManagerTrackerLeaderboardAsync(dbMode, tracker, limit);
  }

  return { rows: [], source: "local" };
}
