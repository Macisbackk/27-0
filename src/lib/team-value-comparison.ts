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
  getBracketTeamTournamentStats,
  type BracketTeamTournamentStats,
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

function normalizeTeamKey(name: string): string {
  return name.trim().toLowerCase();
}

function isUserTeamName(name: string, userTeamName: string): boolean {
  return normalizeTeamKey(name) === normalizeTeamKey(userTeamName);
}

/** Unique opponents from completed user fixtures, excluding the user's own team. */
function getFacedOpponents(
  fixtures: MatchFixture[],
  userTeamName: string
): string[] {
  const opponents = new Set<string>();
  for (const fixture of fixtures) {
    const opp = fixture.opponent?.trim();
    if (!opp || isUserTeamName(opp, userTeamName)) continue;
    opponents.add(opp);
  }
  return [...opponents];
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
  eraTeamRatings: Record<string, number>,
  userTeamName: string
): TeamRatingEntry | null {
  let best: TeamRatingEntry | null = null;

  for (const name of getFacedOpponents(fixtures, userTeamName)) {
    const rating = eraTeamRatings[name];
    if (rating === undefined) continue;
    if (!best || rating > best.rating) {
      best = { name, rating, tier: getTeamTier(rating) };
    }
  }

  return best;
}

function getEraMostExpensiveOpposition(
  fixtures: MatchFixture[],
  eraTeamValues: Record<string, number>,
  userTeamName: string
): TeamValueEntry | null {
  let best: TeamValueEntry | null = null;

  for (const name of getFacedOpponents(fixtures, userTeamName)) {
    const value = eraTeamValues[name];
    if (value === undefined) continue;
    if (!best || value > best.value) {
      best = { name, value };
    }
  }

  return best;
}

function scoreTournamentPerformance(stats: BracketTeamTournamentStats): number {
  return (
    stats.wins * 10_000 +
    stats.pointsFor * 10 +
    stats.triesFor * 5 -
    stats.losses * 100 -
    stats.pointsAgainst
  );
}

/** Best team in the full tournament by bracket results (wins, points, tries). */
export function getBestTournamentTeam(
  bracketMatches: BracketMatch[],
  userTeamName: string,
  userRating: number,
  userFixtureStats: BracketTeamTournamentStats,
  eraTeamRatings?: Record<string, number>
): TeamRatingEntry {
  const bracketStats = getBracketTeamTournamentStats(bracketMatches);
  if (!bracketStats.has(userTeamName)) {
    bracketStats.set(userTeamName, userFixtureStats);
  }

  let best: TeamRatingEntry = {
    name: userTeamName,
    rating: userRating,
    tier: getTeamTier(userRating),
  };
  let bestScore = scoreTournamentPerformance(userFixtureStats);

  for (const [name, stats] of bracketStats) {
    const rating = eraTeamRatings?.[name] ?? userRating;
    const score = scoreTournamentPerformance(stats);
    if (score > bestScore || (score === bestScore && rating > best.rating)) {
      bestScore = score;
      best = { name, rating, tier: getTeamTier(rating) };
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

function isInvalidOpponentName(name: string): boolean {
  return name === "—" || name === "N/A" || !name.trim();
}

/** Highest squad value among playable opposition clubs faced. */
export function getMostExpensiveOpposition(
  fixtures: MatchFixture[],
  seed: string,
  options?: {
    eraMode?: boolean;
    eraTeamValues?: Record<string, number>;
    userTeamName?: string;
  }
): TeamValueEntry | null {
  if (options?.eraMode && options.eraTeamValues && options.userTeamName) {
    return getEraMostExpensiveOpposition(
      fixtures,
      options.eraTeamValues,
      options.userTeamName
    );
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
    for (const name of getFacedOpponents(fixtures, userTeamName)) {
      const oppValue = options.eraTeamValues[name];
      if (oppValue === undefined) continue;
      const prev = teams.get(name) ?? 0;
      teams.set(name, Math.max(prev, oppValue));
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
    userTeamName?: string;
  }
): TeamRatingEntry | null {
  if (options?.eraMode && options.eraTeamRatings && options.userTeamName) {
    return getEraStrongestOpposition(
      fixtures,
      options.eraTeamRatings,
      options.userTeamName
    );
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
    for (const name of getFacedOpponents(fixtures, userTeamName)) {
      const rating = options.eraTeamRatings[name];
      if (rating === undefined) continue;
      const prev = teams.get(name) ?? 0;
      teams.set(name, Math.max(prev, rating));
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
    userTeamName,
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

  const cupMode = options.cupMode === true;
  const bracketMatches = options.bracketMatches ?? [];

  const userBracketStats: BracketTeamTournamentStats =
    bracketMatches.length > 0
      ? (getBracketTeamTournamentStats(bracketMatches).get(userTeamName) ?? {
          name: userTeamName,
          wins: options.wins,
          losses: options.losses,
          pointsFor: fixtures.reduce((sum, f) => sum + f.pointsFor, 0),
          pointsAgainst: fixtures.reduce((sum, f) => sum + f.pointsAgainst, 0),
          triesFor: fixtures.reduce((sum, f) => sum + f.triesFor, 0),
          triesAgainst: fixtures.reduce((sum, f) => sum + f.triesAgainst, 0),
        })
      : {
          name: userTeamName,
          wins: options.wins,
          losses: options.losses,
          pointsFor: fixtures.reduce((sum, f) => sum + f.pointsFor, 0),
          pointsAgainst: fixtures.reduce((sum, f) => sum + f.pointsAgainst, 0),
          triesFor: fixtures.reduce((sum, f) => sum + f.triesFor, 0),
          triesAgainst: fixtures.reduce((sum, f) => sum + f.triesAgainst, 0),
        };

  const bestTournamentTeam =
    cupMode && !eraMode && bracketMatches.length > 0
      ? getBestTournamentTeam(
          bracketMatches,
          userTeamName,
          userRating,
          userBracketStats,
          options.eraTeamRatings
        )
      : null;

  const strongestOpponent = eraMode
    ? getEraStrongestOpposition(
        fixtures,
        options.eraTeamRatings ?? {},
        userTeamName
      ) ?? { name: "N/A", rating: 0, tier: "—" }
    : bestTournamentTeam
      ? bestTournamentTeam
      : getStrongestOpposition(fixtures, seed, eraOpts) ?? {
          name: "—",
          rating: 0,
          tier: "—",
        };
  const useLeagueStats =
    isFullLeagueSeason(fixtures) && options.seasonResult != null;

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
          oppWinPct: isInvalidOpponentName(strongestOpponent.name)
              ? "—"
              : eraMode
                ? getHeadToHeadWinPct(strongestOpponent.name, fixtures)
                : bracketMatches.length > 0
                  ? (() => {
                      const stats = getBracketTeamTournamentStats(
                        bracketMatches
                      ).get(strongestOpponent.name);
                      if (!stats) return "—";
                      return formatWinPercentage(stats.wins, stats.losses);
                    })()
                  : "—",
          oppTries: isInvalidOpponentName(strongestOpponent.name)
              ? 0
              : eraMode
                ? getHeadToHeadTries(strongestOpponent.name, fixtures, "opponent")
                : getClubBracketTriesScored(strongestOpponent.name, bracketMatches),
          oppTriesConceded: isInvalidOpponentName(strongestOpponent.name)
              ? 0
              : eraMode
                ? getHeadToHeadTries(strongestOpponent.name, fixtures, "user")
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
  const strongestOpponentValue = isInvalidOpponentName(strongestOpponent.name)
    ? 0
    : eraMode && options.eraTeamValues?.[strongestOpponent.name] !== undefined
      ? options.eraTeamValues[strongestOpponent.name]
      : getOpponentSquadValue(strongestOpponent.name, seed, oppRound);

  const ratingCompare = isInvalidOpponentName(strongestOpponent.name)
    ? "user"
    : userRating > strongestOpponent.rating + 0.05
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
      topPlayer: isInvalidOpponentName(strongestOpponent.name)
          ? { name: "N/A", rating: 0 }
          : getTopPlayerFromSquad(resolvedOppClub, seed, oppRound),
    },
    strongestOpponent,
    mostExpensiveTeam,
    mostExpensiveOpponent,
    ratingEdge,
    useTriesConceded: cupMode,
  };
}
