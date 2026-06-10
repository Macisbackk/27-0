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
import { getEffectivePeakRating } from "./squad-analysis";
import { getTeamTier } from "./team-tiers";
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
  topPlayer: TeamPlayerHighlight;
}

export interface ExtendedTeamComparison {
  user: TeamSideDisplay;
  opponent: TeamSideDisplay;
  mostExpensiveTeam: TeamValueEntry;
  ratingEdge: "user" | "opponent" | "tie";
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
): { userWinPct: string; userTries: number; oppWinPct: string; oppTries: number } {
  const statsMap = buildTeamSeasonStats(seasonResult, seed);
  const userStats = statsMap.get(DREAM_TEAM_NAME);
  const oppStats = statsMap.get(opponentName);

  return {
    userWinPct: userStats
      ? formatWinPercentage(userStats.wins, userStats.losses)
      : "—",
    userTries: userStats?.triesFor ?? 0,
    oppWinPct: oppStats
      ? formatWinPercentage(oppStats.wins, oppStats.losses)
      : "—",
    oppTries: oppStats?.triesFor ?? 0,
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

export function getMostExpensiveTeam(
  userTeamName: string,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string
): TeamValueEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userValue);

  for (const fixture of fixtures) {
    const oppValue = getOpponentSquadValue(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, oppValue));
  }

  let best: TeamValueEntry = { name: userTeamName, value: userValue };
  for (const [name, value] of teams) {
    if (value > best.value) best = { name, value };
  }
  return best;
}

/** Best average match-day rating among generated opposition clubs only. */
export function getBestOppositionRatedTeam(
  fixtures: MatchFixture[],
  seed: string
): TeamRatingEntry | null {
  const teams = new Map<string, number>();

  for (const fixture of fixtures) {
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
  seed: string
): TeamRatingEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userRating);

  for (const fixture of fixtures) {
    const opp = getOpponentTeamSummary(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, opp.averageRating));
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
  seed: string
): TeamComparisonSummary {
  return {
    myTeamRating: userRating,
    myTeamTier: getTeamTier(userRating),
    myTeamValue: userValue,
    bestRatedTeam: getBestRatedTeam(
      userTeamName,
      userRating,
      fixtures,
      seed
    ),
    mostExpensiveTeam: getMostExpensiveTeam(
      userTeamName,
      userValue,
      fixtures,
      seed
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
  }
): ExtendedTeamComparison {
  const summary = getTeamComparisonSummary(
    userTeamName,
    userRating,
    userValue,
    fixtures,
    seed
  );
  const { mostExpensiveTeam } = summary;
  const bestOpposition =
    getBestOppositionRatedTeam(fixtures, seed) ?? {
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
        bestOpposition.name
      )
    : {
        userWinPct: formatWinPercentage(options.wins, options.losses),
        userTries: getHeadToHeadTries(userTeamName, fixtures, "user"),
        oppWinPct: getHeadToHeadWinPct(bestOpposition.name, fixtures),
        oppTries: getHeadToHeadTries(bestOpposition.name, fixtures, "opponent"),
      };

  const oppRound = findBestOpponentRound(bestOpposition.name, fixtures, seed);
  const oppValue =
    bestOpposition.name === "—"
      ? 0
      : getOpponentSquadValue(bestOpposition.name, seed, oppRound);

  const ratingEdge: ExtendedTeamComparison["ratingEdge"] =
    userRating > bestOpposition.rating
      ? "user"
      : userRating < bestOpposition.rating
        ? "opponent"
        : "tie";

  return {
    user: {
      name: userTeamName,
      rating: userRating,
      tier: summary.myTeamTier,
      value: userValue,
      winPct: comparisonStats.userWinPct,
      totalTries: comparisonStats.userTries,
      topPlayer: getUserTopPlayer(options.squad),
    },
    opponent: {
      name: bestOpposition.name,
      rating: bestOpposition.rating,
      tier: bestOpposition.tier,
      value: oppValue,
      winPct: comparisonStats.oppWinPct,
      totalTries: comparisonStats.oppTries,
      topPlayer:
        bestOpposition.name === "—"
          ? { name: "—", rating: 0 }
          : getTopPlayerFromSquad(bestOpposition.name, seed, oppRound),
    },
    mostExpensiveTeam,
    ratingEdge,
  };
}
