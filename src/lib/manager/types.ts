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
  | "key-player"
  | "first-team"
  | "rotation"
  | "squad-depth"
  | "reserve";

export type ContractStatus =
  | "expires_this_season"
  | "one_year_left"
  | "long_term"
  | "wants_renewal"
  | "unhappy"
  | "renewed"
  | "leaving"
  | "on_loan";

export type ManagerCompetition =
  | "league"
  | "challenge_cup"
  | "friendly"
  | "playoffs"
  | "championship_playoffs"
  | "million_pound_game"
  | "world_club_challenge";

/** Division the manager career is competing in. */
/**
 * Competition the user is managing in.
 * When adding a league: extend this union, then register it in `managerLeagues.ts`
 * and follow `.cursor/rules/manager-leagues.mdc`.
 */
export type ManagerCompetitionId = "super-league" | "championship";

export type CupRoundKey =
  | "round_one"
  | "round_two"
  | "last_sixteen"
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
  /**
   * Temporary loan placement at this club — not a permanent signing.
   * Never generates renewals / contract-expiry reminders.
   */
  isLoanPlacement?: boolean;
  /** Player plans to hang up their boots at the end of this season. */
  retiringAtSeasonEnd?: boolean;
  /** Season when retirement intent was last evaluated. */
  retirementIntentSeason?: number;
  /** One-time convince-to-stay attempt used (accepted or refused). */
  convincedToStayUsed?: boolean;
  /** Retire when the current deal ends (after a convince-to-stay extension). */
  retireAfterContract?: boolean;
}

export interface ManagerTactics {
  playingStyle: PlayingStyle;
  attackFocus: AttackFocus;
  defenceFocus: DefenceFocus;
}

export interface ActiveLoan {
  playerId: string;
  parentClub: string; // owning club name
  loaneeClub: string; // club currently using player
  /** Absolute game week when loan ends (or season-end handled separately) */
  endsAtSeasonYear: number; // return at advanceToNextSeason for this year
  parentWageShare: number; // 0-1 portion parent still pays
  canRecall: boolean;
  originalContract: PlayerContract;
  /** Fee paid by loanee club (small) */
  loanFee: number;
}

export type MatchPlayerRole =
  | "default"
  | "primary_creator"
  | "crash_ball"
  | "spread"
  | "target"
  | "organizer";

export interface FixtureGameplan {
  fixtureId: string;
  tactics: ManagerTactics;
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

/** Matchday availability — Fitness removed; injuries/suspensions remain. */
export type ManagerPlayerAvailability =
  | "available"
  | "injured"
  | "suspended"
  | "ineligible"
  | "not-registered";

export interface ManagerPlayerState {
  playerId: string;
  form: number;
  /** @deprecated Fitness removed — ignored on hydrate. */
  fitness?: number;
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
  /** Rating when the player joined the reserve squad (lifetime growth baseline). */
  signedRating?: number;
  /** Season year when the player joined the reserve listing. */
  signedSeasonYear?: number;
  /** Completed seasons at the club since signing (updated at season end). */
  yearsAtClub?: number;
  potentialRating: number;
  developmentRate: number;
  form: number;
  /** @deprecated Fitness removed — ignored on hydrate. */
  fitness?: number;
  reserveAppearances: number;
  reserveTries: number;
  calledUpForNextMatch: boolean;
  /** Flagged by staff for bulk release tools. */
  markedForRelease?: boolean;
  /** Stamped when the player was created by the reserve generator. */
  ratingGeneration?: {
    source: "generated-reserve";
    generatorVersion: number;
    baseRating: number;
    developmentModifier: number;
  };
  /** Pending full-time senior contract offer while still in reserves. */
  pendingFullTimeOffer?: {
    wagePerYear: number;
    years: number;
    offeredAtSeasonYear: number;
    status: "pending" | "accepted" | "rejected";
  };
}

export interface ReserveFixtureResult {
  round: number;
  opponent: string;
  opponentClub: string;
  userScore: number;
  oppScore: number;
  userWon: boolean;
  /** Match finished level — reserve fixtures permit regulation draws. */
  isDraw?: boolean;
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
  /** Running sum of match ratings (for average). */
  ratingSum?: number;
  /** Individual match ratings out of 10. */
  matchRatings?: number[];
  /** Average match rating out of 10. */
  averageRating?: number;
}

export interface ManagerTeamSeasonStats {
  played: number;
  wins: number;
  losses: number;
  /** Regulation draws (league / friendly / reserve / championship permit ties). */
  draws: number;
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
  /** @deprecated Fan Mood removed — ignored on hydrate. */
  fanMood?: number;
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
  /** Regulation draws (Super League / Championship both permit ties). */
  draws: number;
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
  /** @deprecated Fan Mood removed — ignored when present on legacy saves. */
  fanMoodChange?: number;
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

export type MatchEventPeriod = "first_half" | "second_half" | "golden_point";

export interface LiveMatchEvent {
  id?: string;
  minute: number;
  /** Optional period tag for UI / sorting; consumers may ignore. */
  period?: MatchEventPeriod;
  type:
    | "try"
    | "goal"
    | "conversion"
    | "missed_conversion"
    | "penalty"
    | "penalty_goal"
    | "drop_goal"
    | "missed_drop_goal"
    | "big_break"
    | "line_break"
    | "try_saver"
    | "knock_on"
    | "forward_pass"
    | "six_again"
    | "goal_line_dropout"
    | "captains_challenge"
    | "sin_bin"
    | "injury"
    | "interchange"
    | "momentum_shift"
    | "pressure_set"
    | "last_tackle_kick"
    | "forty_twenty"
    | "forced_error"
    | "held_up"
    | "note"
    | "half_time"
    | "full_time";
  team: "user" | "opponent";
  teamId?: string;
  teamName?: string;
  opponentTeamId?: string;
  opponentTeamName?: string;
  /** Non-kicking player involved (try scorer, breaker, etc.). Never a team name. */
  playerName?: string;
  playerId?: string;
  /** Kicker only — never used as a try scorer. */
  kickerName?: string;
  kickerId?: string;
  description: string;
  points: number;
  importance?: "low" | "medium" | "high" | "major";
  possessionTeamId?: string;
  territory?: "own_end" | "middle" | "opposition_20" | "goal_line";
  relatedEventId?: string;
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

export type ManagerDepartureReason =
  | "sacked"
  | "resigned"
  | "club-change"
  | "season_complete"
  | "user_choice";

export interface ManagerCareerHistoryEntry {
  id: string;
  clubId: string;
  clubName: string;
  joinedSeason: number;
  joinedWeek: number;
  joinedDate: string;
  leftSeason?: number;
  leftWeek?: number;
  leftDate?: string;
  departureReason?: ManagerDepartureReason;
  boardExpectationAtJoin?: string;
  finalBoardConfidence?: number;
}

export type BoardObjectiveStatus = "achieved" | "failed" | "partial" | "na";

export interface BoardSeasonEvaluation {
  seasonId: string;
  clubId: string;
  managerId: string;
  objectiveResults: {
    id: string;
    label: string;
    status: BoardObjectiveStatus;
    weight: number;
  }[];
  boardConfidence: number;
  performanceScore: number;
  recommendation: "retain" | "sack";
  finalDecision: "retain" | "sack";
  protectedByNoSacking: boolean;
  explanation: string[];
  decisionId: string;
}

export interface ManagerBoostUsage {
  futureStarBySeason?: Record<string, boolean>;
  financialTakeoverBySeason?: Record<string, boolean>;
  trainingBoostPlayerIds?: string[];
  unlockedPotentialPlayerIds?: string[];
  selectionBoostsUsed?: number;
}

export interface ManagerProtection {
  noSacking: boolean;
  activatedByBoostId?: string;
  activatedAtSeason?: number;
}

export interface ManagerSeasonSummary {
  seasonYear: number;
  position: number;
  wins: number;
  losses: number;
  /** Regulation draws recorded this season. */
  draws?: number;
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
  /** @deprecated Fan Mood removed. */
  finalFanMood?: number;
  wageBill: number;
  expiringContracts: number;
  playersLeaving: string[];
  seasonVerdict: string;
  /** Short narrative label e.g. THE CUP RUN — derived from season events. */
  seasonNarrative?: string;
  millionPoundGameResult?: string;
  promotedVia?: "auto" | "million_pound_game";
  relegatedVia?: "auto" | "million_pound_game";
}

export interface MillionPoundGameState {
  seasonYear: number;
  slClub: string;
  champClub: string;
  homeClub: string;
  winner?: string;
  loser?: string;
  status: "pending" | "ready" | "complete";
  userParticipating: boolean;
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
  | "calendar"
  | "across-league"
  | "table"
  | "stats"
  | "settings"
  | "play-game"
  | "match-review"
  | "season-review"
  | "development-review"
  | "season-rewards"
  | "choose-next-club";

export type ManagerAutoRenewContractYears = 1 | 2 | 3 | 4;

/** @deprecated Ignored — mass release always ANDs enabled rules. Kept for migrate. */
export type MassReleaseMatchMode = "all" | "any";

/** Reserve Management rules — Auto Promote + mass-release (v2). */
export interface ManagerReserveDevelopmentSettings {
  reserveManagementSettingsVersion: number;
  /** Auto-promote reserves at/above rating when senior capacity allows. Off by default. */
  autoPromoteByRatingEnabled: boolean;
  autoPromoteRatingThreshold: number;
  /**
   * @deprecated Ignored on apply — mass release always requires every enabled
   * rule (AND / "all"). Optional so legacy saves still hydrate.
   */
  massReleaseMatchMode?: MassReleaseMatchMode;
  massReleaseByPotentialEnabled: boolean;
  massReleasePotentialBelow: number;
  massReleaseByRatingEnabled: boolean;
  massReleaseRatingBelow: number;
  massReleaseByAgeEnabled: boolean;
  massReleaseAgeAbove: number;
  /** Player ids excluded from mass release. */
  protectedFromMassReleaseIds: string[];
  minimumReserveSquadSize: number;

  // --- Legacy fields (ignored by v2 UI; kept for save migration) ---
  /** @deprecated */
  releaseAfterYearsEnabled?: boolean;
  /** @deprecated */
  releaseAfterYears?: number;
  /** @deprecated */
  releaseIfRatingBelow?: number;
  /** @deprecated */
  releaseIfGrowthBelowEnabled?: boolean;
  /** @deprecated */
  growthCheckAfterYears?: number;
  /** @deprecated */
  releaseIfGrowthBelow?: number;
  /** @deprecated */
  flagLowPotentialEnabled?: boolean;
  /** @deprecated */
  flagPotentialBelow?: number;
  /** @deprecated */
  flagForFullTimeEnabled?: boolean;
  /** @deprecated */
  fullTimeRatingThreshold?: number;
  /** @deprecated */
  protectUnderAge?: number;
  /** @deprecated */
  protectHighPotentialPlayers?: boolean;
  /** @deprecated */
  autoReleaseEnabled?: boolean;
}

/** @deprecated Prefer ManagerReserveDevelopmentSettings — kept for save migration. */
export type ManagerReserveReleaseSettings = ManagerReserveDevelopmentSettings;

export interface ManagerSettings {
  autoRenewContractYears: ManagerAutoRenewContractYears;
  autoFixSquadBeforeMatch: boolean;
  showAchievementPopups: boolean;
  /** @deprecated Prefer always-comfortable fixture density. */
  compactFixtureRows?: boolean;
  /** @deprecated Removed — was a UI workaround for hub navigation. */
  autoOpenNextFixture?: boolean;
  /** @deprecated WCC write-ups stay collapsed by default. */
  wccWriteUpExpandedByDefault?: boolean;
  /** Ask before simulating from the hub. */
  confirmBeforeSimulate: boolean;
  /** Highlight players with ≤1 year left on Contracts. */
  highlightExpiringContracts: boolean;
  reserveDevelopmentSettings: ManagerReserveDevelopmentSettings;
  /** Legacy key — mirrored from reserveDevelopmentSettings on hydrate. */
  reserveReleaseSettings?: ManagerReserveDevelopmentSettings;
}

export type LiveMatchPhase =
  | "preview"
  | "first_half"
  | "halftime"
  | "second_half"
  | "full_time";

export type TransferListingType = "permanent" | "loan" | "both";

export interface PlayerTransferStatus {
  listed: boolean;
  askingPrice: number;
  listedAtGameWeek: number;
  /**
   * permanent (default) — sale only;
   * loan — loan market only;
   * both — permanent or loan.
   */
  listingType?: TransferListingType;
  /** Player has asked to leave — not the same as listed. */
  transferRequested?: boolean;
}

export interface LeagueListedPlayer {
  playerId: string;
  club: string;
  askingPrice: number;
  listedAtWeek: number;
  listingType?: TransferListingType;
}

export type FreeAgentSource =
  | "released_by_club"
  | "unwanted_reserve"
  | "higher_club_depth"
  | "contract_expired"
  | "returning_player"
  | "trialist";

export interface FreeAgent {
  playerId: string;
  formerClub: string;
  sinceWeek: number;
  sinceSeason: number;
  source?: FreeAgentSource;
}

export interface LeagueTransferActivity {
  id: string;
  week: number;
  fromClub: string;
  toClub: string;
  playerId: string;
  playerName: string;
  fee: number;
  /** Which squad the player moved from — defaults to senior-squad style moves. */
  sourceSquad?: "senior" | "reserve" | "free-agent";
  /** Competition id the player moved from (e.g. "super-league", "championship"). */
  fromCompetitionId?: string;
  /** Competition id the player moved to. */
  toCompetitionId?: string;
  transferType?: "permanent" | "free" | "loan";
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

export interface ScheduledFriendly {
  club: string;
  year: string;
  displayName: string;
  teamRating: number;
  isHome: boolean;
  friendlyIndex: number;
}

export interface PreSeasonState {
  friendliesPlayed: number;
  /** Required pre-season friendlies per season (schema v2 = 3). */
  friendliesRequired?: number;
  awaitingChoice: boolean;
  currentChoices: FriendlyOpponentChoice[];
  /** Ordered picks before schedule confirmation. */
  draftSchedule?: ScheduledFriendly[];
  /** Confirmed schedule played in order. */
  confirmedSchedule?: ScheduledFriendly[];
  awaitingScheduleConfirm?: boolean;
  friendlyScheduleVersion?: number;
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
  | "loan_ended"
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
  /** Display sender — Board mail always uses "Board". */
  sender?: string;
  /** Stable event id linking popups to the same inbox record (defaults to id). */
  eventId?: string;
  /** Optional deadline label (e.g. season end, next review). */
  deadlineLabel?: string;
  /** Optional required action for the manager. */
  requiredAction?: string;
  playerId?: string;
  playerName?: string;
  offerClub?: string;
  offerAmount?: number;
  askingPrice?: number;
  /** Unsolicited bid for an unlisted player — surfaced as a post-match popup. */
  unsolicited?: boolean;
  /** Championship-club bid for a reserve-squad player (accept moves them out of reserves). */
  reserveOffer?: boolean;
  /** Championship club requesting a season loan (not a permanent sale). */
  loanOffer?: boolean;
  /** Parent club wage share (0–1) proposed on a loanOffer. */
  loanParentWageShare?: number;
  /**
   * Market pool this offer belongs to. Senior approaches never share a season
   * budget with reserve / Championship bids.
   */
  offerCategory?: TransferOfferCategory;
  /** Dual-position retraining completion — surfaced as a post-match popup. */
  retrainingFrom?: import("../types").Position;
  retrainingTo?: import("../types").Position;
}

/** Senior vs reserve transfer-offer market pools. */
export type TransferOfferCategory =
  | "senior-first-team"
  | "senior-rotation"
  | "senior-listed"
  | "reserve";

/** Dev / tuning breadcrumb for a generated transfer approach. */
export type TransferOfferDiagnostic = {
  requestId: string;
  targetPlayerId: string;
  targetSquad: "senior" | "reserve";
  targetRole: string;
  buyingClubId: string;
  generatedWeek: number;
  generationPhase: "early-season" | "normal" | "window" | "expiry";
  countedAgainstCategory: string;
};

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

/** Persisted save-memory for Progress Week storytelling (inbox-backed). */
export type WorldStoryChainKind =
  | "transfer_interest"
  | "breakthrough"
  | "rivalry";

export interface WorldStoryChain {
  id: string;
  kind: WorldStoryChainKind;
  playerId?: string;
  clubId?: string;
  stage: number;
  lastWeek: number;
  seasonYear: number;
}

export interface ClubMoment {
  id: string;
  week: number;
  seasonYear: number;
  kind: string;
  title: string;
  body: string;
  playerId?: string;
}

export interface DevelopingRivalry {
  club: string;
  meetings: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface DepartedClubPlayerMemory {
  name: string;
  appearances: number;
  tries: number;
  seasons: number;
  leftSeasonYear: number;
  leftWeek: number;
}

export interface ManagerWorldStory {
  chains: WorldStoryChain[];
  shownMilestoneIds: string[];
  moments: ClubMoment[];
  departedPlayers: Record<string, DepartedClubPlayerMemory>;
  developingRivalries: DevelopingRivalry[];
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

export interface WorldClubChallengeFixture {
  id: string;
  seasonYear: number;
  gameWeek: 3;
  superLeagueChampionTeamId: string;
  superLeagueChampionName: string;
  nrlChampionName: string;
  /** Stable NRL club id from data/nrl-clubs.json — set for new fixtures. */
  nrlChampionId?: string;
  nrlChampionRating: number;
  status: "scheduled" | "complete";
  userInvolved: boolean;
}

export interface WorldClubChallengeResult {
  id: string;
  seasonYear: number;
  superLeagueChampionName: string;
  nrlChampionName: string;
  homeScore: number;
  awayScore: number;
  winnerName: string;
  userResult?: "won" | "lost" | "not_involved";
  events: LiveMatchEvent[];
  storySummary: string;
}

export interface WorldClubChallengeState {
  history: WorldClubChallengeResult[];
  currentFixture?: WorldClubChallengeFixture;
}

export interface ManagerCareer {
  id: string;
  club: string;
  /** Division the user is competing in this season. */
  userCompetitionId?: ManagerCompetitionId;
  /** Super League membership for this save (14 clubs; mutates on prom/rel). */
  superLeagueClubNames?: string[];
  /** Championship membership for this save (20 clubs; mutates on prom/rel). */
  championshipClubNames?: string[];
  /**
   * Membership for future leagues beyond SL/Champ.
   * Use getCareerClubsForLeague / setCareerClubsForLeague — do not read ad hoc.
   */
  leagueMembershipById?: Partial<Record<ManagerCompetitionId, string[]>>;
  seasonYear: number;
  seed: string;
  budget: number;
  clubFundsEarned: number;
  boardConfidence: number;
  boardExpectation: string;
  /** Active club prestige tier for the current competition (1–5 SL / 1–3 Champ). */
  difficulty: number;
  /**
   * Prestige while in Super League (1–5). Kept across relegation so a return
   * to SL can resume from prior SL status; promotion seeds this at 1★.
   */
  superLeagueDifficulty?: number;
  /**
   * Prestige while in the Championship (1–3). Kept across promotion so a
   * return to the Championship can resume from prior Champ status.
   */
  championshipDifficulty?: number;
  /** Momentum toward the next star change (-1..1 between shifts). */
  prestigeMomentum?: number;
  tactics: ManagerTactics;
  /** Optional per-player match roles for the matchday XIII. */
  matchPlayerRoles?: Record<string, MatchPlayerRole>;
  /** One-match tactics override for the next fixture only. */
  nextMatchGameplan?: FixtureGameplan | null;
  /** Active temporary loans (in or out). */
  activeLoans?: ActiveLoan[];
  /**
   * Idempotency ledger for completed transfer transactions.
   * Prevents double-apply across Advance Week / sim-to-date / double clicks.
   */
  processedTransferTxIds?: string[];
  squad: ManagerPlayerState[];
  contracts: Record<string, PlayerContract>;
  wageBudget: number;
  wageBill: number;
  attendanceData: ClubAttendanceData;
  clubFacilities?: ClubFacilities;
  gateIncomeHistory: GateIncomeRecord[];
  challengeCup: ChallengeCupBracketState;
  playoffs?: PlayoffBracketState;
  /** Championship positions 2–5 promotion play-offs (separate from SL playoffs). */
  championshipPlayoffs?: PlayoffBracketState;
  millionPoundGame?: MillionPoundGameState;
  championshipPlayoffsIntroAcknowledged?: boolean;
  /** User has seen the play-offs intro and can play bracket matches. */
  playoffsIntroAcknowledged?: boolean;
  /** Title celebration shown for the completed season (Super League Champions). */
  trophyCelebrationShown?: boolean;
  /** League Leaders celebration shown after the regular season (table winners). */
  leagueWinnersCelebrationShown?: boolean;
  /** Championship promotion celebration shown (automatic or Million Pound Game). */
  promotionCelebrationShown?: boolean;
  /** Perfect 27-0 league season celebration shown. */
  perfectSeasonCelebrationShown?: boolean;
  /** Winless 0-27 league season celebration shown. */
  winlessSeasonCelebrationShown?: boolean;
  /** Lifetime stats already credited for this season's league table finish. */
  leaguePhaseStatsRecordedForYear?: number | null;
  /** Lifetime stats already credited for this season's complete (playoffs/cup). */
  seasonCompleteStatsRecordedForYear?: number | null;
  /** Challenge Cup win celebration shown after lifting the cup. */
  challengeCupCelebrationShown?: boolean;
  /** World Club Challenge win celebration shown after lifting the trophy. */
  worldClubChallengeCelebrationShown?: boolean;
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
  /**
   * Match Week gate: ready_to_play | awaiting_advance | season_complete.
   * After a fixture the career waits for Advance Week (Season Progress) before weekly systems run.
   */
  matchWeekPhase?: import("./managerMatchWeek").MatchWeekPhase;
  /** Stable id of the completed fixture awaiting week processing. */
  pendingMatchWeekId?: string | null;
  /** Last week id that finished processing — blocks duplicate Advances. */
  lastProcessedMatchWeekId?: string | null;
  /** Inbox / popup event ids waiting to be shown after Advance Week. */
  pendingManagerEventIds?: string[];
  /** Event ids already acknowledged this career (dedupe across refresh). */
  acknowledgedManagerEventIds?: string[];
  leagueTable: ManagerLeagueRow[];
  transferMarket: string[];
  /** Player ids the user is watching on the transfer market. */
  transferWatchlistIds?: string[];
  leagueListedPlayers: LeagueListedPlayer[];
  freeAgents?: FreeAgent[];
  playerTransferStatus: Record<string, PlayerTransferStatus>;
  inboxMessages: InboxMessage[];
  clubFunds: Record<string, number>;
  wins: number;
  losses: number;
  /** Regulation draws recorded this season (league permits ties). */
  draws?: number;
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
  /**
   * Full reserve lists for clubs the user has managed (and snapshot on leave).
   * Used so club changes continue the same world instead of regenerating opening reserves.
   */
  leagueClubReserves?: Record<string, ManagerReservePlayer[]>;
  /** Reserve squad headcount per club — used for walkovers across the save. */
  leagueClubReserveCounts?: Record<string, number>;
  /** Club appearances/tries accumulated across seasons in this save. */
  clubCareerTotals?: Record<string, ClubCareerTotals>;
  /**
   * Progress Week storytelling memory — chains, milestones, rivalries, former players.
   * Story popups persist as inbox `news` with id prefix `story-`.
   */
  worldStory?: ManagerWorldStory;
  retiredPlayers?: RetiredPlayer[];
  /** Save schema version for migrations. */
  saveVersion?: number;
  /** Fan Mood + Fitness removal marker. */
  simplifiedPlayerSystemsVersion?: number;
  /** Persistence backend marker (2 = IndexedDB blobs + localStorage pointer). */
  saveStorageVersion?: number;
  /** Player ability scale migration (5 = reserve floor + Current 90+ audit). */
  playerRatingSchemaVersion?: number;
  /** Reserve generator band version (5 = 65–82 retuned mean ~70). */
  reserveGeneratorVersion?: number;
  /** Championship-only rating scale correction (2 = post mistaken floor-80 remap). */
  championshipRatingScaleVersion?: number;
  /** First-season Championship balance (3 = generated max 83, remap >80). */
  championshipFirstSeasonBalanceVersion?: number;
  /** Reserve rating scale after mistaken floor-80 clamp (2 = age/potential remap). */
  reserveRatingScaleVersion?: number;
  /** Player Showcase route/filter compatibility marker. */
  playerShowcaseVersion?: number;
  /** Historic age provenance/data compatibility marker. */
  historicAgeDataVersion?: number;
  /** Squad role union migration (key-player / first-team / etc.). */
  squadRoleSchemaVersion?: number;
  /** Current Super League 90+ ability audit application marker. */
  currentNinetyPlusAuditVersion?: number;
  /** Club reputation stars schema (see data/club-reputation.ts). */
  clubReputationSchemaVersion?: number;
  /** World Club Challenge season-one eligibility repair marker. */
  initialWCCEligibilityVersion?: number;
  /** Club Office manager boosts hub available (1 = Boosts section live). */
  managerBoostHubVersion?: number;
  /** Generated Championship squads (500 players) — persisted once per career. */
  championshipSquads?: import("./championship/championshipSquads").ChampionshipSquadState;
  /** Simulated Championship league competition. */
  championshipCompetition?: import("./championship/championshipLeague").ChampionshipCompetitionState;
  /** Parallel AI Super League table when the user manages in the Championship. */
  aiSuperLeagueStandings?: ManagerLeagueRow[];
  aiSuperLeagueRoundMatches?: ManagerRoundMatch[];
  aiSuperLeagueLastRound?: number;
  /** Schema markers for Championship / expanded cup migrations. */
  challengeCupSchemaVersion?: number;
  /** Round-label migration version (legacy string → CupRoundKey). */
  challengeCupRoundSchemaVersion?: number;
  generatedChampionshipSquadsVersion?: number;
  championshipCompetitionVersion?: number;
  aiChampionshipTransferVersion?: number;
  /** Elite Championship → Super League AI transfers this season. */
  championshipToSlTransfersThisSeason?: number;
  /** Player IDs recently rejected / cooled down for AI Champ→SL interest. */
  championshipTransferCooldowns?: Record<string, number>;
  /** Schema marker for the centralised AI transfer-activity tuning (transferActivityConfig.ts). */
  aiTransferActivityVersion?: number;
  /**
   * Loan market: free loans + Championship club listings + young/surplus bias.
   * Bump to regenerate leagueListedPlayers on hydrate.
   */
  loanMarketVersion?: number;
  /** Rebalanced recruitment target pools and seasonal approach pacing. */
  transferTargetBalanceVersion?: number;
  /** Last gameWeek that ran senior transfer-offer generators (dedupe cup/league). */
  lastTransferScanGameWeek?: number;
  /** Pending inbox offers tagged with offerCategory (2 = senior/reserve split). */
  transferOfferCategoryVersion?: number;
  /** Recent transfer-offer diagnostics (capped; also console.debug in development). */
  transferOfferDiagnostics?: TransferOfferDiagnostic[];
  /** Week through which a player is protected from repeat senior approaches. */
  transferTargetCooldowns?: Record<string, number>;
  /** Week through which a buying club is held out of senior approaches. */
  transferTargetClubCooldowns?: Record<string, number>;
  /** Future Star reveal popups already acknowledged (by reserve player id). */
  futureStarRevealAckByPlayerId?: Record<string, boolean>;
  /** Reserve player id waiting for the Future Star reveal modal. */
  pendingFutureStarRevealPlayerId?: string | null;
  /** Reserves screen should open this player on next visit. */
  focusReservePlayerId?: string | null;
  /** Completed transfer records include competition IDs + sourceSquad. */
  completedTransferRecordVersion?: number;
  /** Explicit match resolution rules (draws vs knockout extra-time). */
  matchResolutionRulesVersion?: number;
  /** Shared Manager Mode alignment / centering layout tokens. */
  managerAlignmentSystemVersion?: number;
  /** Schema marker for Championship clubs bidding on Super League reserve players. */
  reserveToChampionshipTransfersVersion?: number;
  /** Reserve player IDs recently rejected / cooled down for Championship interest. */
  reserveToChampionshipCooldowns?: Record<string, number>;
  /** Championship club IDs held out after making a reserve request. */
  reserveToChampionshipClubCooldowns?: Record<string, number>;
  /** Reserve requests made by each Championship club in the current season. */
  reserveToChampionshipClubRequestCounts?: Record<string, number>;
  /** Reserve → Championship signings completed this season (across all Championship clubs). */
  championshipReserveSigningsThisSeason?: number;
  /** World Club Challenge fixture + history (from season 2 onwards). */
  worldClubChallenge?: WorldClubChallengeState;
  /** Club that won Super League last season — drives WCC scheduling. */
  previousSeasonChampion?: string | null;
  /**
   * Prior season Super League table (position 1 = top) for Challenge Cup seeding.
   * Updated on season advance.
   */
  previousSeasonLeagueTable?: { team: string; position: number }[];
  /**
   * Prior season Championship table for Challenge Cup Round One seeding.
   */
  previousSeasonChampionshipTable?: { team: string; position: number }[];
  /** Per-save manager preferences. */
  managerSettings?: ManagerSettings;
  /** Board cannot sack the manager while active (No Sacking boost). */
  managerProtection?: ManagerProtection;
  /** Latest end-of-season board evaluation. */
  boardSeasonEvaluation?: BoardSeasonEvaluation;
  /** Persisted board evaluations keyed by season id — avoids re-roll on refresh. */
  boardSeasonEvaluations?: Record<string, BoardSeasonEvaluation>;
  /** Manager tenure history across clubs in this save. */
  managerCareerHistory?: ManagerCareerHistoryEntry[];
  /** Club the user controls (may differ from `club` after future features). */
  userControlledClubId?: string;
  /** Stable manager identity within the save. */
  managerId?: string;
  /** World/save identity for boost usage tracking. */
  worldSaveId?: string;
  boostUsage?: ManagerBoostUsage;
  /** Board sacking evaluation schema version. */
  boardSackingSchemaVersion?: number;
  /** Manager world / career-history schema version. */
  managerCareerWorldSchemaVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerLifetimeStats {
  careersStarted: number;
  seasonsCompleted: number;
  wins: number;
  losses: number;
  trophies: number;
  /** Super League regular-season League Leaders (table 1st). */
  leagueTitles: number;
  /** Championship regular-season League Leaders (table 1st). */
  championshipTitles: number;
  /** Super League Grand Final winners. */
  superLeagueTitles: number;
  challengeCups: number;
  cupFinals: number;
  worldClubChallengeWins: number;
  worldClubChallengeAppearances: number;
  topSixFinishes: number;
  perfectSeasons: number;
  winlessSeasons: number;
  bestFinish: number | null;
  worstRecordWins: number | null;
  worstRecordLosses: number | null;
  /** Best single-season league W-L (not career totals). */
  bestRecordWins: number | null;
  bestRecordLosses: number | null;
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

export const DEFAULT_RESERVE_DEVELOPMENT_SETTINGS: ManagerReserveDevelopmentSettings =
  {
    reserveManagementSettingsVersion: 3,
    autoPromoteByRatingEnabled: false,
    autoPromoteRatingThreshold: 85,
    massReleaseMatchMode: "all",
    massReleaseByPotentialEnabled: false,
    massReleasePotentialBelow: 80,
    massReleaseByRatingEnabled: false,
    massReleaseRatingBelow: 78,
    massReleaseByAgeEnabled: false,
    massReleaseAgeAbove: 23,
    protectedFromMassReleaseIds: [],
    minimumReserveSquadSize: 22,
  };

/** @deprecated Use DEFAULT_RESERVE_DEVELOPMENT_SETTINGS */
export const DEFAULT_RESERVE_RELEASE_SETTINGS =
  DEFAULT_RESERVE_DEVELOPMENT_SETTINGS;

export const DEFAULT_MANAGER_SETTINGS: ManagerSettings = {
  autoRenewContractYears: 2,
  autoFixSquadBeforeMatch: false,
  showAchievementPopups: true,
  confirmBeforeSimulate: false,
  highlightExpiringContracts: true,
  reserveDevelopmentSettings: { ...DEFAULT_RESERVE_DEVELOPMENT_SETTINGS },
  reserveReleaseSettings: { ...DEFAULT_RESERVE_DEVELOPMENT_SETTINGS },
};

export const MANAGER_SEASON_GAMES = 27;

export const CUP_ROUND_LABELS: Record<CupRoundKey, string> = {
  round_one: "Challenge Cup Round One",
  round_two: "Challenge Cup Round Two",
  last_sixteen: "Challenge Cup Last 16",
  quarter_final: "Challenge Cup Quarter-Final",
  semi_final: "Challenge Cup Semi-Final",
  final: "Challenge Cup Final",
};
