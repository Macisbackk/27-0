import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { isWorseRecord } from "../lifetime-stats";
import { getUserLeaguePosition } from "./managerFixtures";
import type { ManagerCareer, ManagerSeasonSummary } from "./types";

export interface ManagerCareerSaveStats {
  club: string;
  seasons: number;
  completedSeasons: number;
  wins: number;
  losses: number;
  leagueTitles: number;
  superLeagueTitles: number;
  challengeCups: number;
  cupFinals: number;
  topSixFinishes: number;
  perfectSeasons: number;
  winlessSeasons: number;
  trophies: number;
  bestFinish: number | null;
  worstRecord: { wins: number; losses: number } | null;
  biggestWinMargin: number;
  biggestDefeatMargin: number;
  totalEarnings: number;
}

export interface ManagerCareerSeasonRow {
  seasonYear: number;
  position: number;
  wins: number;
  losses: number;
  trophies: string[];
  inProgress: boolean;
}

function applySeasonAchievements(
  stats: ManagerCareerSaveStats,
  season: {
    position: number;
    wins: number;
    losses: number;
    playoffFinish: string | null;
    challengeCupWon: boolean;
    challengeCupFinal: boolean;
    countAchievements: boolean;
  }
): void {
  if (season.countAchievements) {
    if (season.position === 1) {
      stats.leagueTitles++;
      stats.trophies++;
    }
    if (season.playoffFinish === "Super League Champions") {
      stats.superLeagueTitles++;
      stats.trophies++;
    }
    if (season.challengeCupWon) {
      stats.challengeCups++;
      stats.trophies++;
    }
    if (season.position <= 6) {
      stats.topSixFinishes++;
    }
    if (season.wins === 27 && season.losses === 0) {
      stats.perfectSeasons++;
    }
    if (season.wins === 0 && season.losses === 27) {
      stats.winlessSeasons++;
    }
  }

  if (season.challengeCupWon || season.challengeCupFinal) {
    stats.cupFinals++;
  }

  if (
    stats.bestFinish === null ||
    season.position < stats.bestFinish
  ) {
    stats.bestFinish = season.position;
  }

  if (
    stats.worstRecord === null ||
    isWorseRecord(
      season.wins,
      season.losses,
      stats.worstRecord.wins,
      stats.worstRecord.losses
    )
  ) {
    stats.worstRecord = { wins: season.wins, losses: season.losses };
  }
}

function marginFromSummaryHighlight(
  highlight: ManagerSeasonSummary["biggestWin"]
): number {
  return highlight?.margin ?? 0;
}

function marginsFromFixtures(career: ManagerCareer): {
  biggestWin: number;
  biggestDefeat: number;
} {
  let biggestWin = 0;
  let biggestDefeat = 0;
  for (const f of career.fixtures) {
    if (f.competition === "friendly") continue;
    const margin = f.pointsFor - f.pointsAgainst;
    if (f.result === "W" && margin > biggestWin) biggestWin = margin;
    if (f.result === "L" && Math.abs(margin) > biggestDefeat) {
      biggestDefeat = Math.abs(margin);
    }
  }
  return { biggestWin, biggestDefeat };
}

export function computeManagerCareerSaveStats(
  career: ManagerCareer
): ManagerCareerSaveStats {
  const stats: ManagerCareerSaveStats = {
    club: career.club,
    seasons: career.seasonHistory.length + 1,
    completedSeasons: career.seasonHistory.length,
    wins: 0,
    losses: 0,
    leagueTitles: 0,
    superLeagueTitles: 0,
    challengeCups: 0,
    cupFinals: 0,
    topSixFinishes: 0,
    perfectSeasons: 0,
    winlessSeasons: 0,
    trophies: 0,
    bestFinish: null,
    worstRecord: null,
    biggestWinMargin: 0,
    biggestDefeatMargin: 0,
    totalEarnings: career.clubFundsEarned,
  };

  for (const s of career.seasonHistory) {
    stats.wins += s.wins;
    stats.losses += s.losses;

    const cupWon = s.trophies.includes("Challenge Cup");
    const cupFinal =
      cupWon || /final/i.test(s.challengeCupResult);

    applySeasonAchievements(stats, {
      position: s.position,
      wins: s.wins,
      losses: s.losses,
      playoffFinish: s.playoffFinish ?? null,
      challengeCupWon: cupWon,
      challengeCupFinal: cupFinal,
      countAchievements: true,
    });

    const winMargin = marginFromSummaryHighlight(s.biggestWin);
    const defeatMargin = Math.abs(marginFromSummaryHighlight(s.biggestDefeat));
    if (winMargin > stats.biggestWinMargin) stats.biggestWinMargin = winMargin;
    if (defeatMargin > stats.biggestDefeatMargin) {
      stats.biggestDefeatMargin = defeatMargin;
    }
  }

  stats.wins += career.wins;
  stats.losses += career.losses;

  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const currentPosition = getUserLeaguePosition(career.leagueTable, career.club);
  const currentMargins = marginsFromFixtures(career);

  applySeasonAchievements(stats, {
    position: currentPosition,
    wins: career.wins,
    losses: career.losses,
    playoffFinish: career.playoffs?.finish ?? null,
    challengeCupWon: cupOutcome.isWinner,
    challengeCupFinal:
      cupOutcome.isWinner || cupOutcome.finish === "Runners-Up",
    countAchievements: career.isSeasonComplete,
  });

  if (currentMargins.biggestWin > stats.biggestWinMargin) {
    stats.biggestWinMargin = currentMargins.biggestWin;
  }
  if (currentMargins.biggestDefeat > stats.biggestDefeatMargin) {
    stats.biggestDefeatMargin = currentMargins.biggestDefeat;
  }

  return stats;
}

export function buildManagerCareerSeasonRows(
  career: ManagerCareer
): ManagerCareerSeasonRow[] {
  const rows: ManagerCareerSeasonRow[] = career.seasonHistory.map((s) => ({
    seasonYear: s.seasonYear,
    position: s.position,
    wins: s.wins,
    losses: s.losses,
    trophies: s.trophies,
    inProgress: false,
  }));

  const hasCurrentActivity =
    career.fixtures.length > 0 ||
    career.gameWeek > 0 ||
    !career.isSeasonComplete;

  if (hasCurrentActivity) {
    const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
    const trophies: string[] = [];
    const position = getUserLeaguePosition(career.leagueTable, career.club);

    if (career.isSeasonComplete) {
      if (career.playoffs?.finish === "Super League Champions") {
        trophies.push("Super League Champions");
      } else if (position === 1) {
        trophies.push("League Leaders");
      }
      if (cupOutcome.isWinner) trophies.push("Challenge Cup");
      if (career.playoffs?.finish === "Grand Final Runner-Up") {
        trophies.push("Grand Final Runner-Up");
      }
    } else if (cupOutcome.isWinner) {
      trophies.push("Challenge Cup");
    }

    rows.push({
      seasonYear: career.seasonYear,
      position,
      wins: career.wins,
      losses: career.losses,
      trophies,
      inProgress: !career.isSeasonComplete,
    });
  }

  return rows;
}

function formatFinish(position: number | null): string {
  if (position === null) return "—";
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

export function getManagerCareerSaveView(career: ManagerCareer) {
  const stats = computeManagerCareerSaveStats(career);
  return {
    ...stats,
    bestFinishLabel: formatFinish(stats.bestFinish),
    worstRecordLabel: stats.worstRecord
      ? `${stats.worstRecord.wins}W-${stats.worstRecord.losses}L`
      : "—",
    totalRecordLabel: `${stats.wins}W-${stats.losses}L`,
    earningsLabel:
      stats.totalEarnings > 0
        ? `£${(stats.totalEarnings / 1000).toFixed(0)}k`
        : "—",
    seasonRows: buildManagerCareerSeasonRows(career),
  };
}
