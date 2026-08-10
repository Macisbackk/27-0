import { formatValue } from "./players";
import { formatRecordWithPercentage } from "./lifetime-stats";
import type { GameDifficulty, GameMode } from "./types";

export type LeaderboardTrackerType =
  | "perfect_runs"
  | "best_record"
  | "league_titles"
  | "super_league_champions"
  | "era_league_title"
  | "era_league_champions"
  | "daily_streak"
  | "manager_challenge_cups"
  | "manager_cup_finals"
  | "manager_league_titles"
  | "manager_seasons_completed"
  | "wcc_wins";

export type TrophyCabinetSection = "current" | "era";

export const MIN_GAMES_FOR_WIN_PERCENTAGE = 10;

/**
 * Public leaderboard tracker payload schema.
 * 5 = total_winnings / manager earnings boards removed; seasons_completed added.
 */
export const LEADERBOARD_SCHEMA_VERSION = 5;

export interface LeaderboardTrackerEntry {
  username: string;
  squadValue: number;
  achievedAt: string;
  difficulty: GameDifficulty;
  mode: GameMode;
  totalWins: number;
  totalLosses: number;
  perfectRuns: number;
  bestRecordWins: number;
  bestRecordLosses: number;
  bestWinPercentage: number;
  challengeCupWins: number;
  cupFinals: number;
  bestCupFinishRank: number;
  bestCupFinishLabel: string;
  cupWinPercentage: number;
  /** Manager Mode — regular-season league titles (1st in table). */
  leagueTitles: number;
  /** Manager Mode — play-off Super League championships. */
  superLeagueTitles: number;
  /** Manager Mode — World Club Challenge wins. */
  wccWins: number;
  /** Manager Mode — completed seasons (career longevity). */
  seasonsCompleted: number;
}

export interface LeaderboardTrackerRow {
  rank: number;
  username: string;
  statDisplay: string;
  achievedAt: string;
  difficulty: GameDifficulty;
  mode: GameMode;
  isCurrentUser?: boolean;
}

function roundLeaderboardCount(value: number | undefined | null): number {
  const n = value ?? 0;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Whole-number stats only — strips float drift from merged saves / cloud rows. */
export function sanitizeLeaderboardTrackerEntry(
  entry: LeaderboardTrackerEntry
): LeaderboardTrackerEntry {
  return {
    ...entry,
    squadValue: roundLeaderboardCount(entry.squadValue),
    totalWins: roundLeaderboardCount(entry.totalWins),
    totalLosses: roundLeaderboardCount(entry.totalLosses),
    perfectRuns: roundLeaderboardCount(entry.perfectRuns),
    bestRecordWins: roundLeaderboardCount(entry.bestRecordWins),
    bestRecordLosses: roundLeaderboardCount(entry.bestRecordLosses),
    bestWinPercentage: roundLeaderboardCount(entry.bestWinPercentage),
    challengeCupWins: roundLeaderboardCount(entry.challengeCupWins),
    cupFinals: roundLeaderboardCount(entry.cupFinals),
    bestCupFinishRank: roundLeaderboardCount(entry.bestCupFinishRank),
    cupWinPercentage: roundLeaderboardCount(entry.cupWinPercentage),
    leagueTitles: roundLeaderboardCount(entry.leagueTitles),
    superLeagueTitles: roundLeaderboardCount(entry.superLeagueTitles),
    wccWins: roundLeaderboardCount(entry.wccWins),
    seasonsCompleted: roundLeaderboardCount(entry.seasonsCompleted),
  };
}

export const TROPHY_CABINET_SECTIONS: {
  id: TrophyCabinetSection;
  label: string;
  trackerIds: LeaderboardTrackerType[];
}[] = [
  {
    id: "current",
    label: "Quick Mode",
    trackerIds: [
      "league_titles",
      "super_league_champions",
    ],
  },
  {
    id: "era",
    label: "Era Mode",
    trackerIds: [
      "era_league_title",
      "era_league_champions",
    ],
  },
];

export const LEADERBOARD_TRACKERS: {
  id: LeaderboardTrackerType;
  label: string;
  shortLabel: string;
  cupOnly?: boolean;
  clubFundsOnly?: boolean;
  dailyOnly?: boolean;
  trophyCabinetOnly?: boolean;
  managerSuperLeagueOnly?: boolean;
  managerChallengeCupOnly?: boolean;
  trophySection?: TrophyCabinetSection;
}[] = [
  { id: "best_record", label: "Best Season Record", shortLabel: "Best Record" },
  {
    id: "perfect_runs",
    label: "Most 27-0 Seasons",
    shortLabel: "27-0 Seasons",
  },
  {
    id: "wcc_wins",
    label: "WCC Wins",
    shortLabel: "WCC Wins",
    managerSuperLeagueOnly: true,
  },
  {
    id: "league_titles",
    label: "League Titles",
    shortLabel: "League Titles",
    trophyCabinetOnly: true,
    trophySection: "current",
  },
  {
    id: "super_league_champions",
    label: "Super League Champions",
    shortLabel: "SL Champions",
    trophyCabinetOnly: true,
    trophySection: "current",
  },
  {
    id: "era_league_title",
    label: "Era League Titles",
    shortLabel: "Era League",
    trophyCabinetOnly: true,
    trophySection: "era",
  },
  {
    id: "era_league_champions",
    label: "Era League Champions",
    shortLabel: "Era Champions",
    trophyCabinetOnly: true,
    trophySection: "era",
  },
  {
    id: "daily_streak",
    label: "Best Daily Streak",
    shortLabel: "Best Streak",
    dailyOnly: true,
  },
  {
    id: "manager_league_titles",
    label: "League Titles Won",
    shortLabel: "League Titles",
    managerSuperLeagueOnly: true,
  },
  {
    id: "manager_seasons_completed",
    label: "Seasons Completed",
    shortLabel: "Seasons",
    managerSuperLeagueOnly: true,
  },
  {
    id: "manager_challenge_cups",
    label: "Challenge Cups Won",
    shortLabel: "Cups Won",
    managerChallengeCupOnly: true,
  },
  {
    id: "manager_cup_finals",
    label: "Cup Finals Reached",
    shortLabel: "Finals",
    managerChallengeCupOnly: true,
  },
];

export function getTrackersForDbMode(
  dbMode:
    | "super-league"
    | "draft"
    | "fantasy"
    | "trophy-cabinet"
    | "daily"
) {
  if (dbMode === "daily") {
    return LEADERBOARD_TRACKERS.filter((t) => t.dailyOnly);
  }
  if (dbMode === "trophy-cabinet") {
    const order = TROPHY_CABINET_SECTIONS.flatMap((section) => section.trackerIds);
    return order
      .map((id) => LEADERBOARD_TRACKERS.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }
  return LEADERBOARD_TRACKERS.filter(
    (t) =>
      !t.cupOnly &&
      !t.clubFundsOnly &&
      !t.dailyOnly &&
      !t.trophyCabinetOnly &&
      !t.managerSuperLeagueOnly &&
      !t.managerChallengeCupOnly
  );
}

export function getDefaultTrackerForDbMode(
  dbMode:
    | "super-league"
    | "draft"
    | "fantasy"
    | "trophy-cabinet"
    | "daily"
): LeaderboardTrackerType {
  return getTrackersForDbMode(dbMode)[0]?.id ?? "best_record";
}

export function isTrackerValidForDbMode(
  tracker: LeaderboardTrackerType,
  dbMode:
    | "super-league"
    | "draft"
    | "fantasy"
    | "trophy-cabinet"
    | "daily"
): boolean {
  return getTrackersForDbMode(dbMode).some((t) => t.id === tracker);
}

export function isTrophyCabinetTracker(
  tracker: LeaderboardTrackerType
): boolean {
  return LEADERBOARD_TRACKERS.some(
    (t) => t.id === tracker && t.trophyCabinetOnly
  );
}

export type ManagerLeaderboardDbMode =
  | "manager-super-league"
  | "manager-challenge-cup";

export function getTrackersForManagerDbMode(
  dbMode: ManagerLeaderboardDbMode
) {
  if (dbMode === "manager-challenge-cup") {
    const order: LeaderboardTrackerType[] = [
      "manager_challenge_cups",
      "manager_cup_finals",
    ];
    return order
      .map((id) => LEADERBOARD_TRACKERS.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }
  const order: LeaderboardTrackerType[] = [
    "best_record",
    "manager_league_titles",
    "manager_seasons_completed",
    "perfect_runs",
    "wcc_wins",
  ];
  return order
    .map((id) => LEADERBOARD_TRACKERS.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
}

export function getDefaultTrackerForManagerDbMode(
  dbMode: ManagerLeaderboardDbMode
): LeaderboardTrackerType {
  return getTrackersForManagerDbMode(dbMode)[0]?.id ?? "best_record";
}

export function isTrackerValidForManagerDbMode(
  tracker: LeaderboardTrackerType,
  dbMode: ManagerLeaderboardDbMode
): boolean {
  return getTrackersForManagerDbMode(dbMode).some((t) => t.id === tracker);
}

export function rankByTracker(
  entries: LeaderboardTrackerEntry[],
  tracker: LeaderboardTrackerType,
  limit: number,
  currentUser: string
): LeaderboardTrackerRow[] {
  const sorted = [...entries]
    .map(sanitizeLeaderboardTrackerEntry)
    .sort((a, b) => {
    switch (tracker) {
      case "perfect_runs":
        return b.perfectRuns - a.perfectRuns;
      case "wcc_wins":
        return (b.wccWins ?? 0) - (a.wccWins ?? 0);
      case "best_record": {
        const aWins = a.bestRecordWins;
        const bWins = b.bestRecordWins;
        const aLosses = a.bestRecordLosses;
        const bLosses = b.bestRecordLosses;
        if (bWins !== aWins) {
          return bWins - aWins;
        }
        return aLosses - bLosses;
      }
      case "manager_challenge_cups":
        return b.challengeCupWins - a.challengeCupWins;
      case "manager_cup_finals":
        return b.cupFinals - a.cupFinals;
      case "manager_league_titles":
      case "league_titles":
      case "era_league_title":
        return (b.leagueTitles ?? 0) - (a.leagueTitles ?? 0);
      case "manager_seasons_completed":
        return (b.seasonsCompleted ?? 0) - (a.seasonsCompleted ?? 0);
      case "super_league_champions":
      case "era_league_champions":
        return (b.superLeagueTitles ?? 0) - (a.superLeagueTitles ?? 0);
      case "daily_streak":
        return 0;
      default:
        return 0;
    }
  });

  const rows = sorted.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    achievedAt: entry.achievedAt,
    difficulty: entry.difficulty,
    mode: entry.mode,
    isCurrentUser: !!currentUser && entry.username === currentUser,
    statDisplay: getTrackerStatDisplay(entry, tracker),
  }));

  if (currentUser && !rows.some((row) => row.isCurrentUser)) {
    const userIndex = sorted.findIndex((entry) => entry.username === currentUser);
    const userEntry = userIndex >= 0 ? sorted[userIndex] : undefined;
    if (userEntry) {
      rows.push({
        rank: userIndex + 1,
        username: userEntry.username,
        achievedAt: userEntry.achievedAt,
        difficulty: userEntry.difficulty,
        mode: userEntry.mode,
        isCurrentUser: true,
        statDisplay: getTrackerStatDisplay(userEntry, tracker),
      });
    }
  }

  return rows;
}

export function getTrackerStatDisplay(
  entry: LeaderboardTrackerEntry,
  tracker: LeaderboardTrackerType
): string {
  const sanitized = sanitizeLeaderboardTrackerEntry(entry);
  switch (tracker) {
    case "perfect_runs":
      return String(sanitized.perfectRuns);
    case "wcc_wins":
      return String(sanitized.wccWins);
    case "best_record":
      return formatRecordWithPercentage(
        sanitized.bestRecordWins,
        sanitized.bestRecordLosses
      );
    case "manager_challenge_cups":
      return String(sanitized.challengeCupWins);
    case "manager_cup_finals":
      return String(sanitized.cupFinals);
    case "manager_league_titles":
    case "league_titles":
    case "era_league_title":
      return String(sanitized.leagueTitles);
    case "manager_seasons_completed":
      return String(sanitized.seasonsCompleted);
    case "super_league_champions":
    case "era_league_champions":
      return String(sanitized.superLeagueTitles);
    default:
      return "—";
  }
}

export function mergeLeaderboardStats(
  existing: Partial<LeaderboardTrackerEntry> | null | undefined,
  update: {
    squadValue: number;
    wins: number;
    losses: number;
    isPerfectSeason?: boolean;
    /** Play-off phase update — adds W/L but skips season perfect/winless counters. */
    isPlayoffPhaseUpdate?: boolean;
  }
): Omit<
  LeaderboardTrackerEntry,
  "username" | "achievedAt" | "difficulty" | "mode"
> {
  const skipSeasonCounters = update.isPlayoffPhaseUpdate === true;
  const runWins = update.wins;
  const runLosses = update.losses;
  const seasonGames = runWins + runLosses;
  const seasonWinPct =
    seasonGames > 0 ? (runWins / seasonGames) * 100 : 0;

  const squadValue = Math.max(existing?.squadValue ?? 0, update.squadValue);
  const totalWins = (existing?.totalWins ?? 0) + runWins;
  const totalLosses = (existing?.totalLosses ?? 0) + runLosses;
  const perfectRuns = skipSeasonCounters
    ? (existing?.perfectRuns ?? 0)
    : (existing?.perfectRuns ?? 0) + (update.isPerfectSeason ? 1 : 0);
  const challengeCupWins = existing?.challengeCupWins ?? 0;

  let bestRecordWins = existing?.bestRecordWins ?? 0;
  let bestRecordLosses = existing?.bestRecordLosses ?? 0;
  if (!update.isPlayoffPhaseUpdate && seasonGames > 0) {
    const better =
      runWins > bestRecordWins ||
      (runWins === bestRecordWins && runLosses < bestRecordLosses);
    if (better || bestRecordWins + bestRecordLosses === 0) {
      bestRecordWins = runWins;
      bestRecordLosses = runLosses;
    }
  }

  let cupFinals = existing?.cupFinals ?? 0;
  let bestCupFinishRank = existing?.bestCupFinishRank ?? 0;
  let bestCupFinishLabel = existing?.bestCupFinishLabel ?? "";
  let cupWinPercentage = existing?.cupWinPercentage ?? 0;

  let bestWinPercentage = existing?.bestWinPercentage ?? 0;
  if (!update.isPlayoffPhaseUpdate && seasonGames > 0) {
    const runPct = (runWins / seasonGames) * 100;
    if (runPct > bestWinPercentage) bestWinPercentage = runPct;
  }

  return {
    squadValue,
    totalWins,
    totalLosses,
    perfectRuns,
    bestRecordWins,
    bestRecordLosses,
    bestWinPercentage,
    challengeCupWins,
    cupFinals,
    bestCupFinishRank,
    bestCupFinishLabel,
    cupWinPercentage,
    leagueTitles: 0,
    superLeagueTitles: 0,
    // Quick Mode runs have no World Club Challenge concept.
    wccWins: existing?.wccWins ?? 0,
    seasonsCompleted: existing?.seasonsCompleted ?? 0,
  };
}

/** Combine two cumulative leaderboard tracker snapshots (e.g. account merge). */
export function combineLeaderboardTrackerStats(
  a: Partial<LeaderboardTrackerEntry>,
  b: Partial<LeaderboardTrackerEntry>
): Omit<
  LeaderboardTrackerEntry,
  "username" | "achievedAt" | "difficulty" | "mode"
> {
  const rankA = a.bestCupFinishRank ?? 0;
  const rankB = b.bestCupFinishRank ?? 0;
  const totalWins = (a.totalWins ?? 0) + (b.totalWins ?? 0);
  const totalLosses = (a.totalLosses ?? 0) + (b.totalLosses ?? 0);
  const cupGames = totalWins + totalLosses;

  const aRecordWins = a.bestRecordWins ?? a.totalWins ?? 0;
  const aRecordLosses = a.bestRecordLosses ?? a.totalLosses ?? 0;
  const bRecordWins = b.bestRecordWins ?? b.totalWins ?? 0;
  const bRecordLosses = b.bestRecordLosses ?? b.totalLosses ?? 0;
  const betterRecord =
    bRecordWins > aRecordWins ||
    (bRecordWins === aRecordWins && bRecordLosses < aRecordLosses)
      ? { wins: bRecordWins, losses: bRecordLosses }
      : { wins: aRecordWins, losses: aRecordLosses };

  return {
    squadValue: Math.max(a.squadValue ?? 0, b.squadValue ?? 0),
    totalWins,
    totalLosses,
    perfectRuns: (a.perfectRuns ?? 0) + (b.perfectRuns ?? 0),
    bestRecordWins: betterRecord.wins,
    bestRecordLosses: betterRecord.losses,
    bestWinPercentage:
      cupGames > 0
        ? Math.max(a.bestWinPercentage ?? 0, b.bestWinPercentage ?? 0)
        : totalWins + totalLosses > 0
          ? (totalWins / (totalWins + totalLosses)) * 100
          : 0,
    challengeCupWins: (a.challengeCupWins ?? 0) + (b.challengeCupWins ?? 0),
    cupFinals: (a.cupFinals ?? 0) + (b.cupFinals ?? 0),
    bestCupFinishRank: Math.max(rankA, rankB),
    bestCupFinishLabel:
      rankB > rankA ? (b.bestCupFinishLabel ?? "") : (a.bestCupFinishLabel ?? ""),
    cupWinPercentage:
      cupGames > 0
        ? (totalWins / cupGames) * 100
        : Math.max(a.cupWinPercentage ?? 0, b.cupWinPercentage ?? 0),
    leagueTitles: (a.leagueTitles ?? 0) + (b.leagueTitles ?? 0),
    superLeagueTitles: (a.superLeagueTitles ?? 0) + (b.superLeagueTitles ?? 0),
    wccWins: (a.wccWins ?? 0) + (b.wccWins ?? 0),
    seasonsCompleted: (a.seasonsCompleted ?? 0) + (b.seasonsCompleted ?? 0),
  };
}
