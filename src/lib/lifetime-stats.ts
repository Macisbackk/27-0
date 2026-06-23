import { applyMatchResultsToStreak } from "./cup-ranking";
import { getPlayerById, isHiddenPlayer } from "./players";
import type { UserStatsData } from "./types";

export function getMostSelectedPlayer(
  draftCounts: Record<string, number>
): { name: string; count: number } | null {
  let bestId: string | null = null;
  let bestCount = 0;

  for (const [id, count] of Object.entries(draftCounts)) {
    if (isHiddenPlayer(id)) continue;
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  }

  if (!bestId || bestCount === 0) return null;
  return { name: getPlayerById(bestId)?.name ?? bestId, count: bestCount };
}

export function getMostSuccessfulPlayer(
  playerSeasonWins: Record<string, number>
): { name: string; wins: number } | null {
  let bestId: string | null = null;
  let bestWins = 0;

  for (const [id, wins] of Object.entries(playerSeasonWins)) {
    if (isHiddenPlayer(id)) continue;
    if (wins > bestWins) {
      bestWins = wins;
      bestId = id;
    }
  }

  if (!bestId || bestWins === 0) return null;
  return { name: getPlayerById(bestId)?.name ?? bestId, wins: bestWins };
}

export function getWorstPerformingPlayer(
  playerSeasonLosses: Record<string, number>
): { name: string; losses: number } | null {
  let worstId: string | null = null;
  let worstLosses = 0;

  for (const [id, losses] of Object.entries(playerSeasonLosses)) {
    if (isHiddenPlayer(id)) continue;
    if (losses > worstLosses) {
      worstLosses = losses;
      worstId = id;
    }
  }

  if (!worstId || worstLosses === 0) return null;
  return {
    name: getPlayerById(worstId)?.name ?? worstId,
    losses: worstLosses,
  };
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function formatRecordWithPercentage(
  wins: number,
  losses: number
): string {
  const games = wins + losses;
  if (games === 0) return "0-0";
  const pct = ((wins / games) * 100).toFixed(1);
  return `${wins}-${losses} (${pct}%)`;
}

export function formatLeagueFinish(position: number): string {
  const v = position % 100;
  const suffix =
    v >= 11 && v <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}

export function isBetterRecord(
  wins: number,
  losses: number,
  bestWins: number,
  bestLosses: number
): boolean {
  return (
    wins > bestWins || (wins === bestWins && losses < bestLosses)
  );
}

export function isWorseRecord(
  wins: number,
  losses: number,
  worstWins: number,
  worstLosses: number
): boolean {
  return (
    wins < worstWins || (wins === worstWins && losses > worstLosses)
  );
}

export interface SeasonLifetimeInput {
  wins: number;
  losses: number;
  leaguePosition: number;
  isPerfect: boolean;
  longestWinStreak: number;
  longestLosingStreak: number;
  signedIds: string[];
  totalValue: number;
  nationalRank?: number;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  challengeCupMode?: boolean;
  eraChallengeCupMode?: boolean;
  eraTeamUsed?: string;
  cupFinish?: string;
  cupWon?: boolean;
  averageSquadRating?: number;
  matchResults?: ("W" | "L")[];
  playoffWins?: number;
  playoffLosses?: number;
  playoffFinish?: string;
  superLeagueTitle?: boolean;
  topSixFinish?: boolean;
}

export function applySeasonLifetimeUpdate(
  existing: UserStatsData,
  input: SeasonLifetimeInput
): UserStatsData {
  const {
    wins,
    losses,
    leaguePosition,
    isPerfect,
    longestWinStreak,
    longestLosingStreak,
    signedIds,
    totalValue,
    nationalRank,
    joeMellorMode,
    superSamHallasMode,
    challengeCupMode,
    eraChallengeCupMode,
    eraTeamUsed,
    cupFinish,
    cupWon,
    averageSquadRating,
    matchResults = [],
    playoffWins = 0,
    playoffLosses = 0,
    playoffFinish,
    superLeagueTitle = false,
    topSixFinish = false,
  } = input;

  if (eraChallengeCupMode) {
    const draftCounts = { ...existing.draftCounts };
    for (const id of signedIds) {
      draftCounts[id] = (draftCounts[id] ?? 0) + 1;
    }

    let bestEraTeamUsed = existing.bestEraTeamUsed;
    if (cupWon && eraTeamUsed) {
      bestEraTeamUsed = eraTeamUsed;
    }

    return {
      ...existing,
      draftCounts,
      eraChallengeCupRuns: existing.eraChallengeCupRuns + 1,
      eraChallengeCupWins: existing.eraChallengeCupWins + wins,
      eraChallengeCupLosses: existing.eraChallengeCupLosses + losses,
      eraCupsWon: existing.eraCupsWon + (cupWon ? 1 : 0),
      eraMatchWins: existing.eraMatchWins + wins,
      eraMatchLosses: existing.eraMatchLosses + losses,
      bestEraTeamUsed,
    };
  }

  if (challengeCupMode) {
    const draftCounts = { ...existing.draftCounts };
    for (const id of signedIds) {
      draftCounts[id] = (draftCounts[id] ?? 0) + 1;
    }

    const finishRank = (f: string | null | undefined): number => {
      switch (f) {
        case "Winners":
          return 5;
        case "Runners-Up":
          return 4;
        case "Semi Final":
          return 3;
        case "Quarter Final":
          return 2;
        case "Round of 16":
          return 1;
        default:
          return 0;
      }
    };
    const currentBest = finishRank(existing.bestCupFinish);
    const thisFinish = finishRank(cupFinish);
    const newBest =
      thisFinish > currentBest
        ? cupFinish ?? existing.bestCupFinish
        : existing.bestCupFinish;

    let highestCupSquadRating = existing.highestCupSquadRating;
    let lowestCupSquadRating = existing.lowestCupSquadRating;
    if (averageSquadRating !== undefined) {
      highestCupSquadRating =
        highestCupSquadRating === null
          ? averageSquadRating
          : Math.max(highestCupSquadRating, averageSquadRating);
      lowestCupSquadRating =
        lowestCupSquadRating === null
          ? averageSquadRating
          : Math.min(lowestCupSquadRating, averageSquadRating);
    }

    let bestCupNationalRanking = existing.bestCupNationalRanking;
    if (nationalRank !== undefined) {
      bestCupNationalRanking =
        bestCupNationalRanking === null
          ? nationalRank
          : Math.min(bestCupNationalRanking, nationalRank);
    }

    const streak = applyMatchResultsToStreak(
      existing.currentCupMatchWinStreak,
      existing.longestCupMatchWinStreak,
      matchResults
    );
    const newTournamentRow = cupWon
      ? existing.currentTournamentWinsInRow + 1
      : 0;

    return {
      ...existing,
      draftCounts,
      challengeCupWins: existing.challengeCupWins + wins,
      challengeCupLosses: existing.challengeCupLosses + losses,
      challengeCupRuns: existing.challengeCupRuns + 1,
      challengeCupsWon: existing.challengeCupsWon + (cupWon ? 1 : 0),
      challengeCupFinals:
        existing.challengeCupFinals +
        (cupFinish === "Winners" || cupFinish === "Runners-Up" ? 1 : 0),
      challengeCupSemiFinals:
        existing.challengeCupSemiFinals + (thisFinish >= 3 ? 1 : 0),
      challengeCupQuarterFinals:
        existing.challengeCupQuarterFinals + (thisFinish >= 2 ? 1 : 0),
      bestCupFinish: newBest ?? existing.bestCupFinish,
      bestCupNationalRanking,
      highestCupSquadRating,
      lowestCupSquadRating,
      longestCupMatchWinStreak: streak.longestStreak,
      currentCupMatchWinStreak: streak.currentStreak,
      currentTournamentWinsInRow: newTournamentRow,
      longestTournamentWinsInRow: Math.max(
        existing.longestTournamentWinsInRow,
        newTournamentRow
      ),
      bestCupMatchWinsInTournament: Math.max(
        existing.bestCupMatchWinsInTournament,
        wins
      ),
    };
  }

  if (superSamHallasMode) {
    return existing;
  }

  if (joeMellorMode) {
    const jmBetter = isBetterRecord(
      wins,
      losses,
      existing.bestJoeMellorWins,
      existing.bestJoeMellorLosses
    );
    return {
      ...existing,
      joeMellorRuns: existing.joeMellorRuns + 1,
      bestJoeMellorWins: jmBetter ? wins : existing.bestJoeMellorWins,
      bestJoeMellorLosses: jmBetter ? losses : existing.bestJoeMellorLosses,
      joeMellorPerfectSeasons:
        existing.joeMellorPerfectSeasons + (isPerfect ? 1 : 0),
    };
  }

  const seasons = existing.totalSeasonsSimulated + 1;
  const regularWins = wins;
  const regularLosses = losses;
  const overallWins = regularWins + playoffWins;
  const overallLosses = regularLosses + playoffLosses;

  const newRegularWins = existing.regularSeasonWins + regularWins;
  const newRegularLosses = existing.regularSeasonLosses + regularLosses;
  const newPlayoffWins = existing.playoffWins + playoffWins;
  const newPlayoffLosses = existing.playoffLosses + playoffLosses;
  const newSeasonWins = existing.seasonWins + overallWins;
  const newSeasonLosses = existing.seasonLosses + overallLosses;
  const newAvgFinish = Math.round(
    (existing.averageSeasonFinish * existing.totalSeasonsSimulated +
      leaguePosition) /
      seasons
  );

  const draftCounts = { ...existing.draftCounts };
  const playerSeasonWins = { ...existing.playerSeasonWins };
  const playerSeasonLosses = { ...existing.playerSeasonLosses };

  for (const id of signedIds) {
    draftCounts[id] = (draftCounts[id] ?? 0) + 1;
    playerSeasonWins[id] = (playerSeasonWins[id] ?? 0) + overallWins;
    playerSeasonLosses[id] = (playerSeasonLosses[id] ?? 0) + overallLosses;
  }

  const isFirstSeason = existing.totalSeasonsSimulated === 0;
  const betterRecord = isBetterRecord(
    regularWins,
    regularLosses,
    existing.bestRecordWins,
    existing.bestRecordLosses
  );
  const betterOverall = isBetterRecord(
    overallWins,
    overallLosses,
    existing.bestOverallSeasonWins,
    existing.bestOverallSeasonLosses
  );
  const worseRecord =
    !isFirstSeason &&
    isWorseRecord(
      regularWins,
      regularLosses,
      existing.worstRecordWins,
      existing.worstRecordLosses
    );

  let lowestSquadValue = existing.lowestSquadValue;
  if (lowestSquadValue === null) {
    lowestSquadValue = totalValue;
  } else {
    lowestSquadValue = Math.min(lowestSquadValue, totalValue);
  }

  let bestNationalRanking = existing.bestNationalRanking;
  if (nationalRank !== undefined) {
    bestNationalRanking =
      bestNationalRanking === null
        ? nationalRank
        : Math.min(bestNationalRanking, nationalRank);
  }

  const eliminatorWin =
    playoffFinish === "Super League Champions" ||
    playoffFinish === "Grand Final Runner-Up" ||
    playoffFinish === "Eliminated in Semi-Final";
  const semiWin =
    playoffFinish === "Super League Champions" ||
    playoffFinish === "Grand Final Runner-Up";

  let updated: UserStatsData = {
    ...existing,
    totalSeasonsSimulated: seasons,
    regularSeasonWins: newRegularWins,
    regularSeasonLosses: newRegularLosses,
    playoffWins: newPlayoffWins,
    playoffLosses: newPlayoffLosses,
    seasonWins: newSeasonWins,
    seasonLosses: newSeasonLosses,
    totalWins: newSeasonWins,
    totalLosses: newSeasonLosses,
    bestRecordWins: isFirstSeason
      ? regularWins
      : betterRecord
        ? regularWins
        : existing.bestRecordWins,
    bestRecordLosses: isFirstSeason
      ? regularLosses
      : betterRecord
        ? regularLosses
        : existing.bestRecordLosses,
    bestOverallSeasonWins: isFirstSeason
      ? overallWins
      : betterOverall
        ? overallWins
        : existing.bestOverallSeasonWins,
    bestOverallSeasonLosses: isFirstSeason
      ? overallLosses
      : betterOverall
        ? overallLosses
        : existing.bestOverallSeasonLosses,
    worstRecordWins: isFirstSeason
      ? regularWins
      : worseRecord
        ? regularWins
        : existing.worstRecordWins,
    worstRecordLosses: isFirstSeason
      ? regularLosses
      : worseRecord
        ? regularLosses
        : existing.worstRecordLosses,
    longestUnbeatenRun: Math.max(existing.longestUnbeatenRun, longestWinStreak),
    longestLosingStreak: Math.max(
      existing.longestLosingStreak,
      longestLosingStreak
    ),
    leagueTitlesWon: existing.leagueTitlesWon,
    superLeagueTitles:
      existing.superLeagueTitles + (superLeagueTitle ? 1 : 0),
    topSixFinishes:
      existing.topSixFinishes + (topSixFinish ? 1 : 0),
    playoffAppearances:
      existing.playoffAppearances + (topSixFinish ? 1 : 0),
    playoffEliminatorWins:
      existing.playoffEliminatorWins +
      (eliminatorWin && playoffWins > 0 ? 1 : 0),
    playoffSemiFinalWins:
      existing.playoffSemiFinalWins + (semiWin ? 1 : 0),
    grandFinalAppearances:
      existing.grandFinalAppearances +
      (playoffFinish === "Super League Champions" ||
      playoffFinish === "Grand Final Runner-Up"
        ? 1
        : 0),
    totalPerfectSeasons:
      existing.totalPerfectSeasons + (isPerfect ? 1 : 0),
    totalWinlessSeasons:
      existing.totalWinlessSeasons + (wins === 0 ? 1 : 0),
    lowestSquadValue,
    bestNationalRanking,
    bestTeamRating:
      averageSquadRating !== undefined
        ? Math.max(existing.bestTeamRating ?? 0, averageSquadRating)
        : (existing.bestTeamRating ?? 0),
    averageSeasonFinish: newAvgFinish,
    draftCounts,
    playerSeasonWins,
    playerSeasonLosses,
  };

  return updated;
}
