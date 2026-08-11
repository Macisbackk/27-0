import type { ManagerCompetition } from "./types";

/**
 * Explicit match-resolution rules by competition / fixture type.
 * Do not infer extra time / golden point from a tied score alone.
 */
export type MatchResolutionRules = {
  allowsDraw: boolean;
  extraTimeEnabled: boolean;
  goldenPointEnabled: boolean;
  extraTimeMinutes: number;
  requiresWinner: boolean;
};

/** Manager Mode Super League / Championship regular season — draws allowed. */
export const SUPER_LEAGUE_REGULAR_RULES: MatchResolutionRules = {
  allowsDraw: true,
  extraTimeEnabled: false,
  goldenPointEnabled: false,
  extraTimeMinutes: 0,
  requiresWinner: false,
};

export const CHAMPIONSHIP_REGULAR_RULES: MatchResolutionRules = {
  ...SUPER_LEAGUE_REGULAR_RULES,
};

export const RESERVE_REGULAR_RULES: MatchResolutionRules = {
  ...SUPER_LEAGUE_REGULAR_RULES,
};

/**
 * Knockout / must-have-winner: Challenge Cup, playoffs, WCC, Quick Mode,
 * and Manager friendlies. Level after regulation → golden point.
 */
export const KNOCKOUT_RULES: MatchResolutionRules = {
  allowsDraw: false,
  extraTimeEnabled: true,
  goldenPointEnabled: true,
  extraTimeMinutes: 20,
  requiresWinner: true,
};

/** Quick Mode season fixtures never finish as draws. */
export const QUICK_MODE_RULES: MatchResolutionRules = {
  ...KNOCKOUT_RULES,
};

export const FRIENDLY_RULES: MatchResolutionRules = {
  ...KNOCKOUT_RULES,
};

export type MatchResolutionContext = {
  competition?: ManagerCompetition | null;
  /** Reserve league fixtures are not a ManagerCompetition value. */
  fixtureKind?: "reserve" | "championship_league" | "quick_league";
};

/** Resolve rules from competition ID / fixture type — never from display labels. */
export function getMatchResolutionRules(
  context: MatchResolutionContext
): MatchResolutionRules {
  if (context.fixtureKind === "reserve") return RESERVE_REGULAR_RULES;
  if (context.fixtureKind === "championship_league") {
    return CHAMPIONSHIP_REGULAR_RULES;
  }
  if (context.fixtureKind === "quick_league") return QUICK_MODE_RULES;

  switch (context.competition) {
    case "challenge_cup":
    case "playoffs":
    case "world_club_challenge":
    case "friendly":
      return KNOCKOUT_RULES;
    case "league":
      return SUPER_LEAGUE_REGULAR_RULES;
    default:
      // Unknown competition — require a winner rather than inventing draws.
      return KNOCKOUT_RULES;
  }
}

export function competitionAllowsDraw(
  competition?: ManagerCompetition | null
): boolean {
  return getMatchResolutionRules({ competition }).allowsDraw;
}

export function competitionUsesGoldenPoint(
  competition?: ManagerCompetition | null
): boolean {
  return getMatchResolutionRules({ competition }).goldenPointEnabled;
}

/**
 * Resolve whether the user won a must-have-winner fixture.
 * Never treat a draw (`D`) as an automatic loss — use the scoreline first.
 * Equal scores should already have been broken by golden point; if not,
 * `fallbackUserWins` decides (callers should pass a seeded coin-flip).
 */
export function userWonMustHaveWinnerFixture(
  fixture: {
    result: "W" | "L" | "D";
    pointsFor: number;
    pointsAgainst: number;
  },
  fallbackUserWins = false
): boolean {
  if (fixture.result === "W") return true;
  if (fixture.result === "L") return false;
  if (fixture.pointsFor > fixture.pointsAgainst) return true;
  if (fixture.pointsAgainst > fixture.pointsFor) return false;
  return fallbackUserWins;
}
