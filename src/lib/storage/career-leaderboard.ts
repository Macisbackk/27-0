import { getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { totalMajorTrophies } from "../career/legacy";
import type { CareerLegacy } from "../career/types";

/** Manager Mode (v2) online boards. */
export type CareerBoard = "career-trophies" | "career-glory" | "career-season";

export const CAREER_BOARDS: Array<{ id: CareerBoard; label: string; shortLabel: string; blurb: string; lowerIsBetter?: boolean }> = [
  { id: "career-trophies", label: "Most Trophies", shortLabel: "Trophies", blurb: "Major honours across every career" },
  { id: "career-glory", label: "Fastest to Glory", shortLabel: "Fastest", blurb: "Fewest seasons from a Championship start to a Grand Final win", lowerIsBetter: true },
  { id: "career-season", label: "Best Season", shortLabel: "Season", blurb: "Most Super League wins in one season" },
];

export interface CareerBoardEntry {
  userId?: string;
  username: string;
  score: number;
  wins?: number;
  losses?: number;
  updatedAt: string;
}

function boardScore(board: CareerBoard, legacy: CareerLegacy): { score: number; wins?: number; losses?: number } | null {
  switch (board) {
    case "career-trophies": {
      const n = totalMajorTrophies(legacy);
      return n > 0 ? { score: n } : null;
    }
    case "career-glory":
      return legacy.fastestGlorySeasons ? { score: legacy.fastestGlorySeasons } : null;
    case "career-season":
      return legacy.bestSeason ? { score: legacy.bestSeason.wins, wins: legacy.bestSeason.wins, losses: legacy.bestSeason.losses } : null;
  }
}

function isBetter(board: CareerBoard, next: number, current: number | null): boolean {
  if (current == null) return true;
  return board === "career-glory" ? next < current : next > current;
}

/** Push any improved records for the signed-in user. Safe to call after every banked season. */
export async function submitCareerLeaderboards(legacy: CareerLegacy): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (!userId || !coachName || isGuestLeaderboardName(coachName) || !isSupabaseConfigured) return;

  for (const { id: mode } of CAREER_BOARDS) {
    const value = boardScore(mode, legacy);
    if (!value) continue;
    try {
      const { data: existing } = await supabase
        .from("leaderboard")
        .select("score")
        .eq("user_id", userId)
        .eq("mode", mode)
        .eq("difficulty", "NORMAL")
        .eq("mode_variant", "current")
        .maybeSingle();
      const current = typeof existing?.score === "number" ? existing.score : null;
      if (!isBetter(mode, value.score, current)) continue;
      const { error } = await supabase.from("leaderboard").upsert(
        {
          user_id: userId,
          coach_name: coachName,
          player_name: coachName,
          mode,
          difficulty: "NORMAL",
          mode_variant: "current",
          score: value.score,
          wins: value.wins ?? null,
          losses: value.losses ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,mode,difficulty,mode_variant" }
      );
      if (error) throw error;
    } catch (error) {
      console.error(`[career-leaderboard] ${mode} submit failed:`, error);
    }
  }
}

export async function fetchCareerBoard(board: CareerBoard): Promise<CareerBoardEntry[]> {
  if (!isSupabaseConfigured) return [];
  const lowerIsBetter = CAREER_BOARDS.find((b) => b.id === board)?.lowerIsBetter ?? false;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, wins, losses, updated_at")
      .eq("mode", board)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .gt("score", 0)
      .order("score", { ascending: lowerIsBetter })
      .order("updated_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return (data ?? [])
      .filter((row) => row.coach_name && !isGuestLeaderboardName(row.coach_name as string))
      .map((row) => ({
        userId: (row.user_id as string | null) ?? undefined,
        username: row.coach_name as string,
        score: row.score as number,
        wins: (row.wins as number | null) ?? undefined,
        losses: (row.losses as number | null) ?? undefined,
        updatedAt: (row.updated_at as string) ?? "",
      }));
  } catch (error) {
    console.error(`[career-leaderboard] ${board} fetch failed:`, error);
    return [];
  }
}
