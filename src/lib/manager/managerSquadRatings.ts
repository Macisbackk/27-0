import sl2026Squads from "../../../data/sl-2026-squads.json";
import sl2026ApplyReport from "../../../data/sl-2026-squads-apply-report.json";

type Sl2026Entry = { name: string; positions: string; rating: number };
type RatingsChangedEntry = {
  id: string;
  name: string;
  from: number;
  to: number;
};

const MANAGER_RATING_BY_PLAYER_ID = new Map<string, number>();

function buildManagerRatingMap(): void {
  const squads = sl2026Squads as Record<string, Sl2026Entry[]>;
  const report = sl2026ApplyReport as {
    ratingsChanged?: RatingsChangedEntry[];
    teams?: Record<string, { playerIds: string[] }>;
  };

  for (const change of report.ratingsChanged ?? []) {
    MANAGER_RATING_BY_PLAYER_ID.set(change.id, change.to);
  }

  for (const [club, team] of Object.entries(report.teams ?? {})) {
    const roster = squads[club];
    if (!roster?.length) continue;
    const ids = team.playerIds ?? [];
    for (let i = 0; i < Math.min(roster.length, ids.length); i++) {
      const id = ids[i]!;
      const entry = roster[i]!;
      if (!MANAGER_RATING_BY_PLAYER_ID.has(id)) {
        MANAGER_RATING_BY_PLAYER_ID.set(id, entry.rating);
      }
    }
  }
}

buildManagerRatingMap();

/** 2026 Super League squad ratings for manager mode display and strength. */
export function getManagerModePlayerRating(
  playerId: string,
  playerName: string,
  fallback: number
): number {
  const byId = MANAGER_RATING_BY_PLAYER_ID.get(playerId);
  if (byId !== undefined) return byId;
  return fallback;
}

export function hasManagerModeRating(playerId: string): boolean {
  return MANAGER_RATING_BY_PLAYER_ID.has(playerId);
}

export function applyManagerModeRatingToPlayer<
  T extends { id: string; name: string; rating?: number; peakRating: number },
>(player: T): T {
  if (!hasManagerModeRating(player.id)) return player;
  const mgrRating = MANAGER_RATING_BY_PLAYER_ID.get(player.id)!;
  const displayRating = player.rating ?? mgrRating;
  const displayPeak =
    player.rating !== undefined
      ? Math.max(displayRating, mgrRating)
      : mgrRating;
  return {
    ...player,
    rating: displayRating,
    peakRating: displayPeak,
  };
}

export function getManagerClubKeyPlayers(
  playerIds: string[],
  getRating: (id: string) => number,
  getName: (id: string) => string,
  limit = 5
): { playerId: string; name: string; rating: number }[] {
  return playerIds
    .map((id) => ({
      playerId: id,
      name: getName(id),
      rating: getRating(id),
    }))
    .filter((p) => p.rating > 0 && p.name)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
