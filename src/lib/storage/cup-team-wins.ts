import { getPlayableClubNames } from "../clubs/super-league-display";
import { isLoggedIn } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAllCupLeaderboardProfiles } from "./cup-leaderboard";
import { STORAGE_KEYS } from "./keys";

export type CupTeamWinModeVariant = "current" | "era";

export interface CupTeamWinEntry {
  teamName: string;
  tournamentWins: number;
  lastWonAt: string;
}

function loadLocalTeamWinsKey(storageKey: string): Record<string, CupTeamWinEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CupTeamWinEntry>;
  } catch {
    return {};
  }
}

function saveLocalTeamWinsKey(
  storageKey: string,
  entries: Record<string, CupTeamWinEntry>
): void {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function loadRecordedRunIds(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markRunRecorded(storageKey: string, runId: string): void {
  const recorded = loadRecordedRunIds(storageKey);
  recorded.add(runId);
  localStorage.setItem(storageKey, JSON.stringify([...recorded]));
}

function hasRunRecorded(storageKey: string, runId: string | undefined): boolean {
  if (!runId) return false;
  return loadRecordedRunIds(storageKey).has(runId);
}

function incrementLocalTeamWins(
  storageKey: string,
  teamName: string
): CupTeamWinEntry {
  const entries = loadLocalTeamWinsKey(storageKey);
  const existing = entries[teamName];
  const updated: CupTeamWinEntry = {
    teamName,
    tournamentWins: (existing?.tournamentWins ?? 0) + 1,
    lastWonAt: new Date().toISOString(),
  };
  entries[teamName] = updated;
  saveLocalTeamWinsKey(storageKey, entries);
  return updated;
}

export function getAllCupTeamWins(): CupTeamWinEntry[] {
  return Object.values(loadLocalTeamWinsKey(STORAGE_KEYS.cupTeamWins)).sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      b.lastWonAt.localeCompare(a.lastWonAt)
  );
}

export function incrementCupTeamWinsLocal(teamName: string): CupTeamWinEntry {
  return incrementLocalTeamWins(STORAGE_KEYS.cupTeamWins, teamName);
}

async function incrementCupTeamWinsRemote(
  teamName: string,
  modeVariant: CupTeamWinModeVariant = "current",
  runId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !isLoggedIn()) return false;

  try {
    const { error } = await supabase.rpc("increment_cup_team_win", {
      p_team_name: teamName,
      p_mode_variant: modeVariant,
      p_run_id: runId ?? null,
    });
    if (!error) return true;

    const { data: existing, error: fetchError } = await supabase
      .from("cup_team_wins")
      .select("tournament_wins")
      .eq("team_name", teamName)
      .eq("mode_variant", modeVariant)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const nextWins = (existing?.tournament_wins ?? 0) + 1;
    const payload = {
      team_name: teamName,
      mode_variant: modeVariant,
      tournament_wins: nextWins,
      last_won_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("cup_team_wins")
        .update(payload)
        .eq("team_name", teamName)
        .eq("mode_variant", modeVariant);
      if (updateError) throw updateError;
      return true;
    }

    const { error: insertError } = await supabase.from("cup_team_wins").insert(payload);
    if (insertError) throw insertError;
    return true;
  } catch (error) {
    console.error("[cup-team-wins] Supabase increment failed:", error);
    return false;
  }
}

/** Record a Current Challenge Cup tournament win for the user's selected team. */
export function recordCupTeamWin(teamName: string, runId?: string): void {
  if (!teamName) return;
  if (hasRunRecorded(STORAGE_KEYS.cupTeamWinRuns, runId)) return;

  incrementCupTeamWinsLocal(teamName);
  if (runId) markRunRecorded(STORAGE_KEYS.cupTeamWinRuns, runId);
  void incrementCupTeamWinsRemote(teamName, "current", runId);
}

export function getAllEraCupTeamWins(): CupTeamWinEntry[] {
  return Object.values(loadLocalTeamWinsKey(STORAGE_KEYS.eraCupTeamWins)).sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      b.lastWonAt.localeCompare(a.lastWonAt)
  );
}

export function incrementEraCupTeamWinsLocal(teamName: string): CupTeamWinEntry {
  return incrementLocalTeamWins(STORAGE_KEYS.eraCupTeamWins, teamName);
}

/** Record an Era Challenge Cup tournament win — separate from Current cup wins. */
export function recordEraCupTeamWin(teamName: string, runId?: string): void {
  if (!teamName) return;
  if (hasRunRecorded(STORAGE_KEYS.eraCupTeamWinRuns, runId)) return;

  incrementEraCupTeamWinsLocal(teamName);
  if (runId) markRunRecorded(STORAGE_KEYS.eraCupTeamWinRuns, runId);
  void incrementCupTeamWinsRemote(teamName, "era", runId);
}

function buildEraLeaderboardRows(
  winCounts: Map<string, { wins: number; lastWonAt: string | null }>
): CupTeamWinsLeaderboardRow[] {
  const rows = [...winCounts.entries()].map(([teamName, data]) => ({
    teamName,
    tournamentWins: data.wins,
    lastWonAt: data.lastWonAt,
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

export function getEraCupTeamWinsLeaderboardRows(): CupTeamWinsLeaderboardRow[] {
  const entries = getAllEraCupTeamWins();
  const winCounts = new Map<string, { wins: number; lastWonAt: string | null }>();

  for (const entry of entries) {
    winCounts.set(entry.teamName, {
      wins: entry.tournamentWins,
      lastWonAt: entry.lastWonAt,
    });
  }

  return buildEraLeaderboardRows(winCounts);
}

export async function getEraCupTeamWinsLeaderboardAsync(): Promise<{
  rows: CupTeamWinsLeaderboardRow[];
  source: "remote" | "local";
  totalCups: number;
}> {
  let source: "remote" | "local" = "local";
  const winCounts = new Map<string, { wins: number; lastWonAt: string | null }>();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("cup_team_wins")
        .select("team_name, tournament_wins, last_won_at")
        .eq("mode_variant", "era");

      if (!error && data) {
        source = "remote";
        for (const row of data) {
          winCounts.set(row.team_name, {
            wins: row.tournament_wins ?? 0,
            lastWonAt: row.last_won_at ?? null,
          });
        }
      }
    } catch (error) {
      console.error("[cup-team-wins] Era Supabase fetch failed:", error);
    }
  }

  if (source === "local") {
    for (const entry of getAllEraCupTeamWins()) {
      winCounts.set(entry.teamName, {
        wins: entry.tournamentWins,
        lastWonAt: entry.lastWonAt,
      });
    }
  }

  const rows = buildEraLeaderboardRows(winCounts);
  const totalCups = rows.reduce((sum, row) => sum + row.tournamentWins, 0);

  return { source, rows, totalCups };
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

function filterPlayableWinCounts(
  recorded: Record<string, number>
): Record<string, number> {
  const playable = new Set(getPlayableClubNames());
  const merged: Record<string, number> = {};

  for (const [team, wins] of Object.entries(recorded)) {
    if (playable.has(team) && wins > 0) {
      merged[team] = wins;
    }
  }

  return merged;
}

function mergeWinCounts(
  recorded: Record<string, number>,
  profiles: ReturnType<typeof getAllCupLeaderboardProfiles>
): Record<string, number> {
  const merged = filterPlayableWinCounts(recorded);

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
  let source: "remote" | "local" = "local";

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("cup_team_wins")
        .select("team_name, tournament_wins, last_won_at")
        .eq("mode_variant", "current");

      if (!error && data) {
        source = "remote";
        for (const row of data) {
          recorded[row.team_name] = row.tournament_wins ?? 0;
        }
      }
    } catch (error) {
      console.error("[cup-team-wins] Supabase fetch failed:", error);
    }
  }

  if (source === "local") {
    const entries = getAllCupTeamWins();
    recorded = Object.fromEntries(
      entries.map((entry) => [entry.teamName, entry.tournamentWins])
    );
  }

  const merged =
    source === "remote"
      ? filterPlayableWinCounts(recorded)
      : mergeWinCounts(recorded, profiles);
  const rows = buildLeaderboardRows(merged);
  const totalCups = Object.values(merged).reduce((sum, wins) => sum + wins, 0);

  return {
    source,
    rows,
    totalCups: Math.max(totalCups, source === "local" ? expectedTotal : totalCups),
  };
}
