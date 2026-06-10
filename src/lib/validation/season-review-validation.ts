import type { SquadSlot } from "../types";
import type { SeasonResult } from "../game/season-simulation";
import { getSeasonTryTotal } from "../game/season-tries";
import { buildLeagueTable } from "../game/league-table";
import { getSquadValue } from "../positions";
import {
  getAverageSquadRating,
  getClubBreakdownSummary,
  getEffectivePeakRating,
} from "../squad-analysis";
import {
  getBestRatedTeam,
  getMostExpensiveTeam,
} from "../team-value-comparison";
import { devWarnMany } from "./dev-warn";

export function validateSeasonReviewStats(input: {
  squad: SquadSlot[];
  seasonResult: SeasonResult;
  seed: string;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
}): string[] {
  const { squad, seasonResult, seed } = input;
  const issues: string[] = [];
  const { fixtures, wins, losses, pointsFor, pointsAgainst, pointsDifference } =
    seasonResult;

  const fixtureWins = fixtures.filter((f) => f.result === "W").length;
  const fixtureLosses = fixtures.filter((f) => f.result === "L").length;

  if (wins !== fixtureWins) {
    issues.push(
      `Headline wins (${wins}) ≠ fixture wins (${fixtureWins})`
    );
  }
  if (losses !== fixtureLosses) {
    issues.push(
      `Headline losses (${losses}) ≠ fixture losses (${fixtureLosses})`
    );
  }
  if (wins + losses !== fixtures.length) {
    issues.push(
      `Wins + losses (${wins + losses}) ≠ games played (${fixtures.length})`
    );
  }

  const pf = fixtures.reduce((s, f) => s + f.pointsFor, 0);
  const pa = fixtures.reduce((s, f) => s + f.pointsAgainst, 0);
  if (pointsFor !== pf) {
    issues.push(`Points for (${pointsFor}) ≠ sum of scores (${pf})`);
  }
  if (pointsAgainst !== pa) {
    issues.push(`Points against (${pointsAgainst}) ≠ sum conceded (${pa})`);
  }
  if (pointsDifference !== pointsFor - pointsAgainst) {
    issues.push(
      `Points difference (${pointsDifference}) ≠ for − against (${pointsFor - pointsAgainst})`
    );
  }

  const leagueTable = buildLeagueTable(seasonResult, seed);
  const dreamRow = leagueTable.find((r) => r.isUserTeam);
  if (dreamRow) {
    if (dreamRow.wins !== wins) {
      issues.push(
        `League table wins (${dreamRow.wins}) ≠ season wins (${wins})`
      );
    }
    if (dreamRow.losses !== losses) {
      issues.push(
        `League table losses (${dreamRow.losses}) ≠ season losses (${losses})`
      );
    }
    if (dreamRow.pointsFor !== pointsFor) {
      issues.push(
        `League table PF (${dreamRow.pointsFor}) ≠ season PF (${pointsFor})`
      );
    }
    if (dreamRow.pointsAgainst !== pointsAgainst) {
      issues.push(
        `League table PA (${dreamRow.pointsAgainst}) ≠ season PA (${pointsAgainst})`
      );
    }
  }

  const expectedTries = getSeasonTryTotal(fixtures);
  const scorerTotal = seasonResult.tryScorers.reduce(
    (s, t) => s + t.tries,
    0
  );
  if (scorerTotal !== expectedTries) {
    issues.push(
      `Try scorer total (${scorerTotal}) ≠ fixture tries (${expectedTries})`
    );
  }

  const filledCount = squad.filter((s) => s.player).length;
  const clubSummary = getClubBreakdownSummary(squad, filledCount, {
    joeMellorMode: input.joeMellorMode,
    superSamHallasMode: input.superSamHallasMode,
  });
  if (clubSummary.totalPlayers !== filledCount) {
    issues.push(
      `Club representation (${clubSummary.totalPlayers}) ≠ squad size (${filledCount})`
    );
  }

  const squadValue = getSquadValue(squad);
  let sumPlayerValues = 0;
  for (const slot of squad) {
    if (slot.player) sumPlayerValues += slot.player.value;
  }
  if (squadValue !== sumPlayerValues) {
    issues.push(
      `Team value (${squadValue}) ≠ sum of player values (${sumPlayerValues})`
    );
  }

  const filled = squad.filter((s) => s.player);
  if (filled.length > 0) {
    const avg =
      filled.reduce((s, slot) => s + getEffectivePeakRating(slot), 0) /
      filled.length;
    const rounded = Math.round(avg * 10) / 10;
    const displayed = getAverageSquadRating(squad);
    if (Math.abs(displayed - rounded) > 0.15) {
      issues.push(
        `Team rating (${displayed}) ≠ average adjusted rating (${rounded})`
      );
    }
  }

  const userTeamName = "Dream Team";
  const bestRated = getBestRatedTeam(
    userTeamName,
    getAverageSquadRating(squad),
    fixtures,
    seed
  );
  const mostExpensive = getMostExpensiveTeam(
    userTeamName,
    squadValue,
    fixtures,
    seed
  );

  const allTeamRatings = new Map<string, number>();
  allTeamRatings.set(userTeamName, getAverageSquadRating(squad));
  for (const f of fixtures) {
    const prev = allTeamRatings.get(f.opponent) ?? 0;
    // Ratings from comparison use opponent summaries at fixture round — spot-check max
    allTeamRatings.set(f.opponent, prev);
  }
  if (bestRated.rating < getAverageSquadRating(squad) && bestRated.name === userTeamName) {
    // user is best — OK
  } else if (bestRated.name !== userTeamName && bestRated.rating <= 0) {
    issues.push("Best rated opposition team has invalid rating");
  }

  const allValues = new Map<string, number>();
  allValues.set(userTeamName, squadValue);
  if (mostExpensive.value < squadValue && mostExpensive.name === userTeamName) {
    // OK
  } else if (mostExpensive.value <= 0) {
    issues.push("Most expensive team has invalid value");
  }

  return issues;
}

export function runSeasonReviewValidation(
  input: Parameters<typeof validateSeasonReviewStats>[0]
): void {
  const issues = validateSeasonReviewStats(input);
  devWarnMany("season-review", issues, {
    wins: input.seasonResult.wins,
    losses: input.seasonResult.losses,
  });
}
