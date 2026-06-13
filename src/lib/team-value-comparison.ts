import {
  DREAM_TEAM_NAME,
  SEASON_GAMES,
  type MatchFixture,
  type SeasonResult,
} from "./game/season-simulation";
import {
  buildTeamSeasonStats,
  getHeadToHeadTries,
} from "./game/team-season-stats";
import {
  getOpponentSquadValue,
  getOpponentTeamSummary,
  selectClubMatchSquad,
} from "./game/opponent-scorers";
import { isPlayableClub } from "./clubs/super-league-display";
import { resolveEraTeamClubName } from "./players/era-teams";
import { getEffectivePeakRating } from "./squad-analysis";
import { getTeamTier } from "./team-tiers";
import type { BracketMatch } from "./game/challenge-cup-bracket";
import {
  getClubBracketTriesConceded,
  getClubBracketTriesScored,
} from "./game/challenge-cup-stats";
import type { SquadSlot } from "./types";

export interface TeamValueEntry {
  name: string;
  value: number;
}

export interface TeamRatingEntry {
  name: string;
  rating: number;
  tier: string;
}

export interface TeamComparisonSummary {
  myTeamRating: number;
  myTeamTier: string;
  myTeamValue: number;
  bestRatedTeam: TeamRatingEntry;
  mostExpensiveTeam: TeamValueEntry;
}

export interface TeamPlayerHighlight {
  name: string;
  rating: number;
}

export interface TeamSideDisplay {
  name: string;
  rating: number;
  tier: string;
  value: number;
  winPct: string;
  totalTries: number;
  triesConceded: number;
  topPlayer: TeamPlayerHighlight;
}

export interface ExtendedTeamComparison {
  user: TeamSideDisplay;
  opponent: TeamSideDisplay;
  strongestOpponent: TeamRatingEntry;
  mostExpensiveTeam: TeamValueEntry;
  mostExpensiveOpponent: TeamValueEntry | null;
  ratingEdge: "user" | "opponent" | "tie";
  /** Challenge Cup comparisons use tries conceded instead of win %. */
  useTriesConceded?: boolean;
}

function playableFixtures(
  fixtures: MatchFixture[],
  eraMode?: boolean
): MatchFixture[] {
  if (eraMode) return fixtures;
  return fixtures.filter((fixture) => isPlayableClub(fixture.opponent));
}

function getEraStrongestOpposition(
  fixtures: MatchFixture[],
  eraTeamRatings: Record<string, number>
): TeamRatingEntry | null {
  let best: TeamRatingEntry | null = null;

  for (const fixture of fixtures) {
    const rating = eraTeamRatings[fixture.opponent];
    if (rating === undefined) continue;
    if (!best || rating > best.rating) {
      best = { name: fixture.opponent, rating, tier: getTeamTier(rating) };
    }
  }

  return best;
}

function getEraMostExpensiveOpposition(
  fixtures: MatchFixture[],
  eraTeamValues: Record<string, number>
): TeamValueEntry | null {
  let best: TeamValueEntry | null = null;

  for (const fixture of fixtures) {
    const value = eraTeamValues[fixture.opponent];
    if (value === undefined) continue;
    if (!best || value > best.value) {
      best = { name: fixture.opponent, value };
    }
  }

  return best;
}

function getTopPlayerFromSquad(
  club: string,
  seed: string,
  round: number
): TeamPlayerHighlight {
  const squad = selectClubMatchSquad(club, seed, round);
  if (squad.length === 0) return { name: "—", rating: 0 };
  const best = squad.reduce((a, b) =>
    b.peakRating > a.peakRating ? b : a
  );
  return { name: best.name, rating: best.peakRating };
}

function getUserTopPlayer(squad: SquadSlot[]): TeamPlayerHighlight {
  let best: TeamPlayerHighlight = { name: "—", rating: 0 };
  for (const slot of squad) {
    if (!slot.player) continue;
    const rating = getEffectivePeakRating(slot);
    if (rating > best.rating) {
      best = { name: slot.player.name, rating };
    }
  }
  return best;
}

function getHeadToHeadWinPct(
  opponentName: string,
  fixtures: MatchFixture[]
): string {
  const vsUser = fixtures.filter((f) => f.opponent === opponentName);
  if (vsUser.length === 0) return "—";
  const oppWins = vsUser.filter((f) => f.result === "L").length;
  return `${Math.round((oppWins / vsUser.length) * 100)}%`;
}

function isFullLeagueSeason(fixtures: MatchFixture[]): boolean {
  return fixtures.length === SEASON_GAMES;
}

function getComparisonStatsFromSeason(
  seasonResult: SeasonResult,
  seed: string,
  opponentName: string
): {
  userWinPct: string;
  userTries: number;
  userTriesConceded: number;
  oppWinPct: string;
  oppTries: number;
  oppTriesConceded: number;
} {
  const statsMap = buildTeamSeasonStats(seasonResult, seed);
  const userStats = statsMap.get(DREAM_TEAM_NAME);
  const oppStats = statsMap.get(opponentName);

  return {
    userWinPct: userStats
      ? formatWinPercentage(userStats.wins, userStats.losses)
      : "—",
    userTries: userStats?.triesFor ?? 0,
    userTriesConceded: userStats?.triesAgainst ?? 0,
    oppWinPct: oppStats
      ? formatWinPercentage(oppStats.wins, oppStats.losses)
      : "—",
    oppTries: oppStats?.triesFor ?? 0,
    oppTriesConceded: oppStats?.triesAgainst ?? 0,
  };
}

function findBestOpponentRound(
  opponentName: string,
  fixtures: MatchFixture[],
  seed: string
): number {
  let bestRound = fixtures[0]?.round ?? 1;
  let bestRating = 0;
  for (const fixture of fixtures) {
    if (fixture.opponent !== opponentName) continue;
    const opp = getOpponentTeamSummary(
      fixture.opponent,
      seed,
      fixture.round
    );
    if (opp.averageRating > bestRating) {
      bestRating = opp.averageRating;
      bestRound = fixture.round;
    }
  }
  return bestRound;
}

export function formatWinPercentage(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

function getEraOpponentsFromFixtures(fixtures: MatchFixture[]): string[] {
  const opponents = new Set<string>();
  for (const fixture of fixtures) {
    if (fixture.opponent) opponents.add(fixture.opponent);
  }
  return [...opponents];
}

function getStrongestEraOpposition(
  fixtures: MatchFixture[],
  eraTeamRatings: Record<string, number>
): TeamRatingEntry | null {
  const opponents = getEraOpponentsFromFixtures(fixtures);
  let best: TeamRatingEntry | null = null;

  for (const name of opponents) {
    const rating = eraTeamRatings[name];
    if (rating === undefined) continue;
    if (!best || rating > best.rating) {
      best = { name, rating, tier: getTeamTier(rating) };
    }
  }

  return best;
}

function getMostExpensiveEraOpposition(
  fixtures: MatchFixture[],
  eraTeamValues: Record<string, number>
): TeamValueEntry | null {
  const opponents = getEraOpponentsFromFixtures(fixtures);
  let best: TeamValueEntry | null = null;

  for (const name of opponents) {
    const value = eraTeamValues[name];
    if (value === undefined) continue;
    if (!best || value > best.value) {
      best = { name, value };
    }
  }

  return best;
}

/** Highest squad value among playable opposition clubs faced. */
export function getMostExpensiveOpposition(
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamValues?: Record<string, number>;
  }
): TeamValueEntry | null {
  if (options?.eraMode && options.eraTeamValues) {
    return getEraMostExpensiveOpposition(fixtures, options.eraTeamValues);
  }

  const teams = new Map<string, number>();

  for (const fixture of playableFixtures(fixtures, options?.eraMode)) {
    const oppValue = getOpponentSquadValue(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, oppValue));
  }

  let best: TeamValueEntry | null = null;
  for (const [name, value] of teams) {
    if (!best || value > best.value) {
      best = { name, value };
    }
  }
  return best;
}

export function getMostExpensiveTeam(
  userTeamName: string,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamValues?: Record<string, number>;
  }
): TeamValueEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userValue);

  if (options?.eraMode && options.eraTeamValues) {
    for (const fixture of fixtures) {
      const oppValue = options.eraTeamValues[fixture.opponent];
      if (oppValue === undefined) continue;
      const prev = teams.get(fixture.opponent) ?? 0;
      teams.set(fixture.opponent, Math.max(prev, oppValue));
    }
  } else {
    for (const fixture of playableFixtures(fixtures, options?.eraMode)) {
      const oppValue = getOpponentSquadValue(
        fixture.opponent,
        seed,
        fixture.round
      );
      const prev = teams.get(fixture.opponent) ?? 0;
      teams.set(fixture.opponent, Math.max(prev, oppValue));
    }
  }

  let best: TeamValueEntry = { name: userTeamName, value: userValue };
  for (const [name, value] of teams) {
    if (value > best.value) best = { name, value };
  }
  return best;
}

/** Strongest average match-day rating among playable opposition clubs faced. */
export function getStrongestOpposition(
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamRatings?: Record<string, number>;
  }
): TeamRatingEntry | null {
  if (options?.eraMode && options.eraTeamRatings) {
    return getEraStrongestOpposition(fixtures, options.eraTeamRatings);
  }
  return getBestOppositionRatedTeam(fixtures, seed, options);
}

/** Best average match-day rating among generated opposition clubs only. */
export function getBestOppositionRatedTeam(
  fixtures: MatchFixture[],
  seed: string,
  options?: { eraMode?: boolean }
): TeamRatingEntry | null {
  const teams = new Map<string, number>();

  for (const fixture of playableFixtures(fixtures, options?.eraMode)) {
    const opp = getOpponentTeamSummary(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, opp.averageRating));
  }

  if (teams.size === 0) return null;

  let best: TeamRatingEntry = { name: "", rating: 0, tier: "—" };
  for (const [name, rating] of teams) {
    if (rating > best.rating) {
      best = { name, rating, tier: getTeamTier(rating) };
    }
  }
  return best.name ? best : null;
}

export function getBestRatedTeam(
  userTeamName: string,
  userRating: number,
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamRatings?: Record<string, number>;
  }
): TeamRatingEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userRating);

  if (options?.eraMode && options.eraTeamRatings) {
    for (const fixture of fixtures) {
      const rating = options.eraTeamRatings[fixture.opponent];
      if (rating === undefined) continue;
      const prev = teams.get(fixture.opponent) ?? 0;
      teams.set(fixture.opponent, Math.max(prev, rating));
    }
  } else {
    for (const fixture of playableFixtures(fixtures, options?.eraMode)) {
      const opp = getOpponentTeamSummary(
        fixture.opponent,
        seed,
        fixture.round
      );
      const prev = teams.get(fixture.opponent) ?? 0;
      teams.set(fixture.opponent, Math.max(prev, opp.averageRating));
    }
  }

  let best: TeamRatingEntry = {
    name: userTeamName,
    rating: userRating,
    tier: getTeamTier(userRating),
  };
  for (const [name, rating] of teams) {
    if (rating > best.rating) {
      best = { name, rating, tier: getTeamTier(rating) };
    }
  }
  return best;
}

export function getTeamComparisonSummary(
  userTeamName: string,
  userRating: number,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamRatings?: Record<string, number>;
    eraTeamValues?: Record<string, number>;
  }
): TeamComparisonSummary {
  return {
    myTeamRating: userRating,
    myTeamTier: getTeamTier(userRating),
    myTeamValue: userValue,
    bestRatedTeam: getBestRatedTeam(
      userTeamName,
      userRating,
      fixtures,
      seed,
      options
    ),
    mostExpensiveTeam: getMostExpensiveTeam(
      userTeamName,
      userValue,
      fixtures,
      seed,
      options
    ),
  };
}

export function getExtendedTeamComparison(
  userTeamName: string,
  userRating: number,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string,
  options: {
    squad: SquadSlot[];
    wins: number;
    losses: number;
    seasonResult?: SeasonResult;
    cupMode?: boolean;
    bracketMatches?: BracketMatch[];
    eraMode?: boolean;
    eraClubLookup?: Record<string, string>;
    eraTeamRatings?: Record<string, number>;
    eraTeamValues?: Record<string, number>;
  }
): ExtendedTeamComparison {
  const eraMode = options.eraMode === true;
  const eraOpts = {
    eraMode,
    eraTeamRatings: options.eraTeamRatings,
    eraTeamValues: options.eraTeamValues,
    eraClubLookup: options.eraClubLookup,
  };

  const summary = getTeamComparisonSummary(
    userTeamName,
    userRating,
    userValue,
    fixtures,
    seed,
    eraOpts
  );
  const { mostExpensiveTeam } = summary;
  const strongestOpponent =
    getStrongestOpposition(fixtures, seed, eraOpts) ?? {
      name: "—",
      rating: 0,
      tier: "—",
    };
  const useLeagueStats =
    isFullLeagueSeason(fixtures) && options.seasonResult != null;
  const cupMode = options.cupMode === true;
  const bracketMatches = options.bracketMatches ?? [];

  const comparisonStats = useLeagueStats
    ? getComparisonStatsFromSeason(
        options.seasonResult!,
        seed,
        strongestOpponent.name
      )
    : cupMode
      ? {
          userWinPct: formatWinPercentage(options.wins, options.losses),
          userTries: fixtures.reduce((sum, fixture) => sum + fixture.triesFor, 0),
          userTriesConceded: fixtures.reduce(
            (sum, fixture) => sum + fixture.triesAgainst,
            0
          ),
          oppWinPct: "—",
          oppTries:
            strongestOpponent.name === "—"
              ? 0
              : getClubBracketTriesScored(strongestOpponent.name, bracketMatches),
          oppTriesConceded:
            strongestOpponent.name === "—"
              ? 0
              : getClubBracketTriesConceded(
                  strongestOpponent.name,
                  bracketMatches
                ),
        }
      : {
          userWinPct: formatWinPercentage(options.wins, options.losses),
          userTries: getHeadToHeadTries(userTeamName, fixtures, "user"),
          userTriesConceded: fixtures.reduce(
            (sum, fixture) => sum + fixture.triesAgainst,
            0
          ),
          oppWinPct: getHeadToHeadWinPct(strongestOpponent.name, fixtures),
          oppTries: getHeadToHeadTries(strongestOpponent.name, fixtures, "opponent"),
          oppTriesConceded: getHeadToHeadTries(
            strongestOpponent.name,
            fixtures,
            "user"
          ),
        };

  const oppRound = eraMode
    ? fixtures.find((f) => f.opponent === strongestOpponent.name)?.round ?? 1
    : findBestOpponentRound(strongestOpponent.name, fixtures, seed);
  const strongestOpponentValue =
    strongestOpponent.name === "—"
      ? 0
      : eraMode && options.eraTeamValues?.[strongestOpponent.name] !== undefined
        ? options.eraTeamValues[strongestOpponent.name]
        : getOpponentSquadValue(strongestOpponent.name, seed, oppRound);

  const ratingCompare =
    userRating > strongestOpponent.rating + 0.05
      ? "user"
      : userRating < strongestOpponent.rating - 0.05
        ? "opponent"
        : "tie";
  const ratingEdge: ExtendedTeamComparison["ratingEdge"] = ratingCompare;

  const mostExpensiveOpponent =
    getMostExpensiveOpposition(fixtures, seed, eraOpts) ?? {
      name: "N/A",
      value: 0,
    };

  const resolvedOppClub = resolveEraTeamClubName(
    strongestOpponent.name,
    options.eraClubLookup
  );

  return {
    user: {
      name: userTeamName,
      rating: userRating,
      tier: summary.myTeamTier,
      value: userValue,
      winPct: comparisonStats.userWinPct,
      totalTries: comparisonStats.userTries,
      triesConceded: comparisonStats.userTriesConceded,
      topPlayer: getUserTopPlayer(options.squad),
    },
    opponent: {
      name: strongestOpponent.name,
      rating: strongestOpponent.rating,
      tier: strongestOpponent.tier,
      value: strongestOpponentValue,
      winPct: comparisonStats.oppWinPct,
      totalTries: comparisonStats.oppTries,
      triesConceded: comparisonStats.oppTriesConceded,
      topPlayer:
        strongestOpponent.name === "—"
          ? { name: "—", rating: 0 }
          : getTopPlayerFromSquad(resolvedOppClub, seed, oppRound),
    },
    strongestOpponent,
    mostExpensiveTeam,
    mostExpensiveOpponent,
    ratingEdge,
    useTriesConceded: cupMode,
  };
}
