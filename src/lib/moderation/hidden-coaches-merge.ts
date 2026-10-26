/**
 * "Hide this coach" list: pure shape + merge (no storage), so tests can run it under tsx.
 *
 * Each coach the player has ever hidden keeps one entry; unhiding flips `hidden` to false rather
 * than deleting it, so a merge with an older cloud copy can't bring a hide back. The merge takes the
 * most recent change per coach (a union of both copies).
 */

export interface HiddenCoach {
  userId: string;
  /** Name when hidden, for the Settings list. */
  name: string;
  hidden: boolean;
  /** ISO time of the last hide / unhide. */
  changedAt: string;
}

export interface HiddenCoachesState {
  coaches: HiddenCoach[];
}

export const MAX_HIDDEN_COACHES = 500;

export function emptyHiddenCoaches(): HiddenCoachesState {
  return { coaches: [] };
}

export function normalizeHiddenCoaches(raw: unknown): HiddenCoachesState {
  if (!raw || typeof raw !== "object") return emptyHiddenCoaches();
  const list = (raw as { coaches?: unknown }).coaches;
  if (!Array.isArray(list)) return emptyHiddenCoaches();
  const byId = new Map<string, HiddenCoach>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<HiddenCoach>;
    if (typeof c.userId !== "string" || !c.userId || c.userId.length > 64) continue;
    const entry: HiddenCoach = {
      userId: c.userId,
      name: typeof c.name === "string" ? c.name.slice(0, 40) : "Coach",
      hidden: c.hidden !== false,
      changedAt: typeof c.changedAt === "string" ? c.changedAt : "1970-01-01T00:00:00.000Z",
    };
    const existing = byId.get(entry.userId);
    if (!existing || entry.changedAt > existing.changedAt) byId.set(entry.userId, entry);
  }
  const coaches = [...byId.values()]
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1))
    .slice(0, MAX_HIDDEN_COACHES);
  return { coaches };
}

/** Union of two copies; the latest hide / unhide per coach wins. */
export function mergeHiddenCoaches(localRaw: unknown, cloudRaw: unknown): HiddenCoachesState {
  const local = normalizeHiddenCoaches(localRaw);
  const cloud = normalizeHiddenCoaches(cloudRaw);
  return normalizeHiddenCoaches({ coaches: [...local.coaches, ...cloud.coaches] });
}

export function hiddenCoachIds(state: HiddenCoachesState): Set<string> {
  return new Set(state.coaches.filter((c) => c.hidden).map((c) => c.userId));
}
