/**
 * Board objective progress — updated weekly after matches and finances tick.
 */

import type {
  BoardObjective,
  ManagerClub,
  ManagerCompetition,
  ManagerState,
} from "./types";

function updateLeagueObjective(
  objective: BoardObjective,
  club: ManagerClub,
  competition: ManagerCompetition | undefined
): BoardObjective {
  if (!competition) return objective;
  const sorted = [...competition.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.pointsDifference - a.pointsDifference;
  });
  const rank = sorted.findIndex((s) => s.clubId === club.id) + 1;
  if (rank <= 0) return objective;

  const isPromotionTarget =
    club.competitionId === "championship" ||
    /promotion|super league/i.test(objective.title);

  let isCompleted = objective.isCompleted;
  let isFailed = objective.isFailed;
  if (isPromotionTarget) {
    // Championship: top 6 playoffs / promotion race — treat top 2 as on track complete mid-season soft, top 6 as progress
    isCompleted = rank <= 2 && competition.standings.some((s) => s.played >= 20);
    isFailed = false;
  } else if (/top\s*6|play-?off/i.test(objective.title)) {
    isCompleted = rank <= 6 && competition.standings.some((s) => s.played >= 10);
  } else if (/avoid relegation|bottom/i.test(objective.title)) {
    isCompleted = rank <= Math.max(1, sorted.length - 2);
    isFailed = rank > sorted.length - 2 && competition.standings.some((s) => s.played >= 20);
  }

  return {
    ...objective,
    currentValue: rank,
    isCompleted,
    isFailed,
  };
}

function updateCupObjective(
  objective: BoardObjective,
  clubId: string,
  state: ManagerState
): BoardObjective {
  const cup = state.competitions["challenge-cup"];
  if (!cup) return objective;

  const clubFixtures = cup.fixtures
    .filter((f) => f.homeClubId === clubId || f.awayClubId === clubId)
    .sort((a, b) => a.week - b.week);

  if (clubFixtures.length === 0) {
    return { ...objective, currentValue: "Not drawn" };
  }

  const latest = [...clubFixtures].reverse().find((f) => f.isPlayed) || clubFixtures[0];
  const roundLabel = latest.roundName || "Round 1";

  let isCompleted = objective.isCompleted;
  let isFailed = objective.isFailed;

  if (latest.isPlayed) {
    const won =
      (latest.homeClubId === clubId && (latest.homeScore || 0) > (latest.awayScore || 0)) ||
      (latest.awayClubId === clubId && (latest.awayScore || 0) > (latest.homeScore || 0));
    if (!won && /progress|reach|quarter|semi|final/i.test(objective.title + objective.description)) {
      // Still in if they won last; failed if knocked out before target
      const isFinal = /grand final|final/i.test(roundLabel) && !/semi/i.test(roundLabel);
      if (!won) isFailed = !isFinal;
      if (won && isFinal) isCompleted = true;
      if (won && /semi|quarter|final/i.test(roundLabel)) {
        isCompleted =
          isCompleted ||
          (/final/i.test(String(objective.targetValue)) && isFinal) ||
          (/semi/i.test(String(objective.targetValue)) && /semi|final/i.test(roundLabel));
      }
    }
  }

  return {
    ...objective,
    currentValue: roundLabel,
    isCompleted,
    isFailed,
  };
}

function updateYouthObjective(
  objective: BoardObjective,
  clubId: string,
  state: ManagerState
): BoardObjective {
  const academyApps = Object.values(state.players).filter(
    (p) =>
      p.clubId === clubId &&
      (p.squadTier === "academy" || p.squadTier === "reserves") &&
      p.stats.apps > 0 &&
      p.age <= 23
  ).length;

  const target =
    typeof objective.targetValue === "number" ? objective.targetValue : 3;

  return {
    ...objective,
    currentValue: academyApps,
    isCompleted: academyApps >= target,
    isFailed: false,
  };
}

function updateFinancesObjective(
  objective: BoardObjective,
  club: ManagerClub
): BoardObjective {
  const balance = club.finances.balance;
  const target =
    typeof objective.targetValue === "number" ? objective.targetValue : 0;
  return {
    ...objective,
    currentValue: balance,
    isCompleted: balance >= target,
    isFailed: balance < 0,
  };
}

export function refreshClubBoardObjectives(
  state: ManagerState,
  clubId: string
): ManagerClub {
  const club = state.clubs[clubId];
  if (!club) return club;

  const competition = state.competitions[club.competitionId];
  const objectives = (club.boardObjectives || []).map((obj) => {
    if (obj.isCompleted || obj.isFailed) return obj;
    switch (obj.category) {
      case "league":
        return updateLeagueObjective(obj, club, competition);
      case "cup":
        return updateCupObjective(obj, clubId, state);
      case "youth":
        return updateYouthObjective(obj, clubId, state);
      case "finances":
        return updateFinancesObjective(obj, club);
      default:
        return obj;
    }
  });

  // Confidence nudge from objective outcomes
  let confidenceDelta = 0;
  for (const obj of objectives) {
    const prev = club.boardObjectives?.find((o) => o.id === obj.id);
    if (obj.isCompleted && prev && !prev.isCompleted) {
      confidenceDelta += obj.importance === "critical" ? 5 : obj.importance === "high" ? 3 : 2;
    }
    if (obj.isFailed && prev && !prev.isFailed) {
      confidenceDelta -= obj.importance === "critical" ? 6 : 3;
    }
  }

  return {
    ...club,
    boardObjectives: objectives,
    boardConfidence: Math.min(
      100,
      Math.max(10, club.boardConfidence + confidenceDelta)
    ),
  };
}

/** Refresh objectives for every club (user + AI) after the weekly tick. */
export function refreshAllBoardObjectives(state: ManagerState): ManagerState {
  const clubs = { ...state.clubs };
  for (const clubId of Object.keys(clubs)) {
    clubs[clubId] = refreshClubBoardObjectives({ ...state, clubs }, clubId);
  }
  return { ...state, clubs };
}
