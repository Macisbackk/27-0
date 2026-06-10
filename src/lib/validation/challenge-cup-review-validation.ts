import type { SquadSlot } from "../types";
import type { ChallengeCupResult } from "../game/challenge-cup-simulation";
import { getSeasonTryTotal } from "../game/season-tries";
import { getSquadValue } from "../positions";
import {
  getAverageSquadRating,
  getClubBreakdownSummary,
  getEffectivePeakRating,
} from "../squad-analysis";
import { devWarnMany } from "./dev-warn";

export function validateChallengeCupReviewStats(input: {
  squad: SquadSlot[];
  cupResult: ChallengeCupResult;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
}): string[] {
  const { squad, cupResult } = input;
  const issues: string[] = [];
  const { fixtures, wins, losses, matchesPlayed, bracketMatches, isWinner } =
    cupResult;

  const fixtureWins = fixtures.filter((f) => f.result === "W").length;
  const fixtureLosses = fixtures.filter((f) => f.result === "L").length;

  if (wins !== fixtureWins) {
    issues.push(`Tournament wins (${wins}) ≠ fixture wins (${fixtureWins})`);
  }
  if (losses !== fixtureLosses) {
    issues.push(
      `Tournament losses (${losses}) ≠ fixture losses (${fixtureLosses})`
    );
  }
  if (matchesPlayed !== fixtures.length) {
    issues.push(
      `Matches played (${matchesPlayed}) ≠ fixtures (${fixtures.length})`
    );
  }
  if (wins + losses !== fixtures.length) {
    issues.push(
      `Wins + losses (${wins + losses}) ≠ games played (${fixtures.length})`
    );
  }

  if (bracketMatches && bracketMatches.length > 0) {
    for (const match of bracketMatches) {
      if (match.status !== "complete") continue;
      if (!match.winner || !match.loser) continue;
      if (match.homeScore === null || match.awayScore === null) continue;
      const homeWon = match.homeScore > match.awayScore;
      const expectedWinner = homeWon ? match.homeTeam : match.awayTeam;
      const expectedLoser = homeWon ? match.awayTeam : match.homeTeam;
      if (expectedWinner && match.winner !== expectedWinner) {
        issues.push(
          `Bracket ${match.id}: winner (${match.winner}) ≠ score winner (${expectedWinner})`
        );
      }
      if (expectedLoser && match.loser !== expectedLoser) {
        issues.push(
          `Bracket ${match.id}: loser (${match.loser}) ≠ score loser (${expectedLoser})`
        );
      }
    }

    const finalMatch = bracketMatches
      .filter((m) => m.round === 4 && m.status === "complete")
      .pop();
    if (finalMatch?.winner) {
      const userClub = cupResult.userClub ?? "Dream Team";
      if (isWinner && finalMatch.winner !== userClub) {
        issues.push(
          `Final winner (${finalMatch.winner}) ≠ user club when isWinner=true`
        );
      }
      if (!isWinner && finalMatch.winner === userClub) {
        issues.push(
          `Final winner (${finalMatch.winner}) is user club but isWinner=false`
        );
      }
      if (!isWinner && cupResult.finish === "Winners") {
        issues.push("finish is Winners but isWinner=false");
      }
      if (isWinner && cupResult.resultLabel.includes("Exit")) {
        issues.push(
          `Winner result includes exit text: "${cupResult.resultLabel}"`
        );
      }
      if (isWinner && cupResult.finish !== "Winners") {
        issues.push(
          `isWinner=true but finish is "${cupResult.finish}"`
        );
      }
    }
  }

  const expectedTries = getSeasonTryTotal(fixtures);
  const scorerTotal = cupResult.tryScorers.reduce((s, t) => s + t.tries, 0);
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

  return issues;
}

export function runChallengeCupReviewValidation(
  input: Parameters<typeof validateChallengeCupReviewStats>[0]
): void {
  const issues = validateChallengeCupReviewStats(input);
  devWarnMany("challenge-cup-review", issues, {
    wins: input.cupResult.wins,
    losses: input.cupResult.losses,
  });
}
