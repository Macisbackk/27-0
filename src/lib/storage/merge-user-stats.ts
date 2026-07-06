import type { UserStatsData } from "../types";
import { migrateUserStats } from "./stats";
import { isWorseRecord } from "../lifetime-stats";
import { getCupFinishRank } from "../cup-ranking";

function mergeRecordMaps(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

function pickBestRecord(
  a: { wins: number; losses: number },
  b: { wins: number; losses: number }
): { wins: number; losses: number } {
  if (a.wins + a.losses === 0) return b;
  if (b.wins + b.losses === 0) return a;
  if (b.wins > a.wins) return b;
  if (b.wins < a.wins) return a;
  return b.losses < a.losses ? b : a;
}

function pickWorstRecord(
  a: { wins: number; losses: number },
  b: { wins: number; losses: number }
): { wins: number; losses: number } {
  if (a.wins + a.losses === 0) return b;
  if (b.wins + b.losses === 0) return a;
  return isWorseRecord(a.wins, a.losses, b.wins, b.losses) ? a : b;
}

function pickBestCupFinish(a: string | null, b: string | null): string | null {
  const rankA = getCupFinishRank(a);
  const rankB = getCupFinishRank(b);
  return rankB > rankA ? b : a;
}

/** Merge two UserStatsData buckets cumulatively, preserving bests correctly. */
export function mergeUserStatsData(
  primary: UserStatsData,
  secondary: UserStatsData
): UserStatsData {
  const a = migrateUserStats(primary);
  const b = migrateUserStats(secondary);
  const totalRuns = a.totalRuns + b.totalRuns;
  const avgDenom = totalRuns || 1;

  return {
    ...a,
    totalRuns,
    highestSquadValue: Math.max(a.highestSquadValue, b.highestSquadValue),
    lowestSquadValue:
      a.lowestSquadValue === null
        ? b.lowestSquadValue
        : b.lowestSquadValue === null
          ? a.lowestSquadValue
          : Math.min(a.lowestSquadValue, b.lowestSquadValue),
    averageSquadValue:
      (a.averageSquadValue * a.totalRuns + b.averageSquadValue * b.totalRuns) /
      avgDenom,
    bestPositionValue: Math.max(a.bestPositionValue, b.bestPositionValue),
    weeklyBest: Math.max(a.weeklyBest, b.weeklyBest),
    monthlyBest: Math.max(a.monthlyBest, b.monthlyBest),
    mostValuablePlayerEverPulledVal: Math.max(
      a.mostValuablePlayerEverPulledVal,
      b.mostValuablePlayerEverPulledVal
    ),
    mostValuablePlayerEverPulled:
      a.mostValuablePlayerEverPulledVal >= b.mostValuablePlayerEverPulledVal
        ? a.mostValuablePlayerEverPulled
        : b.mostValuablePlayerEverPulled,
    bestBradfordSquad: Math.max(a.bestBradfordSquad, b.bestBradfordSquad),
    bestWiganSquad: Math.max(a.bestWiganSquad, b.bestWiganSquad),
    bestLeedsSquad: Math.max(a.bestLeedsSquad, b.bestLeedsSquad),
    bestStHelensSquad: Math.max(a.bestStHelensSquad, b.bestStHelensSquad),
    bestHistoricSquad: Math.max(a.bestHistoricSquad, b.bestHistoricSquad),
    totalSeasonsSimulated: a.totalSeasonsSimulated + b.totalSeasonsSimulated,
    totalWins: a.totalWins + b.totalWins,
    totalLosses: a.totalLosses + b.totalLosses,
    seasonWins: a.seasonWins + b.seasonWins,
    seasonLosses: a.seasonLosses + b.seasonLosses,
    bestRecordWins: pickBestRecord(
      { wins: a.bestRecordWins, losses: a.bestRecordLosses },
      { wins: b.bestRecordWins, losses: b.bestRecordLosses }
    ).wins,
    bestRecordLosses: pickBestRecord(
      { wins: a.bestRecordWins, losses: a.bestRecordLosses },
      { wins: b.bestRecordWins, losses: b.bestRecordLosses }
    ).losses,
    worstRecordWins: pickWorstRecord(
      { wins: a.worstRecordWins, losses: a.worstRecordLosses },
      { wins: b.worstRecordWins, losses: b.worstRecordLosses }
    ).wins,
    worstRecordLosses: pickWorstRecord(
      { wins: a.worstRecordWins, losses: a.worstRecordLosses },
      { wins: b.worstRecordWins, losses: b.worstRecordLosses }
    ).losses,
    longestUnbeatenRun: Math.max(a.longestUnbeatenRun, b.longestUnbeatenRun),
    longestLosingStreak: Math.max(a.longestLosingStreak, b.longestLosingStreak),
    leagueTitlesWon: a.leagueTitlesWon + b.leagueTitlesWon,
    totalPerfectSeasons: a.totalPerfectSeasons + b.totalPerfectSeasons,
    totalWinlessSeasons: a.totalWinlessSeasons + b.totalWinlessSeasons,
    bestNationalRanking:
      a.bestNationalRanking === null
        ? b.bestNationalRanking
        : b.bestNationalRanking === null
          ? a.bestNationalRanking
          : Math.min(a.bestNationalRanking, b.bestNationalRanking),
    averageSeasonFinish:
      a.totalSeasonsSimulated + b.totalSeasonsSimulated === 0
        ? 0
        : (a.averageSeasonFinish * a.totalSeasonsSimulated +
            b.averageSeasonFinish * b.totalSeasonsSimulated) /
          (a.totalSeasonsSimulated + b.totalSeasonsSimulated),
    draftCounts: mergeRecordMaps(a.draftCounts, b.draftCounts),
    playerSeasonWins: mergeRecordMaps(a.playerSeasonWins, b.playerSeasonWins),
    playerSeasonLosses: mergeRecordMaps(
      a.playerSeasonLosses,
      b.playerSeasonLosses
    ),
    joeMellorRuns: a.joeMellorRuns + b.joeMellorRuns,
    bestJoeMellorWins: pickBestRecord(
      { wins: a.bestJoeMellorWins, losses: a.bestJoeMellorLosses },
      { wins: b.bestJoeMellorWins, losses: b.bestJoeMellorLosses }
    ).wins,
    bestJoeMellorLosses: pickBestRecord(
      { wins: a.bestJoeMellorWins, losses: a.bestJoeMellorLosses },
      { wins: b.bestJoeMellorWins, losses: b.bestJoeMellorLosses }
    ).losses,
    joeMellorPerfectSeasons: a.joeMellorPerfectSeasons + b.joeMellorPerfectSeasons,
    totalRerollsUsed: a.totalRerollsUsed + b.totalRerollsUsed,
    mostRerollsInRun: Math.max(a.mostRerollsInRun, b.mostRerollsInRun),
    averageRerollsPerRun:
      totalRuns === 0
        ? 0
        : Math.round(
            (a.averageRerollsPerRun * a.totalRuns +
              b.averageRerollsPerRun * b.totalRuns) /
              totalRuns
          ),
    challengeCupRuns: a.challengeCupRuns + b.challengeCupRuns,
    challengeCupWins: a.challengeCupWins + b.challengeCupWins,
    challengeCupLosses: a.challengeCupLosses + b.challengeCupLosses,
    challengeCupsWon: a.challengeCupsWon + b.challengeCupsWon,
    challengeCupFinals: a.challengeCupFinals + b.challengeCupFinals,
    challengeCupSemiFinals: a.challengeCupSemiFinals + b.challengeCupSemiFinals,
    challengeCupQuarterFinals:
      a.challengeCupQuarterFinals + b.challengeCupQuarterFinals,
    bestCupFinish: pickBestCupFinish(a.bestCupFinish, b.bestCupFinish),
    bestCupNationalRanking:
      a.bestCupNationalRanking === null
        ? b.bestCupNationalRanking
        : b.bestCupNationalRanking === null
          ? a.bestCupNationalRanking
          : Math.min(a.bestCupNationalRanking, b.bestCupNationalRanking),
    highestCupSquadRating:
      a.highestCupSquadRating === null
        ? b.highestCupSquadRating
        : b.highestCupSquadRating === null
          ? a.highestCupSquadRating
          : Math.max(a.highestCupSquadRating, b.highestCupSquadRating),
    lowestCupSquadRating:
      a.lowestCupSquadRating === null
        ? b.lowestCupSquadRating
        : b.lowestCupSquadRating === null
          ? a.lowestCupSquadRating
          : Math.min(a.lowestCupSquadRating, b.lowestCupSquadRating),
    longestCupMatchWinStreak: Math.max(
      a.longestCupMatchWinStreak,
      b.longestCupMatchWinStreak
    ),
    currentCupMatchWinStreak: Math.max(
      a.currentCupMatchWinStreak,
      b.currentCupMatchWinStreak
    ),
    longestTournamentWinsInRow: Math.max(
      a.longestTournamentWinsInRow,
      b.longestTournamentWinsInRow
    ),
    currentTournamentWinsInRow: Math.max(
      a.currentTournamentWinsInRow,
      b.currentTournamentWinsInRow
    ),
    bestCupMatchWinsInTournament: Math.max(
      a.bestCupMatchWinsInTournament,
      b.bestCupMatchWinsInTournament
    ),
    bestTeamRating: Math.max(a.bestTeamRating, b.bestTeamRating),
    regularSeasonWins: a.regularSeasonWins + b.regularSeasonWins,
    regularSeasonLosses: a.regularSeasonLosses + b.regularSeasonLosses,
    playoffWins: a.playoffWins + b.playoffWins,
    playoffLosses: a.playoffLosses + b.playoffLosses,
    topSixFinishes: a.topSixFinishes + b.topSixFinishes,
    playoffAppearances: a.playoffAppearances + b.playoffAppearances,
    playoffEliminatorWins: a.playoffEliminatorWins + b.playoffEliminatorWins,
    playoffSemiFinalWins: a.playoffSemiFinalWins + b.playoffSemiFinalWins,
    grandFinalAppearances: a.grandFinalAppearances + b.grandFinalAppearances,
    superLeagueTitles: a.superLeagueTitles + b.superLeagueTitles,
    bestOverallSeasonWins: pickBestRecord(
      { wins: a.bestOverallSeasonWins, losses: a.bestOverallSeasonLosses },
      { wins: b.bestOverallSeasonWins, losses: b.bestOverallSeasonLosses }
    ).wins,
    bestOverallSeasonLosses: pickBestRecord(
      { wins: a.bestOverallSeasonWins, losses: a.bestOverallSeasonLosses },
      { wins: b.bestOverallSeasonWins, losses: b.bestOverallSeasonLosses }
    ).losses,
  };
}
