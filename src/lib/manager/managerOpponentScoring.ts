import seedrandom from "seedrandom";
import type { MatchFixture, TeamScoringDetail } from "../game/season-simulation";
import { selectClubMatchSquad } from "../game/opponent-scorers";
import { getPlayerEligiblePositions } from "../players/player-positions";
import type { ManagerTactics } from "./types";

function allocateTries(
  totalTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const alloc = new Array(weights.length).fill(0);
  for (let t = 0; t < totalTries; t++) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let roll = rng() * sum;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        alloc[i]++;
        break;
      }
    }
  }
  return alloc;
}

/** Distribute opponent tries across named players from their match squad. */
export function buildOpponentTryScoringDetail(
  opponent: string,
  tries: number,
  seed: string,
  round: number,
  tactics?: ManagerTactics
): TeamScoringDetail["tryScorers"] {
  if (tries <= 0) return [];

  const oppSquad = selectClubMatchSquad(opponent, seed, round, {
    currentSeasonOnly: true,
  });
  if (oppSquad.length === 0) {
    return [];
  }

  const rng = seedrandom(`${seed}-opp-tries-r${round}-${opponent}`);
  const weights = oppSquad.map((p) => {
    const rating = p.rating ?? p.peakRating;
    const variance = 0.85 + rng() * 0.3;
    return Math.max(0.1, rating * variance);
  });
  const alloc = allocateTries(tries, weights, rng);

  return oppSquad
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      tries: alloc[i] ?? 0,
    }))
    .filter((s) => s.tries > 0);
}

export function opponentScoringUsesClubLump(
  fixture: MatchFixture
): boolean {
  const scorers = fixture.scoringDetail?.opponent.tryScorers ?? [];
  if (fixture.triesAgainst > 0 && scorers.length === 0) return true;
  return scorers.some(
    (s) => s.playerId === fixture.opponent || s.name === fixture.opponent
  );
}

export function repairOpponentTryScorers(
  fixture: MatchFixture,
  seed: string,
  tactics?: ManagerTactics
): void {
  if (fixture.triesAgainst <= 0) return;
  const tryScorers = buildOpponentTryScoringDetail(
    fixture.opponent,
    fixture.triesAgainst,
    seed,
    fixture.round,
    tactics
  );
  if (tryScorers.length === 0) return;

  if (!fixture.scoringDetail) {
    fixture.scoringDetail = {
      dreamTeam: { tryScorers: [], kicking: null },
      opponent: { tryScorers, kicking: null },
    };
    return;
  }

  fixture.scoringDetail = {
    ...fixture.scoringDetail,
    opponent: {
      ...fixture.scoringDetail.opponent,
      tryScorers,
    },
  };
}
