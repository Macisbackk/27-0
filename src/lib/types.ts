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

export type GameMode = "CLASSIC" | "CHALLENGE_CUP" | "DRAFT";

export type GameDifficulty = "NORMAL" | "HARD";

export type RunStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export type LeaderboardPeriod = "WEEKLY" | "MONTHLY" | "ALL_TIME";

export interface PlayerAchievements {
  hallOfFame?: boolean;
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
  name: string;
  club: string;
  /** Resolved squad position (Utility players are mapped here) */
  position: Position;
  /** Set when loaded from a Utility raw position, e.g. "Utility" */
  originalPosition?: string;
  /** True when position was inferred from a Utility raw value */
  mappedFromUtility?: boolean;
  nationality: string;
  yearsActive: string;
  category: PlayerCategory;
  peakRating: number;
  /** @deprecated use peakRating — kept for backward compatibility */
  rating: number;
  value: number;
  appearances?: number;
  tries?: number;
  intlCaps: number;
  /** When false, excluded from recruitment, showcase, and selectable pools. */
  availableInGame?: boolean;
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
  | "clubSelect"
  | "pitch"
  | "choice"
  | "placement"
  | "simulation"
  | "review";

export interface RunState {
  id: string;
  mode: GameMode;
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
