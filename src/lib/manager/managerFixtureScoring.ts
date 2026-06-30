import type { MatchFixture } from "../game/season-simulation";
import type { SquadSlot } from "../types";
import { getPlayerById } from "../players";
import type { ManagerTactics } from "./types";
import { enrichManagerFixtureScoring } from "./managerScoring";

/** Ensure fixture always has scoring detail for match review UI. */
export function ensureManagerFixtureScoring(
  career: { seed: string; tactics: ManagerTactics },
  fixture: MatchFixture,
  squad: SquadSlot[]
): void {
  if (fixture.scoringDetail) return;

  enrichManagerFixtureScoring(
    squad,
    fixture,
    career.seed,
    career.tactics,
    { currentSeasonOnly: true }
  );

  if (fixture.scoringDetail) return;

  const xiiiPlayers = squad
    .filter((s) => s.player)
    .map((s) => s.player!);

  const userTryScorers = [];
  let triesLeft = fixture.triesFor;
  for (const p of xiiiPlayers) {
    if (triesLeft <= 0) break;
    const t = Math.min(triesLeft, triesLeft > 1 ? 1 : triesLeft);
    if (t > 0) {
      userTryScorers.push({ playerId: p.id, name: p.name, tries: t });
      triesLeft -= t;
    }
  }
  if (triesLeft > 0 && userTryScorers[0]) {
    userTryScorers[0] = {
      ...userTryScorers[0],
      tries: userTryScorers[0].tries + triesLeft,
    };
  }

  const oppPlayer = getPlayerById(fixture.opponent) ?? xiiiPlayers[0];
  const oppName = fixture.opponent;

  fixture.scoringDetail = {
    dreamTeam: {
      tryScorers: userTryScorers,
      kicking: fixture.scoringFor
        ? {
            playerId: userTryScorers[0]?.playerId ?? "kicker",
            name: userTryScorers[0]?.name ?? career.seed,
            conversions: fixture.scoringFor.conversions,
            conversionAttempts: fixture.scoringFor.tries,
            penalties: fixture.scoringFor.penalties,
            dropGoals: fixture.scoringFor.dropGoals,
          }
        : null,
    },
    opponent: {
      tryScorers:
        fixture.triesAgainst > 0
          ? [
              {
                playerId: oppName,
                name: oppName,
                tries: fixture.triesAgainst,
              },
            ]
          : [],
      kicking: fixture.scoringAgainst
        ? {
            playerId: oppName,
            name: oppName,
            conversions: fixture.scoringAgainst.conversions,
            conversionAttempts: fixture.scoringAgainst.tries,
            penalties: fixture.scoringAgainst.penalties,
            dropGoals: fixture.scoringAgainst.dropGoals,
          }
        : null,
    },
  };
}
