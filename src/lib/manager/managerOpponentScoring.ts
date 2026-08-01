import seedrandom from "seedrandom";
import type { MatchFixture, TeamScoringDetail } from "../game/season-simulation";
import { selectClubMatchSquad } from "../game/opponent-scorers";
import { getDefenceConcedeMultiplier } from "./managerTacticsScoring";
import { getManagerOpponentPoolOptions } from "./managerLeagueRosters";
import type { ManagerCareer, ManagerTactics } from "./types";

import { allocateWeightedTries } from "./managerTryScoring";

/** Distribute opponent tries across named players from their match squad. */
export function buildOpponentTryScoringDetail(
  opponent: string,
  tries: number,
  seed: string,
  round: number,
  tactics?: ManagerTactics,
  fixtureKey?: string,
  career?: ManagerCareer
): TeamScoringDetail["tryScorers"] {
  if (tries <= 0) return [];

  const poolOptions = career
    ? getManagerOpponentPoolOptions(career, opponent)
    : { currentSeasonOnly: true as const };

  const oppSquad = selectClubMatchSquad(opponent, seed, round, poolOptions);
  if (oppSquad.length === 0) {
    return [];
  }

  const rng = seedrandom(
    `${seed}-opp-tries-${fixtureKey ?? `r${round}`}-${opponent}`
  );
  const weights = oppSquad.map((p) => {
    const rating = p.peakRating;
    const variance = 0.85 + rng() * 0.3;
    const defenceMod = tactics
      ? getDefenceConcedeMultiplier(tactics.defenceFocus, p.position)
      : 1;
    return Math.max(0.1, rating * variance * defenceMod);
  });
  const alloc = allocateWeightedTries(tries, weights, rng, {
    positions: oppSquad.map((p) => p.position),
    ratings: oppSquad.map((p) => p.peakRating),
  });

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
  tactics?: ManagerTactics,
  fixtureKey?: string,
  career?: ManagerCareer
): void {
  if (fixture.triesAgainst <= 0) return;
  const tryScorers = buildOpponentTryScoringDetail(
    fixture.opponent,
    fixture.triesAgainst,
    seed,
    fixture.round,
    tactics,
    fixtureKey,
    career
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
