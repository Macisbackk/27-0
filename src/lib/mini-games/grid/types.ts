import type { Position } from "@/lib/types";

/** Rows × columns. */
export const GRID_SIZE = 3;
export const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE;
/** One guess per cell; a wrong guess still uses one up. */
export const GRID_MAX_GUESSES = GRID_CELL_COUNT;
/** Every cell of a generated grid has at least this many valid answers. */
export const GRID_MIN_ANSWERS = 3;
export const GRID_STATS_SCHEMA = 1;

export type GridCriterionKind = "club" | "nation" | "position" | "era" | "honour";

export type GridCriterion = {
  /** Stable id stored on runs, e.g. "club:wigan", "nation:australia", "position:HOOKER". */
  id: string;
  kind: GridCriterionKind;
  /** Short header label (club code, "Australia", "Hooker"). */
  label: string;
  /** Plain-English description, e.g. "Played for Wigan Warriors". */
  name: string;
  /** Header sub-label for non-club criteria ("Nation", "Position"…). */
  tag?: string;
  /** Club name for colour chips (club criteria only). */
  clubName?: string;
};

/** One real-world player: every year card for the same person merged together. */
export type GridPlayer = {
  /** Stable identity key (normalised name of the preferred card). */
  id: string;
  /** Same as id — lets the shared autocomplete de-dupe by identity. */
  identityId: string;
  displayName: string;
  clubIds: string[];
  nationKeys: string[];
  positions: Position[];
  /** Earliest season the player is known to have played. */
  firstYear: number;
  /** Has a card in a current Super League squad. */
  current: boolean;
  superLeagueChampion: boolean;
  challengeCupWinner: boolean;
  dreamTeam: boolean;
  /** Best card rating — used to order revealed answers (best-known first). */
  fame: number;
};

export type GridCellEntry = {
  playerId: string;
  name: string;
};

export type GridMode = "daily" | "practice";
export type GridStatus = "playing" | "finished";

export type GridRun = {
  /** Unique run id: `daily:YYYY-MM-DD` or `practice:<seed>`. */
  id: string;
  mode: GridMode;
  /** Generation seed (the UK date key for the daily grid). */
  seed: string;
  /** UK date the run was started (daily reward + stats key). */
  dateKey: string;
  rows: string[];
  cols: string[];
  /** Row-major, length 9. */
  cells: (GridCellEntry | null)[];
  guessesUsed: number;
  status: GridStatus;
  rewardClaimed: boolean;
};

export type GridStats = {
  schemaVersion: number;
  /** Daily grids finished. */
  played: number;
  /** Daily grids finished 9/9. */
  perfect: number;
  totalCorrect: number;
  bestScore: number;
  /** Consecutive UK days with a finished daily grid. */
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
};
