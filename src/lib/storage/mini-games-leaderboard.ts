import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";
import { loadWordleStats } from "@/lib/mini-games/wordle/storage";
import { loadHangmanStats } from "@/lib/mini-games/hangman/storage";
import { loadHigherLowerStats } from "@/lib/mini-games/higher-lower/storage";
import { loadQuizStats } from "@/lib/quiz/storage";

/** Mini-game win boards (score = total wins). Quiz prize stays on mode=quiz. */
export type MiniGameWinsKind =
  | "wordle"
  | "hangman"
  | "higher-lower"
  | "quiz-wins";

export const MINI_GAME_WINS_CATEGORIES: Array<{
  id: MiniGameWinsKind | "quiz-prize";
  label: string;
  shortLabel: string;
  href: string;
}> = [
  {
    id: "wordle",
    label: "Wordle Wins",
    shortLabel: "Wordle",
    href: "/mini-games/wordle",
  },
  {
    id: "hangman",
    label: "Hangman Wins",
    shortLabel: "Hangman",
    href: "/mini-games/hangman",
  },
  {
    id: "higher-lower",
    label: "Higher-Lower Wins",
    shortLabel: "H/L",
    href: "/mini-games/higher-lower",
  },
  {
    id: "quiz-wins",
    label: "Quiz Wins",
    shortLabel: "Quiz",
    href: "/mini-games/quiz",
  },
  {
    id: "quiz-prize",
    label: "Quiz Prize",
    shortLabel: "Prize",
    href: "/mini-games/quiz",
  },
];

const DB_MODE: Record<MiniGameWinsKind, string> = {
  wordle: "wordle",
  hangman: "hangman",
  "higher-lower": "higher-lower",
  "quiz-wins": "quiz-wins",
};

export interface MiniGameWinsEntry {
  userId?: string;
  username: string;
  wins: number;
  updatedAt: string;
}

type LocalBoard = Record<string, MiniGameWinsEntry>;
type LocalStore = Partial<Record<MiniGameWinsKind, LocalBoard>>;

function loadStore(): LocalStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.miniGamesLeaderboard);
    if (!raw) return {};
    return (JSON.parse(raw) as LocalStore) ?? {};
  } catch {
    return {};
  }
}

function saveStore(store: LocalStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.miniGamesLeaderboard, JSON.stringify(store));
}

export function updateLocalMiniGameWins(
  kind: MiniGameWinsKind,
  input: { username: string; wins: number; userId?: string }
): void {
  if (!input.username || input.wins <= 0) return;
  const store = loadStore();
  const board = store[kind] ?? {};
  const existing = board[input.username];
  board[input.username] = {
    username: input.username,
    wins: Math.max(existing?.wins ?? 0, input.wins),
    updatedAt: new Date().toISOString(),
    userId: input.userId ?? existing?.userId,
  };
  store[kind] = board;
  saveStore(store);
}

export function getLocalMiniGameWins(kind: MiniGameWinsKind): MiniGameWinsEntry[] {
  return Object.values(loadStore()[kind] ?? {}).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function submitMiniGameWinsOnline(
  kind: MiniGameWinsKind,
  wins: number
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    wins <= 0
  ) {
    return;
  }

  const mode = DB_MODE[kind];
  try {
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("score")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .maybeSingle();

    const currentScore = typeof existing?.score === "number" ? existing.score : 0;
    if (currentScore >= wins) return;

    await supabase.from("leaderboard").upsert(
      {
        user_id: userId,
        coach_name: coachName,
        player_name: coachName,
        mode,
        difficulty: "NORMAL",
        mode_variant: "current",
        score: wins,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,difficulty,mode_variant" }
    );
  } catch (error) {
    console.error(`[mini-games-leaderboard] ${kind} submit failed:`, error);
  }
}

function mergeEntries(...groups: MiniGameWinsEntry[][]): MiniGameWinsEntry[] {
  const byKey = new Map<string, MiniGameWinsEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (
        !entry.username ||
        isGuestLeaderboardName(entry.username) ||
        entry.wins <= 0
      ) {
        continue;
      }
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (
        !existing ||
        entry.wins > existing.wins ||
        (entry.wins === existing.wins && entry.updatedAt > existing.updatedAt)
      ) {
        byKey.set(key, entry);
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.wins - a.wins || b.updatedAt.localeCompare(a.updatedAt)
  );
}

async function fetchRemoteEntries(
  kind: MiniGameWinsKind
): Promise<MiniGameWinsEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at")
      .eq("mode", DB_MODE[kind])
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
        wins: row.score as number,
        updatedAt: (row.updated_at as string) ?? "",
      }));
  } catch (error) {
    console.error(`[mini-games-leaderboard] ${kind} fetch failed:`, error);
    return null;
  }
}

function mapEntriesToRows(
  entries: MiniGameWinsEntry[],
  currentUser: string,
  limit: number
): LeaderboardTrackerRow[] {
  return entries.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    statDisplay: String(entry.wins),
    achievedAt: entry.updatedAt,
    difficulty: "NORMAL",
    mode: "CLASSIC",
    isCurrentUser: Boolean(currentUser && entry.username === currentUser),
  }));
}

export async function getMiniGameWinsLeaderboardAsync(
  kind: MiniGameWinsKind,
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  // Seed local board from this device's stats so first paint isn't empty.
  seedLocalWinsFromDeviceStats(kind);
  const local = getLocalMiniGameWins(kind);
  const remote = await fetchRemoteEntries(kind);
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

function readDeviceWins(kind: MiniGameWinsKind): number {
  switch (kind) {
    case "wordle":
      return loadWordleStats().wins;
    case "hangman":
      return loadHangmanStats().wins;
    case "higher-lower":
      return loadHigherLowerStats().fivePickWins;
    case "quiz-wins":
      return loadQuizStats().perfectRuns;
  }
}

function seedLocalWinsFromDeviceStats(kind: MiniGameWinsKind): void {
  const username = getUsername();
  if (!username || isGuestLeaderboardName(username)) return;
  const wins = readDeviceWins(kind);
  if (wins <= 0) return;
  updateLocalMiniGameWins(kind, {
    username,
    wins,
    userId: getAuthUserId() ?? undefined,
  });
}

/** Call after a mini-game settle when the player's win total may have increased. */
export function syncMiniGameWins(kind: MiniGameWinsKind, wins: number): void {
  if (wins <= 0) return;
  const username = getUsername();
  if (!username) return;
  updateLocalMiniGameWins(kind, {
    username,
    wins,
    userId: getAuthUserId() ?? undefined,
  });
  if (isLoggedIn()) {
    void submitMiniGameWinsOnline(kind, wins);
  }
}
