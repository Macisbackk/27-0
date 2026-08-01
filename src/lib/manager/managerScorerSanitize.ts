import type { ManagerCareer, ManagerPlayerSeasonStats } from "./types";
import { isInvalidPlayerName } from "./managerPlayerNameGuards";

/**
 * Strip placeholder "Try Scorer" / invalid names from persisted scoring data.
 */
export function sanitizeInvalidScorerData(
  career: ManagerCareer
): ManagerCareer {
  const teamNames = [
    career.club,
    ...career.fixtures.map((f) => f.opponent),
  ];
  let changed = false;

  const fixtures = career.fixtures.map((fixture) => {
    const detail = fixture.scoringDetail;
    if (!detail) return fixture;

    const filterScorers = <
      T extends { playerId: string; name: string; tries: number },
    >(
      scorers: T[] | undefined
    ): T[] => {
      if (!scorers?.length) return scorers ?? [];
      const next = scorers.filter(
        (s) =>
          !isInvalidPlayerName(s.name, teamNames) &&
          !isInvalidPlayerName(s.playerId, teamNames) &&
          s.playerId !== fixture.opponent &&
          s.name !== fixture.opponent &&
          s.playerId !== career.club &&
          s.name !== career.club
      );
      if (next.length !== scorers.length) changed = true;
      return next;
    };

    const dreamTry = filterScorers(detail.dreamTeam.tryScorers);
    const oppTry = filterScorers(detail.opponent.tryScorers);
    if (
      dreamTry === detail.dreamTeam.tryScorers &&
      oppTry === detail.opponent.tryScorers
    ) {
      return fixture;
    }

    return {
      ...fixture,
      scoringDetail: {
        ...detail,
        dreamTeam: { ...detail.dreamTeam, tryScorers: dreamTry },
        opponent: { ...detail.opponent, tryScorers: oppTry },
      },
    };
  });

  const playerSeasonStats: Record<string, ManagerPlayerSeasonStats> = {
    ...career.playerSeasonStats,
  };
  for (const id of Object.keys(playerSeasonStats)) {
    if (isInvalidPlayerName(id, teamNames)) {
      delete playerSeasonStats[id];
      changed = true;
    }
  }

  // Rebuild user try totals from cleaned dreamTeam scorers when present.
  const rebuiltTries: Record<string, number> = {};
  for (const fixture of fixtures) {
    for (const scorer of fixture.scoringDetail?.dreamTeam.tryScorers ?? []) {
      rebuiltTries[scorer.playerId] =
        (rebuiltTries[scorer.playerId] ?? 0) + scorer.tries;
    }
  }
  if (Object.keys(rebuiltTries).length > 0) {
    for (const [playerId, tries] of Object.entries(rebuiltTries)) {
      const existing = playerSeasonStats[playerId];
      if (!existing) continue;
      if (existing.tries !== tries) {
        playerSeasonStats[playerId] = { ...existing, tries };
        changed = true;
      }
    }
  }

  if (!changed) return career;

  return {
    ...career,
    fixtures,
    playerSeasonStats,
    updatedAt: new Date().toISOString(),
  };
}

/** Match impact rating out of 10 from live events + result. */
export {
  computeMatchRatingFromEvents,
  diagnoseMatchRating,
  formatAverageRating,
  formDeltaFromMatchRating,
} from "./managerMatchRating";
export type {
  MatchRatingBreakdown,
  MatchRatingContribution,
} from "./managerMatchRating";
