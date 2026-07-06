/** Squad slot positions — all in-game assignments resolve to one of these */
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

/**
 * Raw position values accepted in data/*.json.
 * "Utility" is mapped to the nearest game position at load time.
 */
export type RawPositionInput = Position | "Utility" | "UTILITY" | "utility";

/** Optional explicit mapping when position is Utility */
export type UtilityPositionHint = {
  primaryPosition?: Position;
};

export type PlayerCategory = "current" | "historic" | "legend";

export type PlayerCardStatus = "Current" | "Historic" | "Legend";

export type GameMode = "CLASSIC" | "DRAFT" | "FANTASY";

/** Normal Mode spin variant — persisted on runs, stats, and leaderboard rows. */
export type ModeVariant = "current" | "era";

export type GameDifficulty = "NORMAL" | "HARD";

export type RunStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export type LeaderboardPeriod = "WEEKLY" | "MONTHLY" | "ALL_TIME";

export interface PlayerAchievements {
  /** @deprecated Hidden from UI — kept for legacy data only */
  clubLegend?: boolean;
  /** @deprecated MoS years come from data/man-of-steel-winners.json */
  manOfSteel?: boolean;
  challengeCupWinner?: boolean;
  superLeagueWinner?: boolean;
  /** @deprecated Use data/lance-todd-winners.json */
  lanceToddTrophy?: boolean;
  /** Populated at load from data/dream-team-years.json */
  dreamTeamYears?: number[];
  /** Populated at load from data/golden-boot-years.json */
  goldenBootYears?: number[];
}

export interface Player extends PlayerAchievements {
  id: string;
  /** Base slug when this row is a year card (e.g. sam-burgess for sam-burgess-2009). */
  baseId?: string;
  /** Grouping id for the same real-world player across year cards. */
  basePlayerId?: string;
  name: string;
  /** Canonical club on this year card — same as club/displayClub. */
  team?: string;
  club: string;
  /** UI club label for this card. */
  displayClub?: string;
  /** Card year — every gameplay card must be pinned to one season. */
  year?: number;
  /** Exact roster pool key, e.g. bradford-bulls-2006. */
  teamYearId?: string;
  /** Card status for showcase/filtering. */
  status?: PlayerCardStatus;
  /** Primary squad position abbreviation source (HK, FB, etc.) when stored in data. */
  primaryPosition?: string;
  /** Original database club — preserved when runClub overrides display. */
  baseClub?: string;
  /** Era team display name for the active run, e.g. Bradford Bulls '03. */
  runClub?: string;
  /** Resolved squad position (Utility players are mapped here) */
  position: Position;
  /** All positions this player may fill (dual-role current squads). */
  positions?: Position[];
  /** Set when loaded from a Utility raw position, e.g. "Utility" */
  originalPosition?: string;
  /** True when position was inferred from a Utility raw value */
  mappedFromUtility?: boolean;
  nationality: string;
  yearsActive: string;
  /** Peak-era year shown on historic/legend cards — omitted for current players. */
  primeYear?: number;
  /** ISO or DD/MM/YYYY date of birth when known. */
  dateOfBirth?: string;
  /** Birth year — used for age when full DOB is unavailable. */
  birthYear?: number;
  /** Era-specific year for historic cards (e.g. era challenge cup). */
  eraYear?: number;
  /** Year encoded on year-card ids (e.g. sam-burgess-2009 → 2009). */
  cardYear?: number;
  category: PlayerCategory;
  peakRating: number;
  value: number;
  appearances?: number;
  tries?: number;
  intlCaps: number;
  /** When false, excluded from recruitment, showcase, and selectable pools. */
  availableInGame?: boolean;
  /** When false, hidden from Super League gameplay pools (pre-1996-only careers). */
  superLeagueEligible?: boolean;
}

export interface SquadSlot {
  position: Position;
  slotIndex: number;
  label: string;
  player: Player | null;
  /** Run-only OVR penalty when placed out of position (draft mode). */
  runRatingPenalty?: number;
}

export type GamePhase =
  | "pitch"
  | "reveal"
  | "choice"
  | "placement"
  | "simulation"
  | "review";

export interface RunState {
  id: string;
  mode: GameMode;
  /** Normal Mode variant at run start — defaults to current when omitted. */
  modeVariant?: ModeVariant;
  status: RunStatus;
  currentPlayer: Player | null;
  currentIndex: number;
  totalOffers: number;
  squad: SquadSlot[];
  totalValue: number;
  filledCount: number;
  totalSlots: number;
  canSign: boolean;
  seed: string;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  squadValue: number;
  achievedAt: string;
  difficulty: GameDifficulty;
  isCurrentUser?: boolean;
}

export interface UserStatsData {
  totalRuns: number;
  highestSquadValue: number;
  lowestSquadValue: number | null;
  averageSquadValue: number;
  bestPositionFilled: string | null;
  bestPositionValue: number;
  weeklyBest: number;
  monthlyBest: number;
  mostValuablePlayerEverPulled: string | null;
  mostValuablePlayerEverPulledVal: number;
  bestBradfordSquad: number;
  bestWiganSquad: number;
  bestLeedsSquad: number;
  bestStHelensSquad: number;
  bestHistoricSquad: number;
  totalSeasonsSimulated: number;
  /** @deprecated Use seasonWins — kept for legacy localStorage migration */
  totalWins: number;
  /** @deprecated Use seasonLosses — kept for legacy localStorage migration */
  totalLosses: number;
  seasonWins: number;
  seasonLosses: number;
  bestRecordWins: number;
  bestRecordLosses: number;
  worstRecordWins: number;
  worstRecordLosses: number;
  longestUnbeatenRun: number;
  longestLosingStreak: number;
  leagueTitlesWon: number;
  totalPerfectSeasons: number;
  totalWinlessSeasons: number;
  bestNationalRanking: number | null;
  averageSeasonFinish: number;
  draftCounts: Record<string, number>;
  playerSeasonWins: Record<string, number>;
  playerSeasonLosses: Record<string, number>;
  /** Internal only — never displayed in public statistics UI */
  joeMellorRuns: number;
  /** Internal only — never displayed in public statistics UI */
  bestJoeMellorWins: number;
  /** Internal only — never displayed in public statistics UI */
  bestJoeMellorLosses: number;
  /** Internal only — never displayed in public statistics UI */
  joeMellorPerfectSeasons: number;
  totalRerollsUsed: number;
  mostRerollsInRun: number;
  averageRerollsPerRun: number;
  challengeCupRuns: number;
  challengeCupWins: number;
  challengeCupLosses: number;
  challengeCupsWon: number;
  challengeCupFinals: number;
  challengeCupSemiFinals: number;
  challengeCupQuarterFinals: number;
  bestCupFinish: string | null;
  bestCupNationalRanking: number | null;
  highestCupSquadRating: number | null;
  lowestCupSquadRating: number | null;
  longestCupMatchWinStreak: number;
  currentCupMatchWinStreak: number;
  longestTournamentWinsInRow: number;
  currentTournamentWinsInRow: number;
  bestCupMatchWinsInTournament: number;
  /** Highest average squad rating across completed fantasy seasons. */
  bestTeamRating: number;
  /** Regular-season wins only (27-game campaign). */
  regularSeasonWins: number;
  /** Regular-season losses only. */
  regularSeasonLosses: number;
  /** Play-off match wins (knockout rounds). */
  playoffWins: number;
  /** Play-off match losses. */
  playoffLosses: number;
  topSixFinishes: number;
  playoffAppearances: number;
  playoffEliminatorWins: number;
  playoffSemiFinalWins: number;
  grandFinalAppearances: number;
  /** Super League titles won via Grand Final. */
  superLeagueTitles: number;
  bestOverallSeasonWins: number;
  bestOverallSeasonLosses: number;
}

export interface CupPersonalBests {
  mostCupMatchWins: number;
  bestTournamentFinish: string | null;
  longestCupWinningStreak: number;
  mostCupsWon: number;
  bestCupWinPercentage: number;
}

export interface CupRunRankingResult {
  cupWinsRank: number | null;
  newPersonalBests: string[];
  newRecords: string[];
}

export interface CompletedRunResult {
  runId: string;
  totalValue: number;
  squad: SquadSlot[];
  rank?: number;
}
