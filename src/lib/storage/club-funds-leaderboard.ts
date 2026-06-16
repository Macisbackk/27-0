import { formatClubFunds } from "../club-funds";
import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { getUsername } from "./user";
import { STORAGE_KEYS } from "./keys";
import { getClubFundsTotalEarned } from "./club-funds";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";

const LEADERBOARD_MODE = "club-funds";
const LOCAL_GUEST_KEY = "__local_guest__";

export interface ClubFundsLeaderboardEntry {
  username: string;
  totalEarned: number;
  updatedAt: string;
}

function isGuestLeaderboardName(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "guest" ||
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
  totalEarned: number
): void {
  if (!username || totalEarned <= 0) return;
  const entries = loadLocalEntries();
  const existing = entries[username];
  if (existing && existing.totalEarned >= totalEarned) return;
  entries[username] = {
    username,
    totalEarned,
    updatedAt: new Date().toISOString(),
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
    if (totalEarned <= currentScore) return;

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
    updateLocalClubFundsLeaderboard(username, totalEarned);
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

async function fetchRemoteEntries(): Promise<ClubFundsLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("coach_name, score, updated_at")
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
      .order("score", { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data?.length) return [];

    return filterPublicEntries(
      data
        .filter((row) => row.coach_name && typeof row.score === "number")
        .map((row) => ({
          username: row.coach_name as string,
          totalEarned: row.score as number,
          updatedAt: (row.updated_at as string) ?? "",
        }))
    );
  } catch (err) {
    console.error("[club-funds-leaderboard] fetch failed:", err);
    return null;
  }
}

export async function getClubFundsLeaderboardAsync(
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const totalEarned = getClubFundsTotalEarned();

  if (isLoggedIn() && totalEarned > 0 && currentUser) {
    updateLocalClubFundsLeaderboard(currentUser, totalEarned);
    void submitClubFundsLeaderboardOnline(totalEarned);
  } else if (!isLoggedIn() && totalEarned > 0) {
    updateLocalClubFundsLeaderboard(LOCAL_GUEST_KEY, totalEarned);
  }

  const remote = await fetchRemoteEntries();
  if (remote) {
    return {
      source: "remote",
      rows: mapEntriesToRows(remote, currentUser, limit),
    };
  }

  const local = filterPublicEntries(Object.values(loadLocalEntries()));
  return {
    source: "local",
    rows: mapEntriesToRows(local, currentUser, limit),
  };
}
