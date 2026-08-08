import seedrandom from "seedrandom";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { stripDailyChallengeCloneLabel } from "../clubs/club-match";
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

/** Unique clone labels for the all-one-club daily challenge league. */
export function buildForcedOpponentCloneNames(forcedClub: string): string[] {
  const base = forcedClub.trim();
  return Array.from(
    { length: LEAGUE_OPPONENT_COUNT },
    (_, i) => `${base} (${i + 1})`
  );
}

export function getForcedSeasonLeagueClubs(forcedClub: string): {
  leagueTeams: string[];
  opponentClubs: string[];
  replacedTeam: string;
} {
  const replacedTeam = forcedClub.trim();
  const opponentClubs = buildForcedOpponentCloneNames(replacedTeam);
  return {
    leagueTeams: [DREAM_TEAM_NAME, ...opponentClubs],
    opponentClubs,
    replacedTeam,
  };
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

export function resolveSeasonLeagueTeams(
  seed: string,
  forceOpponentClub?: string | null
): string[] {
  const forced = forceOpponentClub?.trim();
  if (forced) {
    return getForcedSeasonLeagueClubs(forced).leagueTeams;
  }
  return getSeasonLeagueClubs(seed).leagueTeams;
}

/**
 * Infer daily-challenge forced club from season fixtures / result flag.
 * Supports new "Club (n)" clones and legacy runs where every opponent
 * shared one plain club name.
 */
export function inferForceOpponentClub(input: {
  forceOpponentClub?: string | null;
  fixtures?: { opponent: string }[];
}): string | undefined {
  const explicit = input.forceOpponentClub?.trim();
  if (explicit) return explicit;

  const opponents = (input.fixtures ?? [])
    .map((f) => f.opponent?.trim())
    .filter(Boolean) as string[];
  if (opponents.length < 10) return undefined;

  const bases = opponents.map(stripDailyChallengeCloneLabel);
  const first = bases[0]!;
  if (!bases.every((b) => b === first)) return undefined;

  // All clones of one club, or legacy identical plain names.
  return first;
}
