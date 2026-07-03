import { getPlayableClubNames } from "../clubs/super-league-display";
import { isSupabaseConfigured, supabase } from "../supabase";
import { STORAGE_KEYS } from "./keys";

export type CupTeamWinModeVariant = "current" | "era";

export interface CupTeamWinEntry {
  teamName: string;
  tournamentWins: number;
  lastWonAt: string | null;
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

function loadLocalTeamWinsKey(
  storageKey: string
): Record<string, CupTeamWinEntry> {
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
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function loadRecordedRuns(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markRunRecorded(storageKey: string, runId: string): void {
  if (typeof window === "undefined") return;
  const runs = loadRecordedRuns(storageKey);
  runs.add(runId);
  localStorage.setItem(storageKey, JSON.stringify([...runs]));
}

function hasRunRecorded(storageKey: string, runId?: string): boolean {
  if (!runId) return false;
  return loadRecordedRuns(storageKey).has(runId);
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

async function incrementCupTeamWinsRemote(
  teamName: string,
  modeVariant: CupTeamWinModeVariant = "current",
  runId?: string
): Promise<void> {
  if (!isSupabaseConfigured || !teamName.trim()) return;

  try {
    const { error } = await supabase.rpc("increment_cup_team_win", {
      p_team_name: teamName,
      p_mode_variant: modeVariant,
      p_run_id: runId ?? null,
    });
    if (error) {
      console.warn("cup team win remote increment failed", error.message);
    }
  } catch {
    // Offline or RPC unavailable — local counts still apply.
  }
}

function buildLeaderboardRows(
  winCounts: Map<string, { wins: number; lastWonAt: string | null }>
): CupTeamWinsLeaderboardRow[] {
  const playable = getPlayableClubNames();
  const rows = playable.map((teamName) => ({
    teamName,
    tournamentWins: winCounts.get(teamName)?.wins ?? 0,
    lastWonAt: winCounts.get(teamName)?.lastWonAt ?? null,
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
    barPercent: maxWins > 0 ? Math.round((row.tournamentWins / maxWins) * 100) : 0,
    isLeader: index === 0 && row.tournamentWins > 0,
  }));
}

export function getAllCupTeamWins(): CupTeamWinEntry[] {
  return Object.values(loadLocalTeamWinsKey(STORAGE_KEYS.cupTeamWins)).sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      a.teamName.localeCompare(b.teamName)
  );
}

export function incrementCupTeamWinsLocal(teamName: string): CupTeamWinEntry {
  return incrementLocalTeamWins(STORAGE_KEYS.cupTeamWins, teamName);
}

/** Record a Current Challenge Cup tournament win for the user's selected team. */
export function recordCupTeamWin(teamName: string, runId?: string): void {
  if (!teamName.trim()) return;
  if (hasRunRecorded(STORAGE_KEYS.cupTeamWinRuns, runId)) return;
  if (runId) markRunRecorded(STORAGE_KEYS.cupTeamWinRuns, runId);
  incrementCupTeamWinsLocal(teamName);
  void incrementCupTeamWinsRemote(teamName, "current", runId);
}

/** Record a manager-mode Challenge Cup win for the cup team wins leaderboard. */
export function recordManagerCupTeamWin(
  teamName: string,
  saveSlot: number,
  seasonYear: number
): void {
  recordCupTeamWin(teamName, `manager-${saveSlot}-${seasonYear}-cup`);
}

export function getAllEraCupTeamWins(): CupTeamWinEntry[] {
  return Object.values(loadLocalTeamWinsKey(STORAGE_KEYS.eraCupTeamWins)).sort(
    (a, b) =>
      b.tournamentWins - a.tournamentWins ||
      a.teamName.localeCompare(b.teamName)
  );
}

export function incrementEraCupTeamWinsLocal(teamName: string): CupTeamWinEntry {
  return incrementLocalTeamWins(STORAGE_KEYS.eraCupTeamWins, teamName);
}

/** Record an Era Challenge Cup tournament win — separate from Current cup wins. */
export function recordEraCupTeamWin(teamName: string, runId?: string): void {
  if (!teamName.trim()) return;
  if (hasRunRecorded(STORAGE_KEYS.eraCupTeamWinRuns, runId)) return;
  if (runId) markRunRecorded(STORAGE_KEYS.eraCupTeamWinRuns, runId);
  incrementEraCupTeamWinsLocal(teamName);
  void incrementCupTeamWinsRemote(teamName, "era", runId);
}

async function fetchRemoteWinCounts(
  modeVariant: CupTeamWinModeVariant
): Promise<Map<string, { wins: number; lastWonAt: string | null }> | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("cup_team_wins")
      .select("team_name, tournament_wins, last_won_at")
      .eq("mode_variant", modeVariant);

    if (error || !data) return null;

    const winCounts = new Map<string, { wins: number; lastWonAt: string | null }>();
    for (const row of data) {
      winCounts.set(row.team_name, {
        wins: row.tournament_wins,
        lastWonAt: row.last_won_at,
      });
    }
    return winCounts;
  } catch {
    return null;
  }
}

function mergeLocalWinCounts(
  winCounts: Map<string, { wins: number; lastWonAt: string | null }>,
  entries: CupTeamWinEntry[]
): void {
  for (const entry of entries) {
    const existing = winCounts.get(entry.teamName);
    if (!existing || entry.tournamentWins > existing.wins) {
      winCounts.set(entry.teamName, {
        wins: entry.tournamentWins,
        lastWonAt: entry.lastWonAt,
      });
    }
  }
}

export async function getCupTeamWinsLeaderboardAsync(): Promise<{
  rows: CupTeamWinsLeaderboardRow[];
  source: "remote" | "local";
  totalCups: number;
}> {
  const remote = await fetchRemoteWinCounts("current");
  const winCounts =
    remote ?? new Map<string, { wins: number; lastWonAt: string | null }>();
  mergeLocalWinCounts(winCounts, getAllCupTeamWins());
  const rows = buildLeaderboardRows(winCounts);
  const totalCups = rows.reduce((sum, row) => sum + row.tournamentWins, 0);

  return {
    rows,
    source: remote ? "remote" : "local",
    totalCups,
  };
}

export async function getEraCupTeamWinsLeaderboardAsync(): Promise<{
  rows: CupTeamWinsLeaderboardRow[];
  source: "remote" | "local";
  totalCups: number;
}> {
  const remote = await fetchRemoteWinCounts("era");
  const winCounts =
    remote ?? new Map<string, { wins: number; lastWonAt: string | null }>();
  mergeLocalWinCounts(winCounts, getAllEraCupTeamWins());
  const rows = buildLeaderboardRows(winCounts);
  const totalCups = rows.reduce((sum, row) => sum + row.tournamentWins, 0);

  return {
    rows,
    source: remote ? "remote" : "local",
    totalCups,
  };
}
