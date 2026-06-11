import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { STORAGE_KEYS } from "./keys";

export interface CupTeamWinEntry {
  teamName: string;
  tournamentWins: number;
  lastWonAt: string;
}

function loadLocalTeamWins(): Record<string, CupTeamWinEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cupTeamWins);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CupTeamWinEntry>;
  } catch {
    return {};
  }
}

function saveLocalTeamWins(entries: Record<string, CupTeamWinEntry>): void {
  localStorage.setItem(STORAGE_KEYS.cupTeamWins, JSON.stringify(entries));
}

export function getAllCupTeamWins(): CupTeamWinEntry[] {
  return Object.values(loadLocalTeamWins()).sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      b.lastWonAt.localeCompare(a.lastWonAt)
  );
}

export function incrementCupTeamWinsLocal(teamName: string): CupTeamWinEntry {
  const entries = loadLocalTeamWins();
  const existing = entries[teamName];
  const updated: CupTeamWinEntry = {
    teamName,
    tournamentWins: (existing?.tournamentWins ?? 0) + 1,
    lastWonAt: new Date().toISOString(),
  };
  entries[teamName] = updated;
  saveLocalTeamWins(entries);
  return updated;
}

async function incrementCupTeamWinsRemote(
  teamName: string
): Promise<void> {
  if (!isSupabaseConfigured || !isLoggedIn()) return;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("cup_team_wins")
      .select("tournament_wins")
      .eq("team_name", teamName)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const nextWins = (existing?.tournament_wins ?? 0) + 1;
    const payload = {
      team_name: teamName,
      tournament_wins: nextWins,
      last_won_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from("cup_team_wins")
        .update(payload)
        .eq("team_name", teamName);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("cup_team_wins").insert(payload);
    if (error) throw error;
  } catch (error) {
    console.error("[cup-team-wins] Supabase upsert failed:", error);
  }
}

/** Record a Challenge Cup tournament win for the selected team. */
export function recordCupTeamWin(teamName: string): void {
  if (!teamName) return;
  incrementCupTeamWinsLocal(teamName);
  void incrementCupTeamWinsRemote(teamName);
}

export interface CupTeamWinsLeaderboardRow {
  rank: number;
  teamName: string;
  tournamentWins: number;
  lastWonAt: string | null;
}

export async function getCupTeamWinsLeaderboardAsync(
  limit = 50
): Promise<{ rows: CupTeamWinsLeaderboardRow[]; source: "remote" | "local" }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("cup_team_wins")
        .select("team_name, tournament_wins, last_won_at")
        .order("tournament_wins", { ascending: false })
        .order("last_won_at", { ascending: false })
        .limit(limit);

      if (!error && data?.length) {
        return {
          source: "remote",
          rows: data.map((row, index) => ({
            rank: index + 1,
            teamName: row.team_name,
            tournamentWins: row.tournament_wins ?? 0,
            lastWonAt: row.last_won_at ?? null,
          })),
        };
      }
    } catch (error) {
      console.error("[cup-team-wins] Supabase fetch failed:", error);
    }
  }

  return {
    source: "local",
    rows: getAllCupTeamWins().slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      teamName: entry.teamName,
      tournamentWins: entry.tournamentWins,
      lastWonAt: entry.lastWonAt,
    })),
  };
}
