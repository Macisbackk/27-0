import type { ManagerCareer } from "./types";

export function getTransferWatchlistIds(career: ManagerCareer): string[] {
  return career.transferWatchlistIds ?? [];
}

export function isOnTransferWatchlist(
  career: ManagerCareer,
  playerId: string
): boolean {
  return getTransferWatchlistIds(career).includes(playerId);
}

export function toggleTransferWatchlist(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const current = getTransferWatchlistIds(career);
  const next = current.includes(playerId)
    ? current.filter((id) => id !== playerId)
    : [...current, playerId];
  return {
    ...career,
    transferWatchlistIds: next,
    updatedAt: new Date().toISOString(),
  };
}

/** Drop IDs that are no longer scouting targets (signed, loaned in, gone). */
export function pruneTransferWatchlist(
  career: ManagerCareer,
  removeIds: readonly string[]
): ManagerCareer {
  if (removeIds.length === 0) return career;
  const drop = new Set(removeIds);
  const current = getTransferWatchlistIds(career);
  const next = current.filter((id) => !drop.has(id));
  if (next.length === current.length) return career;
  return {
    ...career,
    transferWatchlistIds: next,
    updatedAt: new Date().toISOString(),
  };
}

export function clearTransferWatchlist(career: ManagerCareer): ManagerCareer {
  if (!(career.transferWatchlistIds?.length ?? 0)) return career;
  return {
    ...career,
    transferWatchlistIds: [],
    updatedAt: new Date().toISOString(),
  };
}
