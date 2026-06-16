import { formatClubFunds } from "../club-funds";
import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { getUsername } from "./user";
import { STORAGE_KEYS } from "./keys";
import { getClubFundsTotalEarned } from "./club-funds";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";

const LEADERBOARD_MODE = "club-funds";
const USER_STATS_MODE = "GLOBAL";
const USER_STATS_KEY = "club_funds";
const LOCAL_GUEST_KEY = "__local_guest__";

export interface ClubFundsLeaderboardEntry {
  userId?: string;
  username: string;
  totalEarned: number;
  updatedAt: string;
}

function isGuestLeaderboardName(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "guest" ||
    normalized === "coach" ||
    normalized === LOCAL_GUEST_KEY.toLowerCase()
  );
}

function loadLocalEntries(): Record<string, ClubFundsLeaderboardEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clubFundsLeaderboard);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ClubFundsLeaderboardEntry>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function saveLocalEntries(entries: Record<string, ClubFundsLeaderboardEntry>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.clubFundsLeaderboard, JSON.stringify(entries));
}

export function updateLocalClubFundsLeaderboard(
  username: string,
  totalEarned: number,
  userId?: string
): void {
  if (!username || totalEarned <= 0) return;
  const entries = loadLocalEntries();
  const existing = entries[username];
  if (existing && existing.totalEarned >= totalEarned) return;
  entries[username] = {
    username,
    totalEarned,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  saveLocalEntries(entries);
}

export async function submitClubFundsLeaderboardOnline(
  totalEarned: number
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    totalEarned <= 0
  ) {
    return;
  }

  try {
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("score")
      .eq("user_id", userId)
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
      .maybeSingle();

    const currentScore =
      typeof existing?.score === "number" ? existing.score : 0;
    if (totalEarned < currentScore) return;

    await supabase.from("leaderboard").upsert(
      {
        user_id: userId,
        coach_name: coachName,
        player_name: coachName,
        mode: LEADERBOARD_MODE,
        difficulty: "NORMAL",
        score: totalEarned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,difficulty" }
    );
  } catch (err) {
    console.error("[club-funds-leaderboard] submit failed:", err);
  }
}

export function syncClubFundsLeaderboard(totalEarned: number): void {
  if (totalEarned <= 0) return;

  if (isLoggedIn()) {
    const username = getUsername();
    if (!username || isGuestLeaderboardName(username)) return;
    updateLocalClubFundsLeaderboard(username, totalEarned, getAuthUserId() ?? undefined);
    void submitClubFundsLeaderboardOnline(totalEarned);
    return;
  }

  updateLocalClubFundsLeaderboard(LOCAL_GUEST_KEY, totalEarned);
}

function filterPublicEntries(
  entries: ClubFundsLeaderboardEntry[]
): ClubFundsLeaderboardEntry[] {
  return entries.filter((entry) => !isGuestLeaderboardName(entry.username));
}

function mergeClubFundsEntries(
  ...groups: ClubFundsLeaderboardEntry[][]
): ClubFundsLeaderboardEntry[] {
  const byKey = new Map<string, ClubFundsLeaderboardEntry>();

  for (const group of groups) {
    for (const entry of group) {
      if (isGuestLeaderboardName(entry.username) || entry.totalEarned <= 0) {
        continue;
      }
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (!existing || entry.totalEarned > existing.totalEarned) {
        byKey.set(key, entry);
      } else if (
        existing &&
        entry.totalEarned === existing.totalEarned &&
        entry.updatedAt > existing.updatedAt
      ) {
        byKey.set(key, { ...existing, username: entry.username });
      }
    }
  }

  return [...byKey.values()];
}

function mapEntriesToRows(
  entries: ClubFundsLeaderboardEntry[],
  currentUser: string,
  limit: number
): LeaderboardTrackerRow[] {
  return [...entries]
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      statDisplay: formatClubFunds(entry.totalEarned),
      achievedAt: "",
      difficulty: "NORMAL",
      mode: "CLASSIC",
      isCurrentUser: entry.username === currentUser,
    }));
}

async function fetchLeaderboardTableEntries(): Promise<
  ClubFundsLeaderboardEntry[] | null
> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at")
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
      .gt("score", 0)
      .order("score", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data?.length) return [];

    return data
      .filter((row) => row.coach_name && typeof row.score === "number")
      .map((row) => ({
        userId: (row.user_id as string | null) ?? undefined,
        username: row.coach_name as string,
        totalEarned: row.score as number,
        updatedAt: (row.updated_at as string) ?? "",
      }));
  } catch (err) {
    console.error("[club-funds-leaderboard] leaderboard fetch failed:", err);
    return null;
  }
}

async function fetchUserStatsEntries(): Promise<
  ClubFundsLeaderboardEntry[] | null
> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: stats, error: statsError } = await supabase
      .from("user_stats")
      .select("user_id, stat_value, updated_at")
      .eq("mode", USER_STATS_MODE)
      .eq("stat_key", USER_STATS_KEY)
      .gt("stat_value", 0)
      .order("stat_value", { ascending: false })
      .limit(100);

    if (statsError) throw statsError;
    if (!stats?.length) return [];

    const userIds = stats
      .map((row) => row.user_id as string)
      .filter(Boolean);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, coach_name")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    const coachByUserId = new Map<string, string>();
    for (const profile of profiles ?? []) {
      if (profile.id && profile.coach_name) {
        coachByUserId.set(profile.id as string, profile.coach_name as string);
      }
    }

    const entries: ClubFundsLeaderboardEntry[] = [];
    for (const row of stats) {
      const userId = row.user_id as string;
      const coachName = coachByUserId.get(userId);
      if (!coachName || typeof row.stat_value !== "number") continue;
      entries.push({
        userId,
        username: coachName,
        totalEarned: row.stat_value as number,
        updatedAt: (row.updated_at as string) ?? "",
      });
    }
    return entries;
  } catch (err) {
    console.error("[club-funds-leaderboard] user_stats fetch failed:", err);
    return null;
  }
}

async function fetchRemoteEntries(): Promise<ClubFundsLeaderboardEntry[] | null> {
  const [fromStats, fromLeaderboard] = await Promise.all([
    fetchUserStatsEntries(),
    fetchLeaderboardTableEntries(),
  ]);

  if (fromStats === null && fromLeaderboard === null) return null;

  return mergeClubFundsEntries(fromStats ?? [], fromLeaderboard ?? []);
}

function buildLocalFallbackEntries(
  currentUser: string,
  currentTotal: number,
  userId?: string
): ClubFundsLeaderboardEntry[] {
  const local = filterPublicEntries(Object.values(loadLocalEntries()));
  const merged = mergeClubFundsEntries(local);

  if (
    isLoggedIn() &&
    currentUser &&
    !isGuestLeaderboardName(currentUser) &&
    currentTotal > 0
  ) {
    return mergeClubFundsEntries(merged, [
      {
        username: currentUser,
        totalEarned: currentTotal,
        updatedAt: new Date().toISOString(),
        userId,
      },
    ]);
  }

  return merged;
}

export async function getClubFundsLeaderboardAsync(
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const totalEarned = getClubFundsTotalEarned();

  if (isLoggedIn() && totalEarned > 0 && currentUser) {
    updateLocalClubFundsLeaderboard(currentUser, totalEarned, userId);
    void submitClubFundsLeaderboardOnline(totalEarned);
  } else if (!isLoggedIn() && totalEarned > 0) {
    updateLocalClubFundsLeaderboard(LOCAL_GUEST_KEY, totalEarned);
  }

  const remote = await fetchRemoteEntries();
  if (remote !== null) {
    const merged = mergeClubFundsEntries(
      remote,
      isLoggedIn() &&
        currentUser &&
        !isGuestLeaderboardName(currentUser) &&
        totalEarned > 0
        ? [
            {
              username: currentUser,
              totalEarned,
              updatedAt: new Date().toISOString(),
              userId,
            },
          ]
        : []
    );

    return {
      source: "remote",
      rows: mapEntriesToRows(
        filterPublicEntries(merged),
        currentUser,
        limit
      ),
    };
  }

  const local = buildLocalFallbackEntries(currentUser, totalEarned, userId);
  return {
    source: "local",
    rows: mapEntriesToRows(local, currentUser, limit),
  };
}
