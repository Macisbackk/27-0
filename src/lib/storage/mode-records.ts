import { STORAGE_KEYS } from "./keys";

/**
 * Personal bests for the side modes (this device): One-Club XI per club ("Your all-time Wigan
 * XI: 25-2") and the Gauntlet. Pure update helpers are exported for scripts/test-side-modes.ts.
 */

export interface OneClubRecord {
  /** Best regular season: most wins, then fewest losses. */
  wins: number;
  losses: number;
  seasons: number;
  /** Grand Finals won with this club's XI. */
  titles: number;
  perfectSeasons: number;
  /** When the best record was set (ISO). */
  bestAt: string;
}

export interface GauntletRecord {
  /** Most sides beaten in one run (0–10). */
  best: number;
  runs: number;
  /** Runs that beat all ten. */
  sweeps: number;
  /** Best per draft pool. */
  bestCurrent: number;
  bestEra: number;
}

export interface ModeRecords {
  v: 1;
  oneClub: Record<string, OneClubRecord>;
  gauntlet: GauntletRecord;
  /** Run ids already counted (newest last, capped) so a re-render can't count a run twice. */
  runs: string[];
}

const MAX_RUNS = 60;

export function emptyModeRecords(): ModeRecords {
  return {
    v: 1,
    oneClub: {},
    gauntlet: { best: 0, runs: 0, sweeps: 0, bestCurrent: 0, bestEra: 0 },
    runs: [],
  };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function parseModeRecords(raw: string | null): ModeRecords {
  const empty = emptyModeRecords();
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<ModeRecords>;
    const oneClub: Record<string, OneClubRecord> = {};
    for (const [club, r] of Object.entries(parsed.oneClub ?? {})) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Partial<OneClubRecord>;
      oneClub[club] = {
        wins: Math.min(27, n(rec.wins)),
        losses: Math.min(27, n(rec.losses)),
        seasons: n(rec.seasons),
        titles: n(rec.titles),
        perfectSeasons: n(rec.perfectSeasons),
        bestAt: typeof rec.bestAt === "string" ? rec.bestAt : "",
      };
    }
    const g = (parsed.gauntlet ?? {}) as Partial<GauntletRecord>;
    return {
      v: 1,
      oneClub,
      gauntlet: {
        best: Math.min(10, n(g.best)),
        runs: n(g.runs),
        sweeps: n(g.sweeps),
        bestCurrent: Math.min(10, n(g.bestCurrent)),
        bestEra: Math.min(10, n(g.bestEra)),
      },
      runs: Array.isArray(parsed.runs) ? parsed.runs.filter((x): x is string => typeof x === "string").slice(-MAX_RUNS) : [],
    };
  } catch {
    return empty;
  }
}

function markRun(state: ModeRecords, key: string): ModeRecords {
  return { ...state, runs: [...state.runs, key].slice(-MAX_RUNS) };
}

/** Add a finished One-Club regular season. Returns the new state and whether it's a new best. */
export function applyOneClubSeason(
  state: ModeRecords,
  input: { runId: string; club: string; wins: number; losses: number; at?: string }
): { state: ModeRecords; newBest: boolean; record: OneClubRecord } {
  const key = `oc:${input.runId}`;
  const prev = state.oneClub[input.club];
  if (state.runs.includes(key) && prev) return { state, newBest: false, record: prev };
  const better =
    !prev || prev.seasons === 0 || input.wins > prev.wins || (input.wins === prev.wins && input.losses < prev.losses);
  const record: OneClubRecord = {
    wins: better ? input.wins : prev!.wins,
    losses: better ? input.losses : prev!.losses,
    seasons: (prev?.seasons ?? 0) + 1,
    titles: prev?.titles ?? 0,
    perfectSeasons: (prev?.perfectSeasons ?? 0) + (input.wins === 27 ? 1 : 0),
    bestAt: better ? input.at ?? new Date().toISOString() : prev!.bestAt,
  };
  return {
    state: markRun({ ...state, oneClub: { ...state.oneClub, [input.club]: record } }, key),
    newBest: better,
    record,
  };
}

/** Count a Grand Final won with a One-Club XI (once per run). */
export function applyOneClubTitle(state: ModeRecords, input: { runId: string; club: string }): ModeRecords {
  const key = `oct:${input.runId}`;
  const prev = state.oneClub[input.club];
  if (state.runs.includes(key) || !prev) return state;
  return markRun({ ...state, oneClub: { ...state.oneClub, [input.club]: { ...prev, titles: prev.titles + 1 } } }, key);
}

/** Add a finished Gauntlet run. */
export function applyGauntletRun(
  state: ModeRecords,
  input: { runId: string; beaten: number; era: boolean; total: number }
): { state: ModeRecords; newBest: boolean } {
  const key = `g:${input.runId}`;
  if (state.runs.includes(key)) return { state, newBest: false };
  const g = state.gauntlet;
  const beaten = Math.max(0, Math.min(input.total, Math.floor(input.beaten)));
  const newBest = g.runs === 0 || beaten > g.best;
  return {
    state: markRun(
      {
        ...state,
        gauntlet: {
          best: Math.max(g.best, beaten),
          runs: g.runs + 1,
          sweeps: g.sweeps + (beaten === input.total ? 1 : 0),
          bestCurrent: input.era ? g.bestCurrent : Math.max(g.bestCurrent, beaten),
          bestEra: input.era ? Math.max(g.bestEra, beaten) : g.bestEra,
        },
      },
      key
    ),
    newBest,
  };
}

/** "25-2" */
export function formatOneClubRecord(record: Pick<OneClubRecord, "wins" | "losses">): string {
  return `${record.wins}-${record.losses}`;
}

// ---------------------------------------------------------------------------
// Device storage
// ---------------------------------------------------------------------------

export const MODE_RECORDS_CHANGED_EVENT = "27-0-mode-records-changed";

export function loadModeRecords(): ModeRecords {
  if (typeof window === "undefined") return emptyModeRecords();
  try {
    return parseModeRecords(localStorage.getItem(STORAGE_KEYS.modeRecords));
  } catch {
    return emptyModeRecords();
  }
}

function saveModeRecords(state: ModeRecords): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.modeRecords, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(MODE_RECORDS_CHANGED_EVENT));
  } catch {
    // storage unavailable: the run still plays, the best just isn't kept
  }
}

export function recordOneClubSeason(input: { runId: string; club: string; wins: number; losses: number }): {
  newBest: boolean;
  record: OneClubRecord;
  previous: OneClubRecord | null;
} {
  const before = loadModeRecords();
  const previous = before.oneClub[input.club] ?? null;
  const { state, newBest, record } = applyOneClubSeason(before, input);
  if (state !== before) saveModeRecords(state);
  return { newBest, record, previous };
}

export function recordOneClubTitle(input: { runId: string; club: string }): void {
  const before = loadModeRecords();
  const next = applyOneClubTitle(before, input);
  if (next !== before) saveModeRecords(next);
}

export function recordGauntletRun(input: { runId: string; beaten: number; era: boolean; total: number }): {
  newBest: boolean;
  record: GauntletRecord;
} {
  const { state, newBest } = applyGauntletRun(loadModeRecords(), input);
  saveModeRecords(state);
  return { newBest, record: state.gauntlet };
}
