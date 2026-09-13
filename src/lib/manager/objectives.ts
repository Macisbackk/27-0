/**
 * Board objective progress — updated weekly after matches and finances tick.
 *
 * League targets settle at end of regular season / season_end (not mid-table luck).
 * Youth targets count first-team apps by academy graduates, including those
 * already promoted into reserves/first.
 */

import { CALENDAR_RULES } from "./rules";
import type {
  BoardObjective,
  ManagerClub,
  ManagerCompetition,
  ManagerFixture,
  ManagerState,
} from "./types";

function sortStandings(competition: ManagerCompetition) {
  return [...competition.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.pointsDifference - a.pointsDifference;
  });
}

/** Regular season table is final once every club has played all league rounds, or post-season has begun. */
export function isRegularSeasonSettled(
  state: ManagerState,
  competition: ManagerCompetition
): boolean {
  if (state.calendar.phase === "playoffs" || state.calendar.phase === "season_end") {
    return true;
  }
  if (!competition.standings.length) return false;
  const minPlayed = Math.min(...competition.standings.map((s) => s.played));
  return minPlayed >= CALENDAR_RULES.REGULAR_SEASON_WEEKS;
}

export function isSeasonFullySettled(state: ManagerState): boolean {
  return (
    state.calendar.phase === "season_end" ||
    state.calendar.currentWeek > CALENDAR_RULES.TOTAL_WEEKS
  );
}

function clubAppearedInRound(
  fixtures: ManagerFixture[] | undefined,
  clubId: string,
  roundPattern: RegExp
): boolean {
  if (!fixtures) return false;
  return fixtures.some(
    (f) =>
      f.isPlayed &&
      roundPattern.test(f.roundName || "") &&
      (f.homeClubId === clubId || f.awayClubId === clubId)
  );
}

function clubWonFixture(
  fixtures: ManagerFixture[] | undefined,
  clubId: string,
  roundPattern: RegExp
): boolean {
  if (!fixtures) return false;
  return fixtures.some((f) => {
    if (!f.isPlayed || !roundPattern.test(f.roundName || "")) return false;
    if (f.homeClubId !== clubId && f.awayClubId !== clubId) return false;
    const home = f.homeScore || 0;
    const away = f.awayScore || 0;
    if (home === away) return false;
    return f.homeClubId === clubId ? home > away : away > home;
  });
}

function updateLeagueObjective(
  objective: BoardObjective,
  club: ManagerClub,
  competition: ManagerCompetition | undefined,
  state: ManagerState
): BoardObjective {
  if (!competition) return objective;
  const sorted = sortStandings(competition);
  const rank = sorted.findIndex((s) => s.clubId === club.id) + 1;
  if (rank <= 0) return objective;

  const targetRank =
    typeof objective.targetValue === "number" ? objective.targetValue : 6;
  const title = objective.title;
  const rsSettled = isRegularSeasonSettled(state, competition);
  const seasonDone = isSeasonFullySettled(state);

  const slFixtures = state.competitions["super-league"]?.fixtures;
  const champFixtures = state.competitions["championship"]?.fixtures;
  const reachedGrandFinal = clubAppearedInRound(
    slFixtures,
    club.id,
    /grand\s*final/i
  );
  const wonMpgAsChamp = clubWonFixture(
    slFixtures,
    club.id,
    /million\s*pound\s*game/i
  );
  // Championship side is away by convention; also accept either side if they won and are Champ
  const mpgWinForPromotion =
    club.competitionId === "championship" &&
    (wonMpgAsChamp ||
      clubWonFixture(champFixtures, club.id, /million\s*pound\s*game/i));

  let isCompleted = objective.isCompleted;
  let isFailed = objective.isFailed;

  // --- Progress only mid-season (except GF appearance / locked auto-promotion) ---
  if (/grand\s*final/i.test(title)) {
    // Compete for GF: top-4 after RS, or actually reach the Grand Final
    if (reachedGrandFinal || (rsSettled && rank <= Math.min(4, targetRank))) {
      isCompleted = true;
      isFailed = false;
    } else if (seasonDone && !reachedGrandFinal && rank > Math.min(4, targetRank)) {
      isFailed = true;
    }
  } else if (/promotion/i.test(title)) {
    const finishedFirst = rsSettled && sorted[0]?.clubId === club.id;
    if (finishedFirst || mpgWinForPromotion) {
      isCompleted = true;
      isFailed = false;
    } else if (seasonDone && club.competitionId === "championship") {
      isFailed = true;
    }
  } else if (/top\s*6|play-?off/i.test(title)) {
    if (rsSettled) {
      if (rank <= targetRank) {
        isCompleted = true;
        isFailed = false;
      } else {
        isFailed = true;
      }
    }
  } else if (/avoid relegation|bottom/i.test(title)) {
    // Super League: 14th auto-down; 13th must survive The Million Pound Game.
    // targetValue (typically 13) is the last "still fighting" place — only 12th+ is safe after RS.
    const n = sorted.length;
    const autoRelegationRank = n;
    const millionPoundRank = Math.max(1, n - 1);
    const safeRank = Math.min(targetRank - 1, millionPoundRank - 1); // usually 12

    if (rsSettled && rank === autoRelegationRank) {
      isFailed = true;
      isCompleted = false;
    } else if (rsSettled && rank <= safeRank) {
      isCompleted = true;
      isFailed = false;
    } else if (rank === millionPoundRank || (rsSettled && rank > safeRank && rank < autoRelegationRank)) {
      const lostMpg =
        clubAppearedInRound(slFixtures, club.id, /million\s*pound\s*game/i) &&
        !clubWonFixture(slFixtures, club.id, /million\s*pound\s*game/i);
      const wonMpg = clubWonFixture(slFixtures, club.id, /million\s*pound\s*game/i);

      if (wonMpg) {
        isCompleted = true;
        isFailed = false;
      } else if (lostMpg || seasonDone) {
        isFailed = true;
        isCompleted = false;
      }
      // else: MPG still to play — leave unsettled
    }
  } else if (/consolidate/i.test(title)) {
    if (rsSettled) {
      if (rank <= targetRank) {
        isCompleted = true;
        isFailed = false;
      } else {
        isFailed = true;
      }
    }
  }

  return {
    ...objective,
    currentValue: rank,
    isCompleted,
    isFailed,
  };
}

function cupRoundRank(roundLabel: string): number {
  const label = roundLabel.toLowerCase();
  if (/grand\s*final/.test(label)) return 100;
  if (/\bfinal\b/.test(label) && !/semi|quarter/.test(label)) return 90;
  if (/semi/.test(label)) return 70;
  if (/quarter/.test(label)) return 50;
  if (/round\s*5|last\s*16/.test(label)) return 40;
  if (/round\s*4/.test(label)) return 30;
  if (/round\s*3/.test(label)) return 20;
  if (/round\s*[12]/.test(label)) return 10;
  return 0;
}

function cupTargetRank(
  target: BoardObjective["targetValue"],
  title: string,
  description: string
): number {
  const text = `${String(target || "")} ${title} ${description}`.toLowerCase();
  if (/win|champion|lift|trophy/.test(text) && /cup|final/.test(text)) return 100;
  if (/grand\s*final/.test(text)) return 100;
  if (/\bfinal\b/.test(text) && !/semi|quarter/.test(text)) return 90;
  if (/semi/.test(text)) return 70;
  if (/quarter/.test(text)) return 50;
  if (/round\s*5|last\s*16|progress/.test(text)) return 40;
  return 40;
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
  const reached = cupRoundRank(roundLabel);
  const target = cupTargetRank(
    objective.targetValue,
    objective.title,
    objective.description
  );

  let isCompleted = objective.isCompleted;
  let isFailed = objective.isFailed;

  if (latest.isPlayed) {
    const won =
      (latest.homeClubId === clubId && (latest.homeScore || 0) > (latest.awayScore || 0)) ||
      (latest.awayClubId === clubId && (latest.awayScore || 0) > (latest.homeScore || 0));

    if (won && reached >= target) {
      isCompleted = true;
      isFailed = false;
    } else if (!won && reached < target) {
      isFailed = true;
    } else if (!won && reached >= target) {
      if (reached >= 90) {
        isFailed = true;
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

/**
 * First-team appearance total for academy graduates of this club
 * (still on the books), including players already promoted to first/reserves.
 */
export function countAcademyGraduateFirstTeamApps(
  state: ManagerState,
  clubId: string
): number {
  let apps = 0;
  for (const p of Object.values(state.players)) {
    if (p.clubId !== clubId) continue;
    const isGraduate =
      p.academyProductOfClubId === clubId ||
      // Legacy saves: still sitting in academy count as products
      (p.squadTier === "academy" && !p.academyProductOfClubId);
    if (!isGraduate) continue;
    apps += p.stats?.apps || 0;
  }
  return apps;
}

function updateYouthObjective(
  objective: BoardObjective,
  clubId: string,
  state: ManagerState
): BoardObjective {
  const graduateApps = countAcademyGraduateFirstTeamApps(state, clubId);
  const target =
    typeof objective.targetValue === "number" ? objective.targetValue : 5;

  let isCompleted = graduateApps >= target;
  let isFailed = objective.isFailed;
  if (!isCompleted && isSeasonFullySettled(state)) {
    isFailed = true;
  }
  if (isCompleted) isFailed = false;

  return {
    ...objective,
    currentValue: graduateApps,
    isCompleted,
    isFailed,
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
        return updateLeagueObjective(obj, club, competition, state);
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

  let confidenceDelta = 0;
  for (const obj of objectives) {
    const prev = club.boardObjectives?.find((o) => o.id === obj.id);
    if (obj.isCompleted && prev && !prev.isCompleted) {
      confidenceDelta +=
        obj.importance === "critical" ? 5 : obj.importance === "high" ? 3 : 2;
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

/**
 * Backfill academyProductOfClubId for legacy saves / current academy members.
 */
export function backfillAcademyProductFlags(state: ManagerState): ManagerState {
  let changed = false;
  const players = { ...state.players };
  for (const [id, p] of Object.entries(players)) {
    if (p.squadTier === "academy" && p.clubId && !p.academyProductOfClubId) {
      players[id] = { ...p, academyProductOfClubId: p.clubId };
      changed = true;
    }
  }
  return changed ? { ...state, players } : state;
}
