import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";
import { formatClubFundsExact } from "../club-funds";

const LEADERBOARD_MODE = "quiz";

export interface QuizLeaderboardEntry {
  userId?: string;
  username: string;
  highestPrize: number;
  millionaireRuns: number;
  questionsCorrect: number;
  updatedAt: string;
}

function loadLocalEntries(): Record<string, QuizLeaderboardEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.quizLeaderboard);
    if (!raw) return {};
    return (JSON.parse(raw) as Record<string, QuizLeaderboardEntry>) ?? {};
  } catch {
    return {};
  }
}

function saveLocalEntries(entries: Record<string, QuizLeaderboardEntry>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.quizLeaderboard, JSON.stringify(entries));
}

export function updateLocalQuizLeaderboard(input: {
  username: string;
  highestPrize: number;
  millionaireRuns: number;
  questionsCorrect: number;
  userId?: string;
}): void {
  if (!input.username || input.highestPrize <= 0) return;
  const entries = loadLocalEntries();
  const existing = entries[input.username];
  entries[input.username] = {
    username: input.username,
    highestPrize: Math.max(existing?.highestPrize ?? 0, input.highestPrize),
    millionaireRuns: Math.max(existing?.millionaireRuns ?? 0, input.millionaireRuns),
    questionsCorrect: Math.max(existing?.questionsCorrect ?? 0, input.questionsCorrect),
    updatedAt: new Date().toISOString(),
    userId: input.userId ?? existing?.userId,
  };
  saveLocalEntries(entries);
}

export function getLocalQuizLeaderboard(): QuizLeaderboardEntry[] {
  return Object.values(loadLocalEntries()).sort((a, b) => {
    if (b.highestPrize !== a.highestPrize) return b.highestPrize - a.highestPrize;
    if (b.millionaireRuns !== a.millionaireRuns) return b.millionaireRuns - a.millionaireRuns;
    return b.questionsCorrect - a.questionsCorrect;
  });
}

export async function submitQuizLeaderboardOnline(input: {
  highestPrize: number;
  millionaireRuns: number;
}): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    input.highestPrize <= 0
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

    const currentScore = typeof existing?.score === "number" ? existing.score : 0;
    if (currentScore >= input.highestPrize) return;

    await supabase.from("leaderboard").upsert(
      {
        user_id: userId,
        coach_name: coachName,
        player_name: coachName,
        mode: LEADERBOARD_MODE,
        difficulty: "NORMAL",
        mode_variant: "current",
        score: input.highestPrize,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,difficulty,mode_variant" }
    );
  } catch (error) {
    console.error("[quiz-leaderboard] submit failed:", error);
  }
}

function mergeEntries(
  ...groups: QuizLeaderboardEntry[][]
): QuizLeaderboardEntry[] {
  const byKey = new Map<string, QuizLeaderboardEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (
        !entry.username ||
        isGuestLeaderboardName(entry.username) ||
        entry.highestPrize <= 0
      ) {
        continue;
      }
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (
        !existing ||
        entry.highestPrize > existing.highestPrize ||
        (entry.highestPrize === existing.highestPrize &&
          entry.updatedAt > existing.updatedAt)
      ) {
        byKey.set(key, entry);
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      b.highestPrize - a.highestPrize ||
      b.millionaireRuns - a.millionaireRuns ||
      b.questionsCorrect - a.questionsCorrect
  );
}

async function fetchRemoteEntries(): Promise<QuizLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at")
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .gt("score", 0)
      .order("score", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? [])
      .filter((row) => row.coach_name && typeof row.score === "number")
      .map((row) => ({
        userId: (row.user_id as string | null) ?? undefined,
        username: row.coach_name as string,
        highestPrize: row.score as number,
        millionaireRuns: 0,
        questionsCorrect: 0,
        updatedAt: (row.updated_at as string) ?? "",
      }));
  } catch (error) {
    console.error("[quiz-leaderboard] fetch failed:", error);
    return null;
  }
}

function mapEntriesToRows(
  entries: QuizLeaderboardEntry[],
  currentUser: string,
  limit: number
): LeaderboardTrackerRow[] {
  return entries.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    statDisplay: formatClubFundsExact(entry.highestPrize),
    achievedAt: entry.updatedAt,
    difficulty: "NORMAL",
    mode: "CLASSIC",
    isCurrentUser: Boolean(currentUser && entry.username === currentUser),
  }));
}

export async function getQuizLeaderboardAsync(
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const local = getLocalQuizLeaderboard();
  const remote = await fetchRemoteEntries();
  if (remote !== null) {
    return {
      source: "remote",
      rows: mapEntriesToRows(mergeEntries(remote, local), currentUser, limit),
    };
  }
  return {
    source: "local",
    rows: mapEntriesToRows(mergeEntries(local), currentUser, limit),
  };
}

export function syncQuizLeaderboard(input: {
  highestPrize: number;
  millionaireRuns: number;
  questionsCorrect: number;
}): void {
  const username = getUsername();
  if (!username) return;
  updateLocalQuizLeaderboard({
    username,
    highestPrize: input.highestPrize,
    millionaireRuns: input.millionaireRuns,
    questionsCorrect: input.questionsCorrect,
    userId: getAuthUserId() ?? undefined,
  });
  if (isLoggedIn()) {
    void submitQuizLeaderboardOnline(input);
  }
}
