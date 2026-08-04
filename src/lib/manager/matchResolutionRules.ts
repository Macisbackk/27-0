import type { ManagerCompetition } from "./types";

/**
 * Explicit match-resolution rules by competition / fixture type.
 * Do not infer extra time from a tied score alone.
 */
export type MatchResolutionRules = {
  allowsDraw: boolean;
  extraTimeEnabled: boolean;
  goldenPointEnabled: boolean;
  extraTimeMinutes: number;
  requiresWinner: boolean;
};

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

export const FRIENDLY_RULES: MatchResolutionRules = {
  ...SUPER_LEAGUE_REGULAR_RULES,
};

export const KNOCKOUT_RULES: MatchResolutionRules = {
  allowsDraw: false,
  extraTimeEnabled: true,
  goldenPointEnabled: true,
  extraTimeMinutes: 20,
  requiresWinner: true,
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
  if (context.fixtureKind === "quick_league") return SUPER_LEAGUE_REGULAR_RULES;

  switch (context.competition) {
    case "challenge_cup":
    case "playoffs":
    case "world_club_challenge":
      return KNOCKOUT_RULES;
    case "friendly":
      return FRIENDLY_RULES;
    case "league":
    default:
      return SUPER_LEAGUE_REGULAR_RULES;
  }
}

export function competitionAllowsDraw(
  competition?: ManagerCompetition | null
): boolean {
  return getMatchResolutionRules({ competition }).allowsDraw;
}
