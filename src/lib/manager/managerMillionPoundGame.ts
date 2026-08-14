import seedrandom from "seedrandom";
import { getGeneratedClubSquadStrength } from "../game/opponent-squad-strength";
import { getManagerLeagueTable } from "./managerFixtures";
import { isUserInChampionship } from "./leagueMembership";
import { getChampionshipPlayoffWinner } from "./managerChampionshipPlayoffs";
import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import type { ManagerCareer, ManagerScheduledFixture, MillionPoundGameState } from "./types";

export const MILLION_POUND_GAME_NAME = "Million Pound Game";

export function resolveMillionPoundGameClubs(career: ManagerCareer): { slClub: string; champClub: string } | null {
  if (!isLeagueAndCupPhaseComplete(career)) return null;
  const slTable = isUserInChampionship(career)
    ? career.aiSuperLeagueStandings
    : getManagerLeagueTable(career);
  const slClub = slTable?.find((row) => row.position === 11)?.team;
  const champClub = getChampionshipPlayoffWinner(career.championshipPlayoffs);
  if (!slClub || !champClub) return null;
  return { slClub, champClub };
}

export function ensureMillionPoundGameReady(career: ManagerCareer): ManagerCareer {
  if (career.millionPoundGame?.status === "complete") return career;
  const clubs = resolveMillionPoundGameClubs(career);
  if (!clubs) return career;
  const state: MillionPoundGameState = {
    seasonYear: career.seasonYear, ...clubs, homeClub: clubs.slClub, status: "ready",
    userParticipating: career.club === clubs.slClub || career.club === clubs.champClub,
  };
  return { ...career, millionPoundGame: state };
}

export function buildMillionPoundGameScheduledFixture(career: ManagerCareer): ManagerScheduledFixture | null {
  const game = career.millionPoundGame;
  if (!game || game.status !== "ready" || !game.userParticipating) return null;
  const isHome = career.club === game.homeClub;
  return {
    id: `million-pound-game-${game.seasonYear}`, round: career.gameWeek + 1,
    opponent: isHome ? game.champClub : game.slClub, isHome, competition: "million_pound_game",
    label: MILLION_POUND_GAME_NAME, listedHome: game.homeClub,
    listedAway: game.homeClub === game.slClub ? game.champClub : game.slClub,
  };
}

export function applyMillionPoundGameResult(career: ManagerCareer, winnerClub: string): ManagerCareer {
  const game = career.millionPoundGame;
  if (!game || ![game.slClub, game.champClub].includes(winnerClub)) return career;
  const loser = winnerClub === game.slClub ? game.champClub : game.slClub;
  return { ...career, millionPoundGame: { ...game, winner: winnerClub, loser, status: "complete" } };
}

export function isMillionPoundGameComplete(career: ManagerCareer): boolean {
  return career.millionPoundGame?.status === "complete";
}

/** Deterministic AI resolution when neither competing club is user-controlled. */
export function finalizeMillionPoundGameIfNeeded(career: ManagerCareer): ManagerCareer {
  const ready = ensureMillionPoundGameReady(career);
  const game = ready.millionPoundGame;
  if (!game || game.status === "complete" || game.userParticipating) return ready;
  const rng = seedrandom(`${ready.seed}-million-pound-game-${ready.seasonYear}`);
  const slStrength = getGeneratedClubSquadStrength(game.slClub, ready.seed, "season", { currentSeasonOnly: true }) + 3;
  const champStrength = getGeneratedClubSquadStrength(game.champClub, ready.seed, "season", { currentSeasonOnly: true });
  const winner = rng() < 0.5 + (slStrength - champStrength) / 100 ? game.slClub : game.champClub;
  return applyMillionPoundGameResult(ready, winner);
}
