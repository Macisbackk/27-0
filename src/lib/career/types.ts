/**
 * Manager Mode (v2) — data model.
 *
 * Deliberately small: a career is clubs + players + one season calendar. Everything is
 * plain JSON so a whole career saves to localStorage / Supabase as one document.
 */

export type Division = "super-league" | "championship";

/** Short position codes used across the career engine and UI. */
export type Pos = "FB" | "WG" | "CE" | "SO" | "SH" | "PR" | "HK" | "SR" | "LF";

export type Tactic = "attack" | "balanced" | "defend";

export interface CareerPlayer {
  id: string;
  name: string;
  pos: Pos;
  rating: number;
  /** Ceiling for development; hidden-ish in UI (shown as stars for prospects). */
  potential: number;
  age: number;
  nationality: string;
  /** Real player from the 27-0 database (vs generated). */
  real: boolean;
  legend?: boolean;
  /** Came through this career's academy (counts for academy challenges). */
  academy?: boolean;
  /** Season stats (reset each season). */
  apps: number;
  tries: number;
  /** Career totals while at any club in this save. */
  careerApps: number;
  careerTries: number;
}

export interface CareerClub {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  division: Division;
  /** Player ids. */
  squad: string[];
}

export type FixtureKind = "league" | "cup" | "semi" | "grand-final" | "mpg";

export interface FixtureResult {
  homeScore: number;
  awayScore: number;
  /** Player ids, one entry per try. */
  homeTries: string[];
  awayTries: string[];
  /** Won in golden-point extra time (knockouts only). */
  goldenPoint?: boolean;
  motm?: string;
}

export interface Fixture {
  id: string;
  kind: FixtureKind;
  /** League round number, or cup round index. */
  round: number;
  label: string;
  division?: Division;
  home: string;
  away: string;
  result?: FixtureResult;
}

export interface TableRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
  /** Last five results, newest last: "W" | "D" | "L". */
  form: string[];
}

/** One step of the season. Holds every fixture played that step (any competition). */
export interface Matchday {
  index: number;
  label: string;
  fixtures: Fixture[];
  /** Knockout rounds whose fixtures are drawn when the previous round completes. */
  pendingDraw?: "cup-r16" | "cup-qf" | "cup-sf" | "cup-final" | "playoff-semis" | "grand-final";
  played: boolean;
}

export type ChallengeKind =
  | "win-games"
  | "finish-top"
  | "cup-reach"
  | "beat-club"
  | "big-win"
  | "unbeaten-run"
  | "academy-debuts"
  | "points-scored";

export interface SeasonChallenge {
  id: string;
  kind: ChallengeKind;
  title: string;
  target: number;
  /** For beat-club. */
  clubId?: string;
  rewardCash: number;
  rewardLegacy: number;
  progress: number;
  done: boolean;
}

export interface SeasonOutcome {
  year: number;
  division: Division;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  trophies: TrophyId[];
  promoted: boolean;
  relegated: boolean;
  prizeMoney: number;
  legacyEarned: number;
  challengesDone: number;
  topTryScorer?: { name: string; tries: number };
  /** Set once this season has been banked into the cross-career legacy. */
  banked?: boolean;
}

export type TrophyId =
  | "grand-final"
  | "league-leaders"
  | "challenge-cup"
  | "championship-title"
  | "promotion"
  | "million-pound-game"
  | "perfect-season";

export interface CareerState {
  version: 1;
  seed: string;
  createdAt: number;
  updatedAt: number;
  managerName: string;
  userClubId: string;
  /** Division the user started in (for "fastest climb" records). */
  startDivision: Division;
  year: number;
  seasonNumber: number;
  budget: number;
  /** This season's board income and wage bill (shown on the hub). */
  lastIncome?: number;
  lastWages?: number;
  /** 1–5, in half steps. Drives income and which players will sign. */
  prestige: number;
  tactic: Tactic;
  /** 13 player ids in shirt order 1–13 (see LINEUP_SLOTS). */
  lineup: string[];
  clubs: Record<string, CareerClub>;
  players: Record<string, CareerPlayer>;
  /** Unsigned players (released / free agents) still in the world. */
  freeAgents: string[];
  calendar: Matchday[];
  /** Index of the next unplayed matchday; === calendar.length when the season is over. */
  matchdayIndex: number;
  tables: Record<Division, TableRow[]>;
  challenges: SeasonChallenge[];
  /** Season-long tracking for challenges / records. */
  seasonTrack: {
    unbeatenRun: number;
    bestUnbeatenRun: number;
    biggestWinMargin: number;
    academyDebutIds: string[];
    pointsScored: number;
    cupRoundReached: number;
  };
  phase: "season" | "review" | "transfers";
  /** Filled at season end; shown on the review screen. */
  lastOutcome?: SeasonOutcome;
  history: SeasonOutcome[];
  /** Short news lines for the hub, newest first. */
  news: string[];
  /** Season ids of the first Super League Grand Final win (for the fastest-climb record). */
  firstGrandFinalSeason?: number;
}

/** Persists across every career on this device / account. */
export interface CareerLegacy {
  version: 1;
  legacyPoints: number;
  lifetimeLegacyPoints: number;
  unlockedLegends: string[];
  careersStarted: number;
  trophies: Record<TrophyId, number>;
  /** Fewest seasons from a Championship start to a Super League Grand Final win. */
  fastestGlorySeasons?: number;
  bestSeason?: { wins: number; losses: number; drawn: number; year: number; clubName: string };
  perfectSeasons: number;
  biggestWin?: { margin: number; score: string; opponent: string; year: number };
  updatedAt: number;
}
