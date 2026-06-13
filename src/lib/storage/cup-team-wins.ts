import { getPlayableClubNames } from "../clubs/super-league-display";
import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAllCupLeaderboardProfiles } from "./cup-leaderboard";
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
  /** 0–100 relative bar width for graph display */
  barPercent: number;
  isLeader: boolean;
}

/** Stable hash assignment for cup wins recorded before team tracking existed. */
export function hashAssignPlayableTeam(seed: string): string {
  const clubs = getPlayableClubNames();
  if (clubs.length === 0) return seed;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return clubs[Math.abs(hash) % clubs.length];
}

function mergeWinCounts(
  recorded: Record<string, number>,
  profiles: ReturnType<typeof getAllCupLeaderboardProfiles>
): Record<string, number> {
  const merged: Record<string, number> = {};
  const playable = new Set(getPlayableClubNames());

  for (const [team, wins] of Object.entries(recorded)) {
    if (playable.has(team) && wins > 0) {
      merged[team] = (merged[team] ?? 0) + wins;
    }
  }

  const recordedTotal = Object.values(merged).reduce((sum, wins) => sum + wins, 0);
  const expectedTotal = profiles.reduce((sum, profile) => sum + profile.cupsWon, 0);
  const missing = Math.max(0, expectedTotal - recordedTotal);

  let assigned = 0;
  for (const profile of profiles) {
    for (let cupIndex = 0; cupIndex < profile.cupsWon; cupIndex++) {
      if (assigned >= missing) break;
      const team = hashAssignPlayableTeam(
        `${profile.username}-cup-win-${cupIndex}`
      );
      merged[team] = (merged[team] ?? 0) + 1;
      assigned += 1;
    }
    if (assigned >= missing) break;
  }

  return merged;
}

function buildLeaderboardRows(
  winCounts: Record<string, number>
): CupTeamWinsLeaderboardRow[] {
  const playable = getPlayableClubNames();
  const rows = playable.map((teamName) => ({
    teamName,
    tournamentWins: winCounts[teamName] ?? 0,
    lastWonAt: null as string | null,
  }));

  rows.sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      a.teamName.localeCompare(b.teamName)
  );

  const maxWins = rows[0]?.tournamentWins ?? 0;

  return rows.map((row, index) => ({
    rank: index + 1,
    teamName: row.teamName,
    tournamentWins: row.tournamentWins,
    lastWonAt: row.lastWonAt,
    barPercent:
      maxWins > 0 ? Math.round((row.tournamentWins / maxWins) * 100) : 0,
    isLeader: index === 0 && row.tournamentWins > 0,
  }));
}

export async function getCupTeamWinsLeaderboardAsync(): Promise<{
  rows: CupTeamWinsLeaderboardRow[];
  source: "remote" | "local";
  totalCups: number;
}> {
  const profiles =
    typeof window !== "undefined" ? getAllCupLeaderboardProfiles() : [];
  const expectedTotal = profiles.reduce((sum, profile) => sum + profile.cupsWon, 0);
  let recorded: Record<string, number> = {};
  let entries: CupTeamWinEntry[] = [];
  let source: "remote" | "local" = "local";

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("cup_team_wins")
        .select("team_name, tournament_wins, last_won_at");

      if (!error && data) {
        source = "remote";
        for (const row of data) {
          recorded[row.team_name] = row.tournament_wins ?? 0;
        }
        entries = data.map((row) => ({
          teamName: row.team_name,
          tournamentWins: row.tournament_wins ?? 0,
          lastWonAt: row.last_won_at ?? new Date(0).toISOString(),
        }));
      }
    } catch (error) {
      console.error("[cup-team-wins] Supabase fetch failed:", error);
    }
  }

  if (source === "local") {
    entries = getAllCupTeamWins();
    recorded = Object.fromEntries(
      entries.map((entry) => [entry.teamName, entry.tournamentWins])
    );
  }

  const merged = mergeWinCounts(recorded, profiles);
  const rows = buildLeaderboardRows(merged);
  const totalCups = Object.values(merged).reduce((sum, wins) => sum + wins, 0);

  return {
    source,
    rows,
    totalCups: Math.max(totalCups, expectedTotal),
  };
}
