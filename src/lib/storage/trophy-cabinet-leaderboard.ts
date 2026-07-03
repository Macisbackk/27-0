import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";
import { getAllStats, type StoredStats } from "./stats";
import type { LeaderboardTrackerRow, LeaderboardTrackerType } from "../leaderboard-trackers";
import { isTrophyCabinetTracker } from "../leaderboard-trackers";

const LOCAL_GUEST_KEY = "__local_guest__";

export type TrophyCabinetTracker = Extract<
  LeaderboardTrackerType,
  | "league_titles"
  | "super_league_champions"
  | "challenge_cup_trophy"
  | "era_cup_trophy"
  | "era_league_title"
  | "era_league_champions"
>;

const TROPHY_TRACKERS: TrophyCabinetTracker[] = [
  "league_titles",
  "super_league_champions",
  "challenge_cup_trophy",
  "era_league_title",
  "era_league_champions",
  "era_cup_trophy",
];

const TRACKER_TO_MODE: Record<TrophyCabinetTracker, string> = {
  league_titles: "trophy-league-titles",
  super_league_champions: "trophy-super-league",
  challenge_cup_trophy: "trophy-challenge-cup",
  era_league_title: "trophy-era-league",
  era_league_champions: "trophy-era-league-champions",
  era_cup_trophy: "trophy-era-cup",
};

export interface TrophyCabinetLeaderboardEntry {
  userId?: string;
  username: string;
  trophyCount: number;
  updatedAt: string;
}

export function getTrophyCountFromStats(
  tracker: TrophyCabinetTracker,
  stats: StoredStats
): number {
  const { normal, hard, eraNormal, eraCup } = stats;
  switch (tracker) {
    case "league_titles":
      return normal.leagueTitlesWon + hard.leagueTitlesWon;
    case "super_league_champions":
      return normal.superLeagueTitles + hard.superLeagueTitles;
    case "challenge_cup_trophy":
      return normal.challengeCupsWon + hard.challengeCupsWon;
    case "era_league_title":
      return eraNormal.leagueTitlesWon;
    case "era_league_champions":
      return eraNormal.superLeagueTitles;
    case "era_cup_trophy":
      return eraCup.eraCupsWon;
    default:
      return 0;
  }
}

function loadLocalEntries(): Record<
  string,
  Record<TrophyCabinetTracker, TrophyCabinetLeaderboardEntry>
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.trophyCabinetLeaderboard);
    if (!raw) return {};
    return JSON.parse(raw) as Record<
      string,
      Record<TrophyCabinetTracker, TrophyCabinetLeaderboardEntry>
    >;
  } catch {
    return {};
  }
}

function saveLocalEntries(
  entries: Record<string, Record<TrophyCabinetTracker, TrophyCabinetLeaderboardEntry>>
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEYS.trophyCabinetLeaderboard,
    JSON.stringify(entries)
  );
}

function updateLocalEntry(
  username: string,
  tracker: TrophyCabinetTracker,
  trophyCount: number,
  userId?: string
): void {
  if (!username || trophyCount <= 0) return;
  const entries = loadLocalEntries();
  const userEntries = entries[username] ?? ({} as Record<
    TrophyCabinetTracker,
    TrophyCabinetLeaderboardEntry
  >);
  const existing = userEntries[tracker];
  if (existing && existing.trophyCount >= trophyCount) return;
  userEntries[tracker] = {
    username,
    trophyCount,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  entries[username] = userEntries;
  saveLocalEntries(entries);
}

async function submitTrophyOnline(
  tracker: TrophyCabinetTracker,
  trophyCount: number
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    trophyCount <= 0
  ) {
    return;
  }

  const mode = TRACKER_TO_MODE[tracker];

  try {
    const { data: existing, error: selectError } = await supabase
      .from("leaderboard")
      .select("id, score")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .maybeSingle();

    if (selectError) throw selectError;

    const currentScore =
      typeof existing?.score === "number" ? existing.score : 0;
    if (trophyCount < currentScore) return;

    const payload = {
      coach_name: coachName,
      player_name: coachName,
      score: trophyCount,
      mode_variant: "current",
    };

    if (existing?.id) {
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
      mode,
      difficulty: "NORMAL",
    });
    if (error) throw error;
  } catch (err) {
    console.error("[trophy-cabinet-leaderboard] submit failed:", err);
  }
}

export function syncTrophyCabinetLeaderboard(stats?: StoredStats): void {
  const stored = stats ?? getAllStats();
  const counts = Object.fromEntries(
    TROPHY_TRACKERS.map((tracker) => [
      tracker,
      getTrophyCountFromStats(tracker, stored),
    ])
  ) as Record<TrophyCabinetTracker, number>;

  if (isLoggedIn()) {
    const username = getUsername();
    const userId = getAuthUserId() ?? undefined;
    if (!username || isGuestLeaderboardName(username)) return;

    for (const tracker of TROPHY_TRACKERS) {
      const count = counts[tracker];
      if (count <= 0) continue;
      updateLocalEntry(username, tracker, count, userId);
      void submitTrophyOnline(tracker, count);
    }
    return;
  }

  for (const tracker of TROPHY_TRACKERS) {
    const count = counts[tracker];
    if (count <= 0) continue;
    updateLocalEntry(LOCAL_GUEST_KEY, tracker, count);
  }
}

export function syncTrophyCabinetLeaderboardOnLoad(): void {
  syncTrophyCabinetLeaderboard();
}

function filterPublicEntries(
  entries: TrophyCabinetLeaderboardEntry[]
): TrophyCabinetLeaderboardEntry[] {
  return entries.filter((entry) => !isGuestLeaderboardName(entry.username));
}

function mergeEntries(
  ...groups: TrophyCabinetLeaderboardEntry[][]
): TrophyCabinetLeaderboardEntry[] {
  const byKey = new Map<string, TrophyCabinetLeaderboardEntry>();

  for (const group of groups) {
    for (const entry of group) {
      if (isGuestLeaderboardName(entry.username) || entry.trophyCount <= 0) {
        continue;
      }
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (!existing || entry.trophyCount > existing.trophyCount) {
        byKey.set(key, entry);
      } else if (
        existing &&
        entry.trophyCount === existing.trophyCount &&
        entry.updatedAt > existing.updatedAt
      ) {
        byKey.set(key, { ...existing, username: entry.username });
      }
    }
  }

  return [...byKey.values()];
}

function isCurrentUserEntry(
  entry: TrophyCabinetLeaderboardEntry,
  currentUser: string,
  userId?: string
): boolean {
  if (userId && entry.userId === userId) return true;
  if (currentUser && entry.username === currentUser) return true;
  if (entry.username === "You" && !userId && !currentUser) return true;
  return false;
}

function buildLiveUserEntry(
  currentUser: string,
  currentCount: number,
  userId?: string
): TrophyCabinetLeaderboardEntry | null {
  if (currentCount <= 0) return null;

  if (currentUser && !isGuestLeaderboardName(currentUser)) {
    return {
      username: currentUser,
      trophyCount: currentCount,
      updatedAt: new Date().toISOString(),
      userId,
    };
  }

  if (userId || currentCount > 0) {
    return {
      username: "You",
      trophyCount: currentCount,
      updatedAt: new Date().toISOString(),
      userId,
    };
  }

  return null;
}

function mapEntriesToRows(
  entries: TrophyCabinetLeaderboardEntry[],
  currentUser: string,
  userId: string | undefined,
  limit: number
): LeaderboardTrackerRow[] {
  const sorted = [...entries].sort((a, b) => b.trophyCount - a.trophyCount);
  const rows = sorted.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    statDisplay: String(entry.trophyCount),
    achievedAt: entry.updatedAt,
    difficulty: "NORMAL" as const,
    mode: "CLASSIC" as const,
    isCurrentUser: isCurrentUserEntry(entry, currentUser, userId),
  }));

  if (!rows.some((row) => row.isCurrentUser)) {
    const userIndex = sorted.findIndex((entry) =>
      isCurrentUserEntry(entry, currentUser, userId)
    );
    if (userIndex >= 0) {
      const entry = sorted[userIndex]!;
      rows.push({
        rank: userIndex + 1,
        username: entry.username,
        statDisplay: String(entry.trophyCount),
        achievedAt: entry.updatedAt,
        difficulty: "NORMAL",
        mode: "CLASSIC",
        isCurrentUser: true,
      });
    }
  }

  return rows;
}

async function fetchRemoteEntries(
  tracker: TrophyCabinetTracker
): Promise<TrophyCabinetLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  const mode = TRACKER_TO_MODE[tracker];

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at, created_at")
      .eq("mode", mode)
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
        trophyCount: row.score as number,
        updatedAt:
          (row.updated_at as string) ?? (row.created_at as string) ?? "",
      }));
  } catch (err) {
    console.error("[trophy-cabinet-leaderboard] fetch failed:", err);
    return null;
  }
}

function buildLocalFallback(
  tracker: TrophyCabinetTracker,
  currentUser: string,
  currentCount: number,
  userId?: string
): TrophyCabinetLeaderboardEntry[] {
  const local = Object.values(loadLocalEntries()).flatMap((userMap) =>
    userMap[tracker] ? [userMap[tracker]!] : []
  );
  const merged = mergeEntries(filterPublicEntries(local));
  const liveEntry = buildLiveUserEntry(currentUser, currentCount, userId);
  return liveEntry ? mergeEntries(merged, [liveEntry]) : merged;
}

export async function getTrophyCabinetLeaderboardAsync(
  tracker: LeaderboardTrackerType,
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  if (!isTrophyCabinetTracker(tracker)) {
    return { rows: [], source: "local" };
  }

  const trophyTracker = tracker as TrophyCabinetTracker;
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const currentCount = getTrophyCountFromStats(trophyTracker, getAllStats());

  syncTrophyCabinetLeaderboard();

  const liveEntry = buildLiveUserEntry(currentUser, currentCount, userId);

  const remote = await fetchRemoteEntries(trophyTracker);
  if (remote !== null) {
    const merged = mergeEntries(remote, liveEntry ? [liveEntry] : []);

    return {
      source: "remote",
      rows: mapEntriesToRows(
        filterPublicEntries(merged),
        currentUser,
        userId,
        limit
      ),
    };
  }

  const local = buildLocalFallback(
    trophyTracker,
    currentUser,
    currentCount,
    userId
  );
  return {
    source: "local",
    rows: mapEntriesToRows(local, currentUser, userId, limit),
  };
}
