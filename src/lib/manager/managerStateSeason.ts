import { getPlayerById } from "../players";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import type { ManagerCareer, ManagerSeasonSummary } from "./types";
import { buildManagerSchedule, buildLeagueTableFromMatches } from "./managerFixtures";
import { generateTransferMarket } from "./managerTransfers";
import { getUserLeaguePosition } from "./managerFixtures";
import { EMPTY_TEAM_SEASON_STATS } from "./managerCareerStats";
import {
  countExpiringContracts,
  formatWage,
  previewPlayersLeaving,
  tickContractsForNewSeason,
} from "./managerContracts";
import { createManagerChallengeCup } from "./managerChallengeCup";
import { createClubAttendanceData } from "./managerAttendance";

const CAREER_KEY = "27-0-manager-career";

function persistCareer(career: ManagerCareer): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CAREER_KEY,
    JSON.stringify({ ...career, updatedAt: new Date().toISOString() })
  );
}

export function buildSeasonSummary(career: ManagerCareer): ManagerSeasonSummary {
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  let bestPlayerId: string | null = null;
  let bestRating = 0;
  let topTryScorerId: string | null = null;
  let topTries = 0;

  for (const ps of career.squad) {
    const player = getPlayerById(ps.playerId);
    if (!player) continue;
    if ((player.rating ?? player.peakRating) > bestRating) {
      bestRating = player.rating ?? player.peakRating;
      bestPlayerId = ps.playerId;
    }
    if (ps.seasonTries > topTries) {
      topTries = ps.seasonTries;
      topTryScorerId = ps.playerId;
    }
  }

  const trophies: string[] = [];
  if (position === 1) trophies.push("Super League Champions");
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  if (cupOutcome.isWinner) trophies.push("Challenge Cup");

  let budgetChange = 0;
  if (position === 1) budgetChange = 400_000;
  else if (position <= 4) budgetChange = 200_000;
  else if (position <= 8) budgetChange = 75_000;
  else budgetChange = 25_000;
  if (cupOutcome.isWinner) budgetChange += 150_000;

  let boardVerdict = "A steady season — the board want more next year.";
  if (position === 1) boardVerdict = "Outstanding — you delivered the title.";
  else if (position <= 4) boardVerdict = "Playoff football achieved. Well done.";
  else if (position >= 12) boardVerdict = "Disappointing — improvements required.";

  const sa = career.seasonAttendance;
  const avgAttendance =
    sa.count > 0 ? Math.round(sa.total / sa.count) : career.attendanceData.currentAverageAttendance;

  const expiring = countExpiringContracts(career.contracts);
  const leaving = previewPlayersLeaving(career);

  let biggestWin = 0;
  let biggestDefeat = 0;
  for (const f of career.fixtures) {
    const margin = f.pointsFor - f.pointsAgainst;
    if (f.result === "W" && margin > biggestWin) biggestWin = margin;
    if (f.result === "L" && margin < biggestDefeat) biggestDefeat = margin;
  }

  let seasonVerdict = boardVerdict;
  if (cupOutcome.isWinner) seasonVerdict = "A trophy-winning campaign.";
  else if (position <= 4 && !cupOutcome.isWinner) {
    seasonVerdict = "Strong league finish — cup disappointment.";
  }

  return {
    seasonYear: career.seasonYear,
    position,
    wins: career.wins,
    losses: career.losses,
    pointsFor: career.teamSeasonStats.pointsFor,
    pointsAgainst: career.teamSeasonStats.pointsAgainst,
    pointsDifference: career.teamSeasonStats.pointsDifference,
    boardVerdict,
    budgetChange,
    trophies,
    bestPlayerId,
    topTryScorerId,
    challengeCupResult: cupOutcome.label,
    biggestWin,
    biggestDefeat,
    averageAttendance: avgAttendance,
    highestAttendance: sa.high,
    lowestAttendance: sa.count > 0 ? sa.low : 0,
    finalFanMood: career.attendanceData.fanMood,
    wageBill: career.wageBill,
    expiringContracts: expiring,
    playersLeaving: leaving.map(
      (id) => getPlayerById(id)?.name ?? id
    ),
    seasonVerdict,
  };
}

export function advanceToNextSeason(career: ManagerCareer): ManagerCareer {
  const summary = buildSeasonSummary(career);
  const { career: afterContracts, leaving } = tickContractsForNewSeason(career);

  let boardConfidence = afterContracts.boardConfidence;
  if (leaving.length >= 3) boardConfidence = Math.max(0, boardConfidence - 10);
  else if (leaving.length > 0) boardConfidence = Math.max(0, boardConfidence - 4);

  const newSeed = `${career.seed}-s${career.seasonYear + 1}`;
  const squadIdSet = new Set(afterContracts.squad.map((p) => p.playerId));

  const next: ManagerCareer = {
    ...afterContracts,
    seasonYear: career.seasonYear + 1,
    seed: newSeed,
    budget: afterContracts.budget + summary.budgetChange,
    clubFundsEarned: afterContracts.clubFundsEarned + summary.budgetChange,
    boardConfidence: Math.min(85, boardConfidence + 10),
    schedule: buildManagerSchedule(career.club, newSeed),
    fixtures: [],
    roundMatches: [],
    gameWeek: 0,
    currentFixtureIndex: 0,
    currentRound: 0,
    wins: 0,
    losses: 0,
    teamSeasonStats: { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: {},
    recentForm: [],
    isSeasonComplete: false,
    seasonHistory: [...career.seasonHistory, summary],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    gateIncomeHistory: [],
    attendanceData: createClubAttendanceData(career.club),
    seasonAttendance: { total: 0, count: 0, high: 0, low: 0 },
    challengeCup: createManagerChallengeCup(newSeed, career.club),
    transferMarket: generateTransferMarket(
      career.club,
      squadIdSet,
      newSeed,
      0
    ),
    squad: afterContracts.squad.map((p) => ({
      ...p,
      seasonAppearances: 0,
      seasonTries: 0,
      fitness: Math.min(100, p.fitness + 20),
    })),
    leagueTable: buildLeagueTableFromMatches([], career.club),
    updatedAt: new Date().toISOString(),
  };

  persistCareer(next);
  return next;
}
