/**
 * Authoritative types for Rugby League Manager Mode.
 *
 * Strict single source of truth design:
 * - Every player exists once in state.players[id].
 * - Every club exists once in state.clubs[id].
 * - Club and squad tier ownership is strictly defined on the player.
 */

export type Position =
  | "FULLBACK"
  | "WING"
  | "CENTRE"
  | "STAND_OFF"
  | "SCRUM_HALF"
  | "PROP"
  | "HOOKER"
  | "SECOND_ROW"
  | "LOOSE_FORWARD";

export type SquadTier = "first" | "reserves" | "academy";

export type CompetitionId = "super-league" | "championship" | "challenge-cup" | "friendlies";

export type TrainingFocus =
  | "balanced"
  | "attack"
  | "defence"
  | "fitness"
  | "recovery"
  | "development";

export type TrainingIntensity = "low" | "normal" | "high";

export type SquadRole = "star" | "first_team" | "rotation" | "backup" | "youth";

export interface PlayerInjury {
  type: string;
  weeksRemaining: number;
  severity: "minor" | "moderate" | "severe";
}

export interface PlayerSuspension {
  weeksRemaining: number;
  reason: string;
}

export interface PlayerLoanInfo {
  parentClubId: string;
  destinationClubId: string;
  weeksRemaining: number;
  wageContributionPct: number; // e.g. 50 = parent pays 50%, dest pays 50%
  canRecall: boolean;
}

export interface PlayerContract {
  wageWeekly: number; // weekly wage in GBP
  expiresSeason: number; // year e.g. 2027
  role: SquadRole;
  isMarquee?: boolean; // Super League marquee player salary cap exception
}

export interface PlayerMatchStats {
  apps: number;
  tries: number;
  goals: number;
  dropGoals: number;
  points: number;
  motm: number;
  avgRating: number;
  matchRatings: number[]; // recent ratings (last 5)
}

export interface ManagerPlayer {
  id: string;
  name: string;
  dob: string; // YYYY-MM-DD
  age: number;
  nationality: string;
  position: Position;
  secondaryPosition?: Position;
  rating: number; // base rating 40-99
  potential: number; // ceiling rating 40-99
  form: number; // 5.0 - 10.0 scale, baseline 7.0
  morale: number; // 0 - 100 scale, baseline 75
  fitness: number; // 0 - 100 scale, 100 = full match fitness
  fatigue: number; // 0 - 100 scale, higher = tired, higher injury risk
  injury: PlayerInjury | null;
  suspension: PlayerSuspension | null;
  clubId: string | null; // null for free agents
  squadTier: SquadTier | null; // null for free agents
  loan: PlayerLoanInfo | null;
  contract: PlayerContract | null;
  trainingFocus: TrainingFocus;
  stats: PlayerMatchStats;
  careerStats: {
    apps: number;
    tries: number;
    goals: number;
    dropGoals: number;
    points: number;
    motm: number;
  };
  isTransferListed?: boolean;
  isLoanListed?: boolean;
  isRetired?: boolean;
}

export interface FinancialTransaction {
  id: string;
  season: number;
  week: number;
  amount: number; // positive = revenue, negative = expense
  category: "wages" | "transfers_in" | "transfers_out" | "ticket_sales" | "prize_money" | "facilities" | "misc";
  description: string;
}

export interface ClubFinances {
  balance: number; // available cash in GBP
  wageBudgetWeekly: number;
  transferBudget: number;
  seasonRevenue: number;
  seasonExpenses: number;
  history: FinancialTransaction[];
}

export interface ClubFacilities {
  training: number; // 1 - 5 stars
  youth: number; // 1 - 5 stars
  stadiumCapacity: number;
}

export interface BoardObjective {
  id: string;
  title: string;
  description: string;
  category: "league" | "cup" | "finances" | "youth";
  targetValue: number | string;
  currentValue: number | string;
  isCompleted: boolean;
  isFailed: boolean;
  importance: "low" | "medium" | "high" | "critical";
}

export interface ClubTactics {
  formation: "standard"; // 13 starters (1-13) + 4 interchange (14-17)
  style: "balanced" | "expansive" | "attritional" | "direct";
  kickingFocus: "territory" | "attacking" | "retention";
  trainingIntensity: TrainingIntensity;
  primaryGoalKickerId?: string;
}

export interface ClubLineup {
  starting13: (string | null)[]; // 13 slots: [FB, WG, CE, CE, WG, SO, SH, PF, HK, PF, SR, SR, LF]
  bench: (string | null)[];      // 4 slots: [14, 15, 16, 17]
}

export interface ManagerClub {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  competitionId: CompetitionId;
  reputation: number; // 1 - 5 stars
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColour: string;
  finances: ClubFinances;
  facilities: ClubFacilities;
  coachingQuality: number; // 1 - 5
  boardConfidence: number; // 0 - 100
  boardObjectives: BoardObjective[];
  tactics: ClubTactics;
  lineup: ClubLineup;
  stadiumName: string;
}

export interface MatchScoreEvent {
  minute: number;
  type: "TRY" | "CONVERSION" | "PENALTY_GOAL" | "DROP_GOAL";
  playerId: string;
  playerName: string;
  clubId: string;
}

export interface MatchPlayerPerformance {
  playerId: string;
  playerName: string;
  clubId: string;
  position: Position;
  rating: number; // match rating 1 - 10
  tries: number;
  goals: number;
  dropGoals: number;
  points: number;
  sinBin?: boolean;
  sentOff?: boolean;
  injured?: boolean;
}

export interface ManagerFixture {
  id: string;
  competitionId: CompetitionId;
  season: number;
  week: number;
  roundName: string; // e.g. "Round 1", "Quarter Final", "Pre-Season Friendly"
  homeClubId: string;
  awayClubId: string;
  isPlayed: boolean;
  homeScore?: number;
  awayScore?: number;
  scoreEvents?: MatchScoreEvent[];
  playerPerformances?: MatchPlayerPerformance[];
  manOfTheMatchPlayerId?: string;
  attendance?: number;
}

export interface LeagueTableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  bonusPoints: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface PlayoffMatch {
  id: string;
  round: "eliminator" | "semi_final" | "grand_final";
  homeClubId: string;
  awayClubId: string;
  isPlayed: boolean;
  homeScore?: number;
  awayScore?: number;
  winnerClubId?: string;
}

export interface ManagerCompetition {
  id: CompetitionId;
  name: string;
  tier: number;
  clubIds: string[];
  standings: LeagueTableRow[];
  fixtures: ManagerFixture[];
  phase: "regular_season" | "playoffs" | "completed";
  playoffMatches?: PlayoffMatch[];
  championClubId?: string;
  runnerUpClubId?: string;
}

export interface TransferBid {
  id: string;
  season: number;
  week: number;
  playerId: string;
  fromClubId: string;
  toClubId: string; // club owning player
  offeredFee: number;
  offeredWage: number;
  offeredRole: SquadRole;
  offeredContractYears: number;
  status: "pending_club" | "club_accepted" | "club_rejected" | "player_accepted" | "player_rejected" | "completed" | "cancelled";
  rejectionReason?: string;
}

export interface CompletedTransfer {
  id: string;
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  fromClubId: string | null; // null if free agent
  toClubId: string;
  fee: number;
  wageWeekly: number;
  contractYears: number;
}

export interface ActiveLoan {
  id: string;
  playerId: string;
  playerName: string;
  parentClubId: string;
  destinationClubId: string;
  seasonStarted: number;
  weekStarted: number;
  totalWeeks: number;
  weeksRemaining: number;
  wageContributionPct: number;
  canRecall: boolean;
}

export interface InboxMessage {
  id: string;
  season: number;
  week: number;
  dateStr: string;
  sender: string;
  subject: string;
  body: string;
  category: "transfer" | "loan" | "contract" | "injury" | "match" | "board" | "general";
  isRead: boolean;
  actionRequired?: boolean;
  relatedEntityId?: string; // e.g. playerId or bidId
  actions?: {
    label: string;
    actionType: "accept_bid" | "reject_bid" | "renew_contract" | "recall_loan" | "dismiss";
    payload?: any;
  }[];
}

export interface ManagerProfile {
  name: string;
  clubId: string;
  reputation: number; // 1 - 5
  appointedSeason: number;
  trophiesWon: { season: number; trophy: string; clubId: string }[];
  managerOfTheYearAwards: number;
}

export interface ManagerCalendar {
  currentSeason: number; // e.g. 2026
  currentWeek: number; // 1 - 32
  totalWeeks: number; // 32 weeks total (2 pre-season friendlies, 26 regular rounds, 4 playoff/cup rounds)
  phase: "pre_season" | "regular_season" | "playoffs" | "season_end";
  processedWeekKeys: string[]; // e.g. ["2026_w1", "2026_w2"] — CRITICAL: idempotent protection
}

export interface ManagerSettings {
  soundEnabled: boolean;
  autoSaveEnabled: boolean;
  currencySymbol: string;
  matchSimulationSpeed: "instant" | "normal" | "detailed";
}

export interface ManagerState {
  version: number;
  manager: ManagerProfile;
  calendar: ManagerCalendar;
  clubs: Record<string, ManagerClub>;
  players: Record<string, ManagerPlayer>;
  competitions: Record<CompetitionId, ManagerCompetition>;
  transfers: {
    listedPlayerIds: string[];
    activeBids: TransferBid[];
    completedTransfers: CompletedTransfer[];
    activeLoans: ActiveLoan[];
  };
  inbox: {
    messages: InboxMessage[];
    unreadCount: number;
  };
  settings: ManagerSettings;
}
