/**
 * Authoritative Manager Mode competition-phase state machine.
 * Fixture routing, season-complete checks, and Season Review consume this —
 * UI screens must not invent their own post-season stage.
 */
import type { ManagerCareer, ManagerCompetitionPhase } from "./types";
import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import { isUserInChampionship } from "./leagueMembership";
import {
  getChampionshipPlayoffWinner,
  userQualifiedForChampionshipPlayoffs,
} from "./managerChampionshipPlayoffs";
import {
  isPlayoffsPhaseComplete,
  userQualifiedForManagerPlayoffs,
} from "./managerPlayoffs";
import { isMillionPoundGameComplete } from "./managerMillionPoundGame";

export const COMPETITION_PHASES: readonly ManagerCompetitionPhase[] = [
  "REGULAR_SEASON_ACTIVE",
  "REGULAR_SEASON_COMPLETE",
  "CHAMPIONSHIP_PLAYOFFS_ACTIVE",
  "SL_PLAYOFFS_ACTIVE",
  "MILLION_POUND_GAME_PENDING",
  "MILLION_POUND_GAME_COMPLETE",
  "SEASON_TRANSITION_READY",
  "SEASON_TRANSITION_COMPLETE",
];

function championshipPlayoffsFinished(career: ManagerCareer): boolean {
  return Boolean(getChampionshipPlayoffWinner(career.championshipPlayoffs));
}

function slPlayoffsFinished(career: ManagerCareer): boolean {
  if (!userQualifiedForManagerPlayoffs(career)) {
    return true;
  }
  const playoffs = career.playoffs;
  if (!playoffs) return false;
  return Boolean(playoffs.tournamentComplete) || isPlayoffsPhaseComplete(career);
}

function userNeedsChampionshipPlayoffs(career: ManagerCareer): boolean {
  return (
    isUserInChampionship(career) && userQualifiedForChampionshipPlayoffs(career)
  );
}

function userNeedsMillionPoundGame(career: ManagerCareer): boolean {
  const mpg = career.millionPoundGame;
  if (mpg?.userParticipating) return true;
  if (isUserInChampionship(career) && career.club === mpg?.champClub) {
    return true;
  }
  if (!isUserInChampionship(career) && career.club === mpg?.slClub) {
    return true;
  }
  return false;
}

function userNeedsSlPlayoffs(career: ManagerCareer): boolean {
  return !isUserInChampionship(career) && userQualifiedForManagerPlayoffs(career);
}

/**
 * Derive the current competition phase from completed competitions.
 * Does not mutate career — use syncCompetitionPhase to persist.
 */
export function deriveCompetitionPhase(
  career: ManagerCareer
): ManagerCompetitionPhase {
  if (!isLeagueAndCupPhaseComplete(career)) {
    return "REGULAR_SEASON_ACTIVE";
  }

  const champPoDone = championshipPlayoffsFinished(career);
  const mpgDone = isMillionPoundGameComplete(career);
  const slPoDone = slPlayoffsFinished(career);

  if (userNeedsChampionshipPlayoffs(career) && !champPoDone) {
    const bracket = career.championshipPlayoffs;
    if (bracket && !bracket.userEliminated && !bracket.tournamentComplete) {
      return "CHAMPIONSHIP_PLAYOFFS_ACTIVE";
    }
    if (!bracket || !champPoDone) {
      return "CHAMPIONSHIP_PLAYOFFS_ACTIVE";
    }
  }

  if (!champPoDone) {
    return "REGULAR_SEASON_COMPLETE";
  }

  if (!mpgDone) {
    if (userNeedsChampionshipPlayoffs(career)) {
      const bracket = career.championshipPlayoffs;
      if (bracket && !bracket.tournamentComplete && !bracket.userEliminated) {
        return "CHAMPIONSHIP_PLAYOFFS_ACTIVE";
      }
    }
    return "MILLION_POUND_GAME_PENDING";
  }

  if (userNeedsSlPlayoffs(career) && !slPoDone) {
    return "SL_PLAYOFFS_ACTIVE";
  }

  if (userNeedsMillionPoundGame(career) && !mpgDone) {
    return "MILLION_POUND_GAME_PENDING";
  }

  return "SEASON_TRANSITION_READY";
}

export function syncCompetitionPhase(career: ManagerCareer): ManagerCareer {
  const phase = deriveCompetitionPhase(career);
  if (career.competitionPhase === phase) return career;
  return {
    ...career,
    competitionPhase: phase,
    isSeasonComplete: phase === "SEASON_TRANSITION_READY",
    updatedAt: new Date().toISOString(),
  };
}

export function isPostSeasonWorldComplete(career: ManagerCareer): boolean {
  return deriveCompetitionPhase(career) === "SEASON_TRANSITION_READY";
}

export function canOpenSeasonReview(career: ManagerCareer): boolean {
  const phase = career.competitionPhase ?? deriveCompetitionPhase(career);
  return phase === "SEASON_TRANSITION_READY";
}

export function markSeasonTransitionComplete(
  career: ManagerCareer
): ManagerCareer {
  return {
    ...career,
    competitionPhase: "REGULAR_SEASON_ACTIVE",
    isSeasonComplete: false,
    seasonTransitionPreviewShown: false,
    updatedAt: new Date().toISOString(),
  };
}
