import type { LiveMatchEvent, ManagerCareer, ManagerPlayerSeasonStats } from "./types";
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
export function computeMatchRatingFromEvents(params: {
  playerId: string;
  events: LiveMatchEvent[];
  won: boolean;
  isStarter: boolean;
  wasMotm: boolean;
}): number {
  const { playerId, events, won, isStarter, wasMotm } = params;
  let rating = isStarter ? 6.0 : 5.5;

  for (const event of events) {
    const involves =
      event.playerId === playerId || event.kickerId === playerId;
    if (!involves) continue;

    switch (event.type) {
      case "try":
        rating += event.playerId === playerId ? 1.1 : 0;
        break;
      case "conversion":
      case "penalty_goal":
        rating += event.kickerId === playerId ? 0.35 : 0;
        break;
      case "drop_goal":
        rating += event.playerId === playerId || event.kickerId === playerId ? 0.5 : 0;
        break;
      case "line_break":
      case "big_break":
        rating += 0.4;
        break;
      case "try_saver":
        rating += 0.45;
        break;
      case "knock_on":
      case "forward_pass":
      case "forced_error":
        rating -= 0.35;
        break;
      case "sin_bin":
        rating -= 1.2;
        break;
      case "forty_twenty":
        rating += 0.3;
        break;
      default:
        break;
    }
  }

  if (won) rating += 0.3;
  else rating -= 0.15;
  if (wasMotm) rating += 0.6;

  return Math.round(Math.min(10, Math.max(1, rating)) * 10) / 10;
}

export function formatAverageRating(averageRating: number | undefined): string {
  if (averageRating == null || Number.isNaN(averageRating)) return "—";
  return `${averageRating.toFixed(1)}/10`;
}
