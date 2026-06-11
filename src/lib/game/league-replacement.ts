import seedrandom from "seedrandom";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { DREAM_TEAM_NAME } from "./season-simulation";

const LEAGUE_OPPONENT_COUNT = 13;

export function getActiveOpponentClubNames(): string[] {
  return getPlayableClubNames();
}

/** Picks which real club Dream Team replaces for this season run (seeded per run). */
export function pickReplacedTeamForSeason(seed: string): string {
  const pool = getActiveOpponentClubNames();
  const rng = seedrandom(`${seed}-league-replace`);
  return pool[Math.floor(rng() * pool.length)] ?? pool[0];
}

export function getSeasonLeagueClubs(seed: string): {
  leagueTeams: string[];
  opponentClubs: string[];
  replacedTeam: string;
} {
  const replacedTeam = pickReplacedTeamForSeason(seed);
  const opponentClubs = getActiveOpponentClubNames()
    .filter((c) => c !== replacedTeam)
    .slice(0, LEAGUE_OPPONENT_COUNT);
  const leagueTeams = [DREAM_TEAM_NAME, ...opponentClubs];
  return { leagueTeams, opponentClubs, replacedTeam };
}
