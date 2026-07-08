import type { Position } from "../types";
import type { MatchFixture } from "../game/season-simulation";
import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import type { PlayoffBracketState } from "../game/playoff-bracket";
import type { PlayoffFinish } from "../game/playoff-simulation";

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

export type ManagerCompetition = "league" | "challenge_cup" | "friendly" | "playoffs";

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
  /** Transfer fee paid when signing this player in the current save. */
  purchaseFee?: number;
  renewalDemand?: RenewalDemand;
  status?: ContractStatus;
  /** Player plans to hang up their boots at the end of this season. */
  retiringAtSeasonEnd?: boolean;
  /** Season when retirement intent was last evaluated. */
  retirementIntentSeason?: number;
  /** One-time convince-to-stay used — extra year at same wage, then retire. */
  convincedToStayUsed?: boolean;
  /** Retire when the current deal ends (after a convince-to-stay extension). */
  retireAfterContract?: boolean;
}

export interface ManagerTactics {
  playingStyle: PlayingStyle;
  attackFocus: AttackFocus;
  defenceFocus: DefenceFocus;
}

export interface TacticMatchReviewAdvice {
  headline: string;
  usedLabel: string;
  recommendations: string[];
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
  walkover?: boolean;
  walkoverReason?: string;
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
  /** Dynamic minimum gate — rises with sustained success, erodes when struggling. */
  attendanceFloor?: number;
}

export type FacilityType = "youth" | "training" | "stadium" | "commercial";

export interface ClubFacilities {
  youth: number;
  training: number;
  stadium: number;
  commercial: number;
}

export interface GateIncomeRecord {
  fixtureId: string;
  round: number;
  attendance: number;
  income: number;
  transferAllocation: number;
  operatingAllocation: number;
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
  playoffRound?: number;
  playoffMatchId?: string;
  label: string;
  isNeutral?: boolean;
  venue?: string;
  /** Bracket listing for neutral play-off fixtures (e.g. Grand Final). */
  listedHome?: string;
  listedAway?: string;
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
  transferAllocation: number;
  operatingAllocation: number;
  fanMoodChange: number;
  ticketPrice: number;
  venue?: string;
  /** Neutral Grand Final — crowd shown for flavour, no gate revenue to the club. */
  excludedFromClubFunds?: boolean;
}

export interface ManagerMatchMeta {
  tacticImpactLine?: string;
  tacticEffectivenessLine?: string;
  tacticReview?: TacticMatchReviewAdvice;
  injuries: { playerId: string; name: string; injury: ManagerInjury }[];
  playerOfMatchId?: string | null;
  playedLive?: boolean;
  attendance?: MatchAttendanceMeta;
  competition?: ManagerCompetition;
  cupRound?: CupRoundKey;
  liveEvents?: LiveMatchEvent[];
  /** Snapshot of matchday squad at kick-off for accurate match review. */
  matchdayXiii?: string[];
  matchdayInterchange?: string[];
  xiiiSlotPositions?: Position[];
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

export interface SeasonHighlightResult {
  opponent: string;
  pointsFor: number;
  pointsAgainst: number;
  margin: number;
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
  topTryScorerTries: number;
  challengeCupResult: string;
  playoffFinish?: PlayoffFinish | null;
  biggestWin: SeasonHighlightResult | null;
  biggestDefeat: SeasonHighlightResult | null;
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
  | "club"
  | "fixtures"
  | "across-league"
  | "table"
  | "stats"
  | "play-game"
  | "match-review"
  | "season-review"
  | "development-review"
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

export interface FreeAgent {
  playerId: string;
  formerClub: string;
  sinceWeek: number;
  sinceSeason: number;
}

export interface LeagueTransferActivity {
  id: string;
  week: number;
  fromClub: string;
  toClub: string;
  playerId: string;
  playerName: string;
  fee: number;
}

export interface FriendlyOpponentChoice {
  id: string;
  club: string;
  year: string;
  displayName: string;
  difficulty: "easy" | "balanced" | "hard";
  teamRating: number;
  attendanceInterest: "low" | "medium" | "high";
}

export interface PreSeasonState {
  friendliesPlayed: number;
  awaitingChoice: boolean;
  currentChoices: FriendlyOpponentChoice[];
  activeFriendly: {
    displayName: string;
    club: string;
    year: string;
    teamRating: number;
    isHome: boolean;
    friendlyIndex: number;
  } | null;
}

export interface ManagerFinance {
  transferBudget: number;
  operatingBalance: number;
  wageBudget: number;
  wageBill: number;
  clubFunds: number;
  seasonIncome: number;
  seasonTransferIncome: number;
  seasonOperatingIncome: number;
  seasonSpending: number;
}

export interface LatestNewsItem {
  id: string;
  week: number;
  type: "transfer" | "result" | "fixture" | "reserve" | "cup" | "board";
  text: string;
}

export type InboxMessageType =
  | "transfer"
  | "transfer_complete"
  | "transfer_offer_in"
  | "transfer_offer_out"
  | "contract"
  | "reserve_report"
  | "reserve_callup"
  | "reserve_return"
  | "sale"
  | "board"
  | "fixture"
  | "cup_draw"
  | "injury"
  | "release"
  | "season_reward"
  | "youth_intake"
  | "retirement"
  | "news"
  | "position_retraining_complete"
  | "general";

export interface InboxMessage {
  id: string;
  type: InboxMessageType;
  title: string;
  body: string;
  week: number;
  season: number;
  gameWeek: number;
  createdAt: string;
  read: boolean;
  resolved?: boolean;
  playerId?: string;
  playerName?: string;
  offerClub?: string;
  offerAmount?: number;
  askingPrice?: number;
  /** Unsolicited bid for an unlisted player — surfaced as a post-match popup. */
  unsolicited?: boolean;
  /** Dual-position retraining completion — surfaced as a post-match popup. */
  retrainingFrom?: import("../types").Position;
  retrainingTo?: import("../types").Position;
}

export interface RetiredPlayer {
  playerId: string;
  playerName: string;
  /** Club the player retired from (user squad or AI league club). */
  club?: string;
  position: import("../types").Position;
  positionLabel: string;
  age: number;
  peakRating: number;
  seasonRetired: number;
  clubAppearances: number;
  clubTries: number;
  seasonsAtClub: number;
}

export interface ClubCareerTotals {
  appearances: number;
  tries: number;
  seasons: number;
}

export type LiveMatchCommand =
  | "attack"
  | "defend"
  | "balanced"
  | "champagne";

export interface PlayerDevelopmentState {
  rating: number;
  peakRating: number;
  potential: number;
  /** Per-match growth pace carried over from the reserve squad. */
  developmentRate?: number;
  /** Squad rating at the start of the current season (for year-end review). */
  seasonStartRating?: number;
  /** Season year when this player was promoted from reserves on a full-time deal. */
  promotedSeasonYear?: number;
}

/** In-progress dual-position retraining for a first-team player. */
export interface PlayerPositionRetraining {
  fromPosition: Position;
  targetPosition: Position;
  weeksRemaining: number;
  totalWeeks: number;
  startedAtWeek: number;
  startedAtSeason: number;
}

export interface PlayerDevelopmentChange {
  playerId: string;
  playerName: string;
  before: number;
  after: number;
  potential: number;
  delta: number;
  seasonStartRating?: number;
  promotedFromReserve?: boolean;
  /** Season impact score (0–100) when development was calculated. */
  seasonImpact?: number;
}

export interface ManagerCareer {
  id: string;
  club: string;
  seasonYear: number;
  seed: string;
  budget: number;
  clubFundsEarned: number;
  boardConfidence: number;
  boardExpectation: string;
  /** Club prestige tier (1–5 stars). Rises or falls after sustained success or failure. */
  difficulty: number;
  /** Momentum toward the next star change (-1..1 between shifts). */
  prestigeMomentum?: number;
  tactics: ManagerTactics;
  squad: ManagerPlayerState[];
  contracts: Record<string, PlayerContract>;
  wageBudget: number;
  wageBill: number;
  attendanceData: ClubAttendanceData;
  clubFacilities?: ClubFacilities;
  gateIncomeHistory: GateIncomeRecord[];
  challengeCup: ChallengeCupBracketState;
  playoffs?: PlayoffBracketState;
  /** User has seen the play-offs intro and can play bracket matches. */
  playoffsIntroAcknowledged?: boolean;
  /** Title celebration shown for the completed season (Super League Champions). */
  trophyCelebrationShown?: boolean;
  /** League Leaders celebration shown after the regular season (table winners). */
  leagueWinnersCelebrationShown?: boolean;
  /** Perfect 27-0 league season celebration shown. */
  perfectSeasonCelebrationShown?: boolean;
  /** Winless 0-27 league season celebration shown. */
  winlessSeasonCelebrationShown?: boolean;
  /** Lifetime stats already credited for this season's league table finish. */
  leaguePhaseStatsRecordedForYear?: number | null;
  /** Challenge Cup win celebration shown after lifting the cup. */
  challengeCupCelebrationShown?: boolean;
  /** Last club star tier the rise celebration was shown for (1–5). */
  clubStarRiseCelebratedAt?: number;
  /** Previous star tier when a rise celebration is pending. */
  pendingClubStarRiseFrom?: number;
  /** Career-start board objectives popup dismissed. */
  objectivesIntroShown?: boolean;
  /** Consecutive weeks wage bill exceeded budget — triggers board pressure. */
  wagePressureWeeks?: number;
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
  freeAgents?: FreeAgent[];
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
  reserveContracts?: Record<string, PlayerContract>;
  youthProspects?: ManagerReservePlayer[];
  reserveResults: ReserveFixtureResult[];
  lastReserveResult: ReserveFixtureResult | null;
  calledUpReserveIds: string[];
  playerRegistry: Record<string, import("../types").Player>;
  hubResultsExpanded?: boolean;
  preSeason: PreSeasonState;
  managerFinance: ManagerFinance;
  latestNews: LatestNewsItem[];
  leagueTransfers: LeagueTransferActivity[];
  playerDevelopment?: Record<string, PlayerDevelopmentState>;
  /** Positions earned through retraining in this save. */
  playerLearnedPositions: Record<string, Position[]>;
  /** Active position retraining keyed by player id. */
  playerPositionRetraining: Record<string, PlayerPositionRetraining>;
  lastSeasonDevelopmentReview?: PlayerDevelopmentChange[];
  lastReserveReportWeek?: number;
  /** Per-club injury load for league sim fairness (AI clubs miss players too). */
  leagueClubStates?: Record<string, { injuriesOut: number }>;
  leagueClubStatesWeek?: number;
  /** Persisted AI club squads — transfers and youth intake update these each season. */
  leagueClubRosters?: Record<string, string[]>;
  /** Reserve squad headcount per club — used for walkovers across the save. */
  leagueClubReserveCounts?: Record<string, number>;
  /** Club appearances/tries accumulated across seasons in this save. */
  clubCareerTotals?: Record<string, ClubCareerTotals>;
  retiredPlayers?: RetiredPlayer[];
  /** Save schema version for migrations. */
  saveVersion?: number;
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
  superLeagueTitles: number;
  challengeCups: number;
  cupFinals: number;
  topSixFinishes: number;
  perfectSeasons: number;
  winlessSeasons: number;
  bestFinish: number | null;
  worstRecordWins: number | null;
  worstRecordLosses: number | null;
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
