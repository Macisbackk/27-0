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

export type SquadRole =
  | "Star"
  | "Starter"
  | "Rotation"
  | "Prospect"
  | "Depth";

export type ContractStatus =
  | "expires_this_season"
  | "one_year_left"
  | "long_term"
  | "wants_renewal"
  | "unhappy"
  | "renewed"
  | "leaving";

export type ManagerCompetition = "league" | "challenge_cup";

export type CupRoundKey =
  | "round_one"
  | "quarter_final"
  | "semi_final"
  | "final";

export interface RenewalDemand {
  wagePerYear: number;
  yearsRequested: number;
  signingBonus?: number;
  squadRole: SquadRole;
}

export interface PlayerContract {
  wagePerYear: number;
  yearsRemaining: number;
  expiresAtSeasonEnd: boolean;
  squadRole: SquadRole;
  happiness: number;
  renewalDemand?: RenewalDemand;
  status?: ContractStatus;
}

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

export interface ManagerPlayerSeasonStats {
  playerId: string;
  appearances: number;
  tries: number;
  goals: number;
  playerOfMatch: number;
}

export interface ManagerTeamSeasonStats {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  triesFor: number;
  triesAgainst: number;
  leaguePoints: number;
}

export interface ClubAttendanceData {
  baseAttendance: number;
  currentAverageAttendance: number;
  stadiumCapacity: number;
  fanMood: number;
}

export interface GateIncomeRecord {
  fixtureId: string;
  round: number;
  attendance: number;
  income: number;
  competition: ManagerCompetition;
}

export interface ManagerScheduledFixture {
  id: string;
  round: number;
  opponent: string;
  isHome: boolean;
  competition: ManagerCompetition;
  cupRound?: CupRoundKey;
  cupMatchId?: string;
  label: string;
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

export interface MatchAttendanceMeta {
  attendance: number;
  gateIncome: number;
  fanMoodChange: number;
  ticketPrice: number;
}

export interface ManagerMatchMeta {
  tacticImpactLine?: string;
  tacticEffectivenessLine?: string;
  injuries: { playerId: string; name: string; injury: ManagerInjury }[];
  playerOfMatchId?: string | null;
  playedLive?: boolean;
  attendance?: MatchAttendanceMeta;
  competition?: ManagerCompetition;
  cupRound?: CupRoundKey;
}

export interface ManagerFixtureRecord extends MatchFixture {
  userClub: string;
  fixtureId?: string;
  competition?: ManagerCompetition;
  meta?: ManagerMatchMeta;
}

export interface ManagerSeasonSummary {
  seasonYear: number;
  position: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  boardVerdict: string;
  budgetChange: number;
  trophies: string[];
  bestPlayerId: string | null;
  topTryScorerId: string | null;
  challengeCupResult: string;
  biggestWin: number;
  biggestDefeat: number;
  averageAttendance: number;
  highestAttendance: number;
  lowestAttendance: number;
  finalFanMood: number;
  wageBill: number;
  expiringContracts: number;
  playersLeaving: string[];
  seasonVerdict: string;
}

import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
  | "landing"
  | "club-select"
  | "hub"
  | "squad"
  | "tactics"
  | "contracts"
  | "transfers"
  | "fixtures"
  | "table"
  | "stats"
  | "play-game"
  | "match-review"
  | "season-review";

export type LiveMatchCommand =
  | "attack"
  | "defend"
  | "balanced"
  | "kick_early"
  | "use_forwards"
  | "spread_wide"
  | "calm_down";

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
  contracts: Record<string, PlayerContract>;
  wageBudget: number;
  wageBill: number;
  attendanceData: ClubAttendanceData;
  gateIncomeHistory: GateIncomeRecord[];
  challengeCup: ChallengeCupBracketState;
  matchdayXiii: string[];
  matchdayInterchange: string[];
  xiiiSlotPositions: Position[];
  schedule: ManagerScheduledFixture[];
  fixtures: ManagerFixtureRecord[];
  roundMatches: ManagerRoundMatch[];
  gameWeek: number;
  currentFixtureIndex: number;
  currentRound: number;
  leagueTable: ManagerLeagueRow[];
  transferMarket: string[];
  wins: number;
  losses: number;
  teamSeasonStats: ManagerTeamSeasonStats;
  playerSeasonStats: Record<string, ManagerPlayerSeasonStats>;
  recentForm: string[];
  isSeasonComplete: boolean;
  seasonHistory: ManagerSeasonSummary[];
  matchSimState: { form: number; seasonDropGoals: number };
  lastMatchFixture: ManagerFixtureRecord | null;
  seasonAttendance: { total: number; count: number; high: number; low: number };
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

export const CUP_ROUND_LABELS: Record<CupRoundKey, string> = {
  round_one: "Challenge Cup Round One",
  quarter_final: "Challenge Cup Quarter-Final",
  semi_final: "Challenge Cup Semi-Final",
  final: "Challenge Cup Final",
};
