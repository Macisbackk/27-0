import type { Position } from "../types";
import type { MatchFixture } from "../game/season-simulation";
import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";

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
  fitness: number;
  injury: ManagerInjury | null;
  seasonAppearances: number;
  seasonTries: number;
}

export interface ManagerReservePlayer {
  id: string;
  name: string;
  age: number;
  nationality: string;
  position: Position;
  eligiblePositions: Position[];
  rating: number;
  baseRating: number;
  potentialRating: number;
  developmentRate: number;
  form: number;
  fitness: number;
  reserveAppearances: number;
  reserveTries: number;
  calledUpForNextMatch: boolean;
}

export interface ReserveFixtureResult {
  round: number;
  opponent: string;
  opponentClub: string;
  userScore: number;
  oppScore: number;
  userWon: boolean;
  topPerformer?: string;
  userTries: number;
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
  liveEvents?: LiveMatchEvent[];
}

export interface LiveMatchEvent {
  minute: number;
  type: "try" | "goal" | "penalty" | "drop_goal" | "note";
  team: "user" | "opponent";
  playerName?: string;
  description: string;
  points: number;
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


export type ManagerView =
  | "landing"
  | "club-select"
  | "hub"
  | "squad"
  | "tactics"
  | "contracts"
  | "reserves"
  | "inbox"
  | "transfers"
  | "fixtures"
  | "table"
  | "stats"
  | "play-game"
  | "match-review"
  | "season-review"
  | "season-rewards";

export type LiveMatchPhase =
  | "preview"
  | "first_half"
  | "halftime"
  | "second_half"
  | "full_time";

export interface PlayerTransferStatus {
  listed: boolean;
  askingPrice: number;
  listedAtGameWeek: number;
}

export interface LeagueListedPlayer {
  playerId: string;
  club: string;
  askingPrice: number;
  listedAtWeek: number;
}

export type InboxMessageType =
  | "transfer_offer_in"
  | "transfer_offer_out"
  | "contract"
  | "board"
  | "injury"
  | "release"
  | "cup_draw"
  | "season_reward"
  | "general";

export interface InboxMessage {
  id: string;
  type: InboxMessageType;
  title: string;
  body: string;
  gameWeek: number;
  createdAt: string;
  resolved: boolean;
  playerId?: string;
  playerName?: string;
  offerClub?: string;
  offerAmount?: number;
  askingPrice?: number;
}

export type LiveMatchCommand =
  | "attack"
  | "defend"
  | "balanced"
  | "use_forwards"
  | "spread_wide";

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
  leagueListedPlayers: LeagueListedPlayer[];
  playerTransferStatus: Record<string, PlayerTransferStatus>;
  inboxMessages: InboxMessage[];
  clubFunds: Record<string, number>;
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
  seasonRewardClaimedForYear?: number | null;
  reserves: ManagerReservePlayer[];
  reserveResults: ReserveFixtureResult[];
  lastReserveResult: ReserveFixtureResult | null;
  calledUpReserveIds: string[];
  playerRegistry: Record<string, import("../types").Player>;
  hubResultsExpanded?: boolean;
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
};

export const MANAGER_SEASON_GAMES = 27;

export const CUP_ROUND_LABELS: Record<CupRoundKey, string> = {
  round_one: "Challenge Cup Round One",
  quarter_final: "Challenge Cup Quarter-Final",
  semi_final: "Challenge Cup Semi-Final",
  final: "Challenge Cup Final",
};
