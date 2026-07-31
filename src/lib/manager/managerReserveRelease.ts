import { pushInboxMessage } from "./managerInbox";
import {
  RESERVE_DEPTH_MIN,
  releaseReserve,
} from "./managerReserves";
import { computeCareerWageBill } from "./managerReserveContracts";
import type {
  ManagerCareer,
  ManagerReservePlayer,
  ManagerReserveReleaseSettings,
  ManagerSettings,
} from "./types";
import {
  DEFAULT_MANAGER_SETTINGS,
  DEFAULT_RESERVE_RELEASE_SETTINGS,
} from "./types";

export type ReserveReleaseReason =
  | "under_rating"
  | "over_age"
  | "under_age"
  | "expired_contract"
  | "settings_rules";

export interface ReserveReleaseCandidate {
  reserve: ManagerReservePlayer;
  reason: string;
}

function getReleaseSettings(
  career: ManagerCareer
): ManagerReserveReleaseSettings {
  return {
    ...DEFAULT_RESERVE_RELEASE_SETTINGS,
    ...(career.managerSettings?.reserveReleaseSettings ?? {}),
  };
}

export function getManagerSettings(career: ManagerCareer): ManagerSettings {
  return {
    ...DEFAULT_MANAGER_SETTINGS,
    ...(career.managerSettings ?? {}),
    reserveReleaseSettings: getReleaseSettings(career),
  };
}

function isProtectedHighPotential(
  reserve: ManagerReservePlayer,
  settings: ManagerReserveReleaseSettings
): boolean {
  if (!settings.protectHighPotentialPlayers) return false;
  return reserve.potentialRating >= 78 || reserve.potentialRating - reserve.rating >= 8;
}

function isOnMatchday(career: ManagerCareer, reserveId: string): boolean {
  return (
    career.calledUpReserveIds.includes(reserveId) ||
    career.matchdayXiii.includes(reserveId) ||
    career.matchdayInterchange.includes(reserveId)
  );
}

export function previewReleaseUnderRating(
  career: ManagerCareer,
  rating: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter(
      (r) =>
        r.rating < rating &&
        !isOnMatchday(career, r.id)
    )
    .map((reserve) => ({
      reserve,
      reason: `Rating ${reserve.rating} under ${rating}`,
    }));
}

export function previewReleaseOverAge(
  career: ManagerCareer,
  age: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => r.age > age && !isOnMatchday(career, r.id))
    .map((reserve) => ({
      reserve,
      reason: `Age ${reserve.age} over ${age}`,
    }));
}

export function previewReleaseUnderAge(
  career: ManagerCareer,
  age: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => r.age < age && !isOnMatchday(career, r.id))
    .map((reserve) => ({
      reserve,
      reason: `Age ${reserve.age} under ${age}`,
    }));
}

export function previewReleaseExpiredContracts(
  career: ManagerCareer
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => {
      if (isOnMatchday(career, r.id)) return false;
      const contract = career.reserveContracts?.[r.id];
      return contract != null && contract.yearsRemaining <= 0;
    })
    .map((reserve) => ({
      reserve,
      reason: "Expired reserve contract",
    }));
}

export function previewReleaseBySettings(
  career: ManagerCareer
): ReserveReleaseCandidate[] {
  const settings = getReleaseSettings(career);
  const seen = new Set<string>();
  const out: ReserveReleaseCandidate[] = [];

  const pushUnique = (list: ReserveReleaseCandidate[]) => {
    for (const item of list) {
      if (seen.has(item.reserve.id)) continue;
      if (isProtectedHighPotential(item.reserve, settings)) continue;
      seen.add(item.reserve.id);
      out.push(item);
    }
  };

  if (settings.enableAutoReleaseByRating) {
    pushUnique(previewReleaseUnderRating(career, settings.releaseUnderRating));
  }
  if (settings.enableAutoReleaseByAge) {
    pushUnique(previewReleaseOverAge(career, settings.releaseOverAge));
  }
  if (settings.enableAutoReleaseUnderAge) {
    pushUnique(previewReleaseUnderAge(career, settings.releaseUnderAge));
  }

  return out;
}

export function applyReserveReleases(
  career: ManagerCareer,
  candidates: ReserveReleaseCandidate[],
  options?: { forceBelowMinimum?: boolean }
): {
  ok: boolean;
  career?: ManagerCareer;
  released: number;
  error?: string;
  wouldBreachMinimum?: boolean;
} {
  const unique = new Map<string, ReserveReleaseCandidate>();
  for (const c of candidates) unique.set(c.reserve.id, c);
  const list = [...unique.values()].filter(
    (c) => !isOnMatchday(career, c.reserve.id)
  );

  if (list.length === 0) {
    return { ok: false, released: 0, error: "No eligible reserves to release" };
  }

  const settings = getReleaseSettings(career);
  const minSize = Math.max(
    RESERVE_DEPTH_MIN,
    settings.minimumReserveSquadSize || RESERVE_DEPTH_MIN
  );
  const remaining = career.reserves.length - list.length;
  if (remaining < minSize && !options?.forceBelowMinimum) {
    return {
      ok: false,
      released: 0,
      wouldBreachMinimum: true,
      error: `Releasing ${list.length} would leave ${remaining} reserves (minimum ${minSize}). Confirm force release to continue.`,
    };
  }

  let next = career;
  for (const item of list) {
    next = releaseReserve(next, item.reserve.id);
  }
  next = {
    ...next,
    wageBill: computeCareerWageBill(next),
    updatedAt: new Date().toISOString(),
  };

  const names = list
    .slice(0, 8)
    .map((c) => c.reserve.name)
    .join(", ");
  const more = list.length > 8 ? ` and ${list.length - 8} more` : "";

  next = pushInboxMessage(next, {
    id: `board-reserve-release-${career.seasonYear}-w${career.gameWeek}-${list.length}-${list.map((c) => c.reserve.id).join("-").slice(0, 48)}`,
    type: "general",
    title: "Reserve releases processed",
    body: `The club released ${list.length} reserve player${list.length === 1 ? "" : "s"}: ${names}${more}. The wage bill has been updated.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
  });

  return { ok: true, career: next, released: list.length };
}

/** End-of-season / youth-intake auto release when settings enabled. */
export function applyConfiguredReserveAutoRelease(
  career: ManagerCareer
): ManagerCareer {
  const settings = getReleaseSettings(career);
  if (
    !settings.enableAutoReleaseByRating &&
    !settings.enableAutoReleaseByAge &&
    !settings.enableAutoReleaseUnderAge
  ) {
    return career;
  }
  const preview = previewReleaseBySettings(career);
  if (preview.length === 0) return career;
  const result = applyReserveReleases(career, preview);
  return result.ok && result.career ? result.career : career;
}
