import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";

/** League-wide injury load per AI/user club (mirrors user squad injuries in sim). */
export interface LeagueClubState {
  injuriesOut: number;
}

export type LeagueClubStates = Record<string, LeagueClubState>;

export function initLeagueClubStates(): LeagueClubStates {
  const out: LeagueClubStates = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    out[club] = { injuriesOut: 0 };
  }
  return out;
}

export function ensureLeagueClubStates(
  states: LeagueClubStates | undefined
): LeagueClubStates {
  const base = states ?? initLeagueClubStates();
  const out = { ...base };
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (!out[club]) out[club] = { injuriesOut: 0 };
  }
  return out;
}

/** Rating penalty when key players are out (≈2.5 OVR per absent starter). */
export function getLeagueClubInjuryPenalty(
  states: LeagueClubStates | undefined,
  club: string
): number {
  const n = states?.[club]?.injuriesOut ?? 0;
  return n * 2.8;
}

/**
 * Weekly tick: recovery + fresh injuries for every club before fixtures resolve.
 * Called once per game week.
 */
export function tickWeeklyLeagueClubStates(
  career: {
    seed: string;
    gameWeek: number;
    leagueClubStates?: LeagueClubStates;
  }
): LeagueClubStates {
  const states = ensureLeagueClubStates(career.leagueClubStates);
  const week = career.gameWeek;
  const next: LeagueClubStates = { ...states };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    const rng = seedrandom(`${career.seed}-league-club-${club}-w${week}`);
    const current = next[club] ?? { injuriesOut: 0 };
    let injuriesOut = current.injuriesOut;

    if (injuriesOut > 0 && rng() < 0.42) injuriesOut -= 1;
    if (injuriesOut > 0 && injuriesOut >= 2 && rng() < 0.18) injuriesOut -= 1;

    const fresh =
      rng() < 0.32 ? 1 : rng() < 0.07 ? 2 : rng() < 0.015 ? 3 : 0;
    injuriesOut = Math.min(4, injuriesOut + fresh);

    next[club] = { injuriesOut };
  }

  return next;
}

/** Apply user match injuries onto league state after the user's fixture. */
export function applyUserMatchToLeagueStates(
  states: LeagueClubStates,
  userClub: string,
  opponentClub: string,
  userNewInjuries: number,
  seed: string,
  round: number
): LeagueClubStates {
  const next = { ...states };
  const rng = seedrandom(`${seed}-league-match-${round}-${userClub}-${opponentClub}`);

  if (userNewInjuries > 0) {
    const us = next[userClub] ?? { injuriesOut: 0 };
    next[userClub] = {
      injuriesOut: Math.min(4, us.injuriesOut + userNewInjuries),
    };
  }

  const opp = next[opponentClub] ?? { injuriesOut: 0 };
  const oppExtra = rng() < 0.22 ? 1 : rng() < 0.05 ? 2 : 0;
  next[opponentClub] = {
    injuriesOut: Math.min(4, opp.injuriesOut + oppExtra),
  };

  return next;
}

/** League injury states for the current fixture week (tick once per round). */
export function resolveLeagueClubStatesForFixture(
  career: {
    seed: string;
    leagueClubStates?: LeagueClubStates;
    leagueClubStatesWeek?: number;
  },
  round: number
): LeagueClubStates {
  if (career.leagueClubStatesWeek === round && career.leagueClubStates) {
    return ensureLeagueClubStates(career.leagueClubStates);
  }
  return tickWeeklyLeagueClubStates({ ...career, gameWeek: round });
}
