import type { ManagerCompetitionId } from "./types";
import { CHAMPIONSHIP_CLUB_NAMES } from "../clubs/championship-clubs";
import { type ManagerCareer } from "./types";
import {
  getCareerClubsForLeague,
  getDefaultClubsForLeague,
  getLeagueSeasonGames,
  getLinkedPromoteRelegateCount,
} from "./managerLeagues";

export type { ManagerCompetitionId };

/** @deprecated Prefer getLinkedPromoteRelegateCount() from managerLeagues. */
export const PROMOTE_RELEGATE_COUNT = getLinkedPromoteRelegateCount();

export function defaultSuperLeagueClubs(): string[] {
  return getDefaultClubsForLeague("super-league");
}

export function defaultChampionshipClubs(): string[] {
  return getDefaultClubsForLeague("championship");
}

export function getCareerSuperLeagueClubs(career: ManagerCareer): string[] {
  return getCareerClubsForLeague(career, "super-league");
}

export function getCareerChampionshipClubs(career: ManagerCareer): string[] {
  return getCareerClubsForLeague(career, "championship");
}

export function getUserCompetitionId(career: ManagerCareer): ManagerCompetitionId {
  if (career.userCompetitionId === "championship") return "championship";
  if (career.userCompetitionId === "super-league") return "super-league";
  // Legacy saves: infer from static Champ list only when membership unset.
  if (
    !career.superLeagueClubNames &&
    !career.championshipClubNames &&
    CHAMPIONSHIP_CLUB_NAMES.includes(career.club)
  ) {
    return "championship";
  }
  return "super-league";
}

export function resolveClubCompetitionForCareer(
  clubName: string,
  career: ManagerCareer
): ManagerCompetitionId {
  if (getCareerChampionshipClubs(career).includes(clubName)) {
    return "championship";
  }
  if (getCareerSuperLeagueClubs(career).includes(clubName)) {
    return "super-league";
  }
  return getUserCompetitionId(career);
}

export function isUserInChampionship(career: ManagerCareer): boolean {
  return getUserCompetitionId(career) === "championship";
}

/** True when the user is managing in the given competition. */
export function isUserInLeague(
  career: ManagerCareer,
  id: ManagerCompetitionId
): boolean {
  return getUserCompetitionId(career) === id;
}

export function getUserLeagueClubs(career: ManagerCareer): string[] {
  return getCareerClubsForLeague(career, getUserCompetitionId(career));
}

export function getUserSeasonGames(career: ManagerCareer): number {
  return getLeagueSeasonGames(getUserCompetitionId(career));
}

/** Ensure membership arrays + competition id exist on a career. */
export function ensureLeagueMembership(career: ManagerCareer): ManagerCareer {
  const superLeagueClubNames = career.superLeagueClubNames?.length
    ? career.superLeagueClubNames
    : defaultSuperLeagueClubs();
  const championshipClubNames = career.championshipClubNames?.length
    ? career.championshipClubNames
    : defaultChampionshipClubs();
  const userCompetitionId =
    career.userCompetitionId ??
    (CHAMPIONSHIP_CLUB_NAMES.includes(career.club) &&
    championshipClubNames.includes(career.club)
      ? "championship"
      : "super-league");

  if (
    career.superLeagueClubNames === superLeagueClubNames &&
    career.championshipClubNames === championshipClubNames &&
    career.userCompetitionId === userCompetitionId
  ) {
    return career;
  }

  return {
    ...career,
    superLeagueClubNames,
    championshipClubNames,
    userCompetitionId,
  };
}
