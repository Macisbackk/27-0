import type { Position } from "../types";
import type { MatchFixture } from "../game/season-simulation";

export type PlayingStyle =
  | "balanced"
  | "expansive"
  | "direct"
  | "defensive"
  | "high_tempo";

export type AttackFocus =
  | "middle"
  | "edges"
  | "kicking_game"
  | "offloads"
  | "safe_sets";

export type DefenceFocus =
  | "line_speed"
  | "conservative"
  | "aggressive_contact"
  | "edge_defence"
  | "goal_line";

export type RiskLevel = "low" | "normal" | "high";

export interface ManagerTactics {
  playingStyle: PlayingStyle;
  attackFocus: AttackFocus;
  defenceFocus: DefenceFocus;
  riskLevel: RiskLevel;
}

export type InjuryType =
  | "knock"
  | "minor_strain"
  | "hamstring"
  | "shoulder"
  | "concussion"
  | "knee"
  | "suspension";

export interface ManagerInjury {
  type: InjuryType;
  matchesRemaining: number;
  serious: boolean;
}

export interface ManagerPlayerState {
  playerId: string;
  form: number;
  morale: number;
  fitness: number;
  injury: ManagerInjury | null;
  seasonAppearances: number;
  seasonTries: number;
}

export interface ManagerScheduledFixture {
  round: number;
  opponent: string;
  isHome: boolean;
}

export interface ManagerLeagueRow {
  team: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  leaguePoints: number;
  isUserTeam: boolean;
}

export interface ManagerRoundMatch {
  round: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}

export interface ManagerMatchMeta {
  tacticImpactLine?: string;
  injuries: { playerId: string; name: string; injury: ManagerInjury }[];
}

export interface ManagerFixtureRecord extends MatchFixture {
  userClub: string;
  meta?: ManagerMatchMeta;
}

export interface ManagerSeasonSummary {
  seasonYear: number;
  position: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  boardVerdict: string;
  budgetChange: number;
  trophies: string[];
  bestPlayerId: string | null;
  topTryScorerId: string | null;
}

export type ManagerView =
  | "landing"
  | "club-select"
  | "hub"
  | "squad"
  | "tactics"
  | "transfers"
  | "fixtures"
  | "table"
  | "match-review"
  | "season-review";

export interface ManagerCareer {
  id: string;
  club: string;
  seasonYear: number;
  seed: string;
  budget: number;
  clubFundsEarned: number;
  boardConfidence: number;
  boardExpectation: string;
  difficulty: number;
  tactics: ManagerTactics;
  squad: ManagerPlayerState[];
  matchdayXiii: string[];
  matchdayInterchange: string[];
  xiiiSlotPositions: Position[];
  schedule: ManagerScheduledFixture[];
  fixtures: ManagerFixtureRecord[];
  roundMatches: ManagerRoundMatch[];
  currentRound: number;
  leagueTable: ManagerLeagueRow[];
  transferMarket: string[];
  wins: number;
  losses: number;
  isSeasonComplete: boolean;
  seasonHistory: ManagerSeasonSummary[];
  matchSimState: { form: number; seasonDropGoals: number };
  lastMatchFixture: ManagerFixtureRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerLifetimeStats {
  careersStarted: number;
  seasonsCompleted: number;
  wins: number;
  losses: number;
  trophies: number;
  leagueTitles: number;
  challengeCups: number;
  bestFinish: number | null;
  biggestWin: number;
  biggestDefeat: number;
  totalEarnings: number;
  favouriteClub: string | null;
  clubSeasons: Record<string, number>;
}

export const DEFAULT_TACTICS: ManagerTactics = {
  playingStyle: "balanced",
  attackFocus: "middle",
  defenceFocus: "line_speed",
  riskLevel: "normal",
};

export const MANAGER_SEASON_GAMES = 27;
