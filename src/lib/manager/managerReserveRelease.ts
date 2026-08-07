import { pushInboxMessage } from "./managerInbox";
import {
  RESERVE_MIN_PLAYERS,
  releaseReserve,
  getReserveSignedRating,
  promoteReserveToSquad,
} from "./managerReserves";
import { computeCareerWageBill } from "./managerReserveContracts";
import { addPlayersToFreeAgents } from "./managerFreeAgents";
import { reserveToPlayer } from "./managerPlayers";
import type {
  ManagerCareer,
  ManagerReserveDevelopmentSettings,
  ManagerReservePlayer,
  ManagerSettings,
} from "./types";
import {
  DEFAULT_MANAGER_SETTINGS,
  DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
} from "./types";

export type ReserveReleaseReason =
  | "under_rating"
  | "over_age"
  | "under_age"
  | "expired_contract"
  | "settings_rules"
  | "stagnant_years"
  | "low_growth"
  | "marked";

export type ReserveReviewFlag =
  | "review"
  | "promote"
  | "protected"
  | "release_candidate";

export interface ReserveReleaseCandidate {
  reserve: ManagerReservePlayer;
  reason: string;
}

export interface ReservePlayerReview {
  reserve: ManagerReservePlayer;
  flags: ReserveReviewFlag[];
  reasons: string[];
}

function getDevelopmentSettings(
  career: ManagerCareer
): ManagerReserveDevelopmentSettings {
  return {
    ...DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
    ...(career.managerSettings?.reserveDevelopmentSettings ??
      career.managerSettings?.reserveReleaseSettings ??
      {}),
  };
}

export function getManagerSettings(career: ManagerCareer): ManagerSettings {
  const reserveDevelopmentSettings = getDevelopmentSettings(career);
  return {
    ...DEFAULT_MANAGER_SETTINGS,
    ...(career.managerSettings ?? {}),
    reserveDevelopmentSettings,
    reserveReleaseSettings: reserveDevelopmentSettings,
  };
}

export function getReserveYearsAtClub(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): number {
  if (typeof reserve.yearsAtClub === "number" && reserve.yearsAtClub >= 0) {
    return reserve.yearsAtClub;
  }
  const signed = reserve.signedSeasonYear ?? career.seasonYear;
  return Math.max(0, career.seasonYear - signed);
}

export function getReserveGrowth(reserve: ManagerReservePlayer): number {
  return reserve.rating - getReserveSignedRating(reserve);
}

function isProtectedReserve(
  _career: ManagerCareer,
  reserve: ManagerReservePlayer,
  settings: ManagerReserveDevelopmentSettings
): boolean {
  return (settings.protectedFromMassReleaseIds ?? []).includes(reserve.id);
}

function isOnMatchday(career: ManagerCareer, reserveId: string): boolean {
  return (
    career.calledUpReserveIds.includes(reserveId) ||
    career.matchdayXiii.includes(reserveId) ||
    career.matchdayInterchange.includes(reserveId)
  );
}

export function evaluateReservePlayerReview(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReservePlayerReview {
  const settings = getDevelopmentSettings(career);
  const flags: ReserveReviewFlag[] = [];
  const reasons: string[] = [];

  if (isProtectedReserve(career, reserve, settings)) {
    flags.push("protected");
    reasons.push("Protected from mass release");
  }

  if (
    settings.autoPromoteByRatingEnabled &&
    reserve.rating >= settings.autoPromoteRatingThreshold
  ) {
    flags.push("promote");
    reasons.push(
      `Reached ${reserve.rating} rating — auto-promote candidate`
    );
  }

  const mass = evaluateMassReleaseRules(reserve, settings);
  if (mass.matches && !flags.includes("protected")) {
    flags.push("review");
    flags.push("release_candidate");
    reasons.push(mass.reason);
  }

  return { reserve, flags, reasons };
}

function evaluateMassReleaseRules(
  reserve: ManagerReservePlayer,
  settings: ManagerReserveDevelopmentSettings
): { matches: boolean; reason: string } {
  const checks: { enabled: boolean; pass: boolean; label: string }[] = [
    {
      enabled: settings.massReleaseByPotentialEnabled,
      pass: reserve.potentialRating < settings.massReleasePotentialBelow,
      label: `Potential ${reserve.potentialRating} under ${settings.massReleasePotentialBelow}`,
    },
    {
      enabled: settings.massReleaseByRatingEnabled,
      pass: reserve.rating < settings.massReleaseRatingBelow,
      label: `Rating ${reserve.rating} under ${settings.massReleaseRatingBelow}`,
    },
    {
      enabled: settings.massReleaseByAgeEnabled,
      pass: reserve.age > settings.massReleaseAgeAbove,
      label: `Age ${reserve.age} over ${settings.massReleaseAgeAbove}`,
    },
  ];

  const active = checks.filter((c) => c.enabled);
  if (active.length === 0) return { matches: false, reason: "" };

  // Always AND ("all") — massReleaseMatchMode is deprecated / ignored.
  void settings.massReleaseMatchMode;
  const hits = active.filter((c) => c.pass);
  const matches = hits.length === active.length;
  return {
    matches,
    reason: hits.map((h) => h.label).join(" + ") || "Mass release rules",
  };
}

export function previewReleaseUnderRating(
  career: ManagerCareer,
  rating: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => r.rating < rating && !isOnMatchday(career, r.id))
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

export function previewReleaseByLowGrowth(
  career: ManagerCareer,
  yearsRequired: number,
  growthBelow: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => {
      if (isOnMatchday(career, r.id)) return false;
      const years = getReserveYearsAtClub(career, r);
      const growth = getReserveGrowth(r);
      return years >= yearsRequired && growth < growthBelow;
    })
    .map((reserve) => {
      const years = getReserveYearsAtClub(career, reserve);
      const growth = getReserveGrowth(reserve);
      return {
        reserve,
        reason: `Growth ${growth >= 0 ? "+" : ""}${growth} after ${years} year${years === 1 ? "" : "s"} (under +${growthBelow})`,
      };
    });
}

export function previewReleaseByYearsRating(
  career: ManagerCareer,
  yearsRequired: number,
  ratingBelow: number
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => {
      if (isOnMatchday(career, r.id)) return false;
      const years = getReserveYearsAtClub(career, r);
      return years >= yearsRequired && r.rating < ratingBelow;
    })
    .map((reserve) => {
      const years = getReserveYearsAtClub(career, reserve);
      return {
        reserve,
        reason: `Rating ${reserve.rating} after ${years} year${years === 1 ? "" : "s"} (under ${ratingBelow})`,
      };
    });
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

export function previewReleaseMarkedForRelease(
  career: ManagerCareer
): ReserveReleaseCandidate[] {
  return career.reserves
    .filter((r) => r.markedForRelease === true && !isOnMatchday(career, r.id))
    .map((reserve) => ({
      reserve,
      reason: "Marked for release",
    }));
}

/** Preview players matching mass-release rules (potential / rating / age). */
export function previewReleaseBySettings(
  career: ManagerCareer
): ReserveReleaseCandidate[] {
  const settings = getDevelopmentSettings(career);
  const out: ReserveReleaseCandidate[] = [];
  const seen = new Set<string>();

  for (const reserve of career.reserves) {
    if (isOnMatchday(career, reserve.id)) continue;
    if (isProtectedReserve(career, reserve, settings)) continue;
    const review = evaluateReservePlayerReview(career, reserve);
    if (!review.flags.includes("release_candidate")) continue;
    if (seen.has(reserve.id)) continue;
    seen.add(reserve.id);
    out.push({
      reserve,
      reason: review.reasons.find((r) => !r.startsWith("Reached")) ??
        review.reasons[0] ??
        "Mass release candidate",
    });
  }

  return out;
}

/**
 * Auto-promote reserves at/above the rating threshold when senior capacity allows.
 * Runs on weekly/season ticks when enabled; writes an inbox summary.
 */
export function applyAutoPromoteByRating(career: ManagerCareer): ManagerCareer {
  const settings = getDevelopmentSettings(career);
  if (!settings.autoPromoteByRatingEnabled) return career;

  let next = career;
  const promoted: string[] = [];

  const candidates = [...next.reserves]
    .filter(
      (r) =>
        r.rating >= settings.autoPromoteRatingThreshold &&
        !isOnMatchday(next, r.id)
    )
    .sort((a, b) => b.rating - a.rating || a.age - b.age);

  for (const reserve of candidates) {
    const result = promoteReserveToSquad(next, reserve.id);
    if (!result.ok || !result.career) break;
    next = result.career;
    promoted.push(reserve.name);
  }

  if (promoted.length === 0) return career;

  return pushInboxMessage(next, {
    id: `auto-promote-s${career.seasonYear}-w${career.gameWeek}-${promoted.length}`,
    type: "youth_intake",
    title: "Auto-promote complete",
    body: `Promoted ${promoted.length} reserve${promoted.length === 1 ? "" : "s"} at ${settings.autoPromoteRatingThreshold}+ rating: ${promoted.slice(0, 8).join(", ")}${promoted.length > 8 ? ` and ${promoted.length - 8} more` : ""}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

export function applyReserveReleases(
  career: ManagerCareer,
  candidates: ReserveReleaseCandidate[],
  options?: { forceBelowMinimum?: boolean; ignoreMassReleaseProtection?: boolean }
): {
  ok: boolean;
  career?: ManagerCareer;
  released: number;
  error?: string;
  wouldBreachMinimum?: boolean;
} {
  const unique = new Map<string, ReserveReleaseCandidate>();
  for (const c of candidates) unique.set(c.reserve.id, c);
  const settings = getDevelopmentSettings(career);
  const list = [...unique.values()].filter((c) => {
    if (isOnMatchday(career, c.reserve.id)) return false;
    if (
      !options?.ignoreMassReleaseProtection &&
      isProtectedReserve(career, c.reserve, settings)
    ) {
      return false;
    }
    return true;
  });

  if (list.length === 0) {
    return { ok: false, released: 0, error: "No eligible reserves to release" };
  }

  const minSize = RESERVE_MIN_PLAYERS;
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
  const releasedReserves: ManagerReservePlayer[] = [];
  for (const item of list) {
    releasedReserves.push(item.reserve);
    next = releaseReserve(next, item.reserve.id);
  }

  const registry = { ...(next.playerRegistry ?? {}) };
  for (const reserve of releasedReserves) {
    registry[reserve.id] = reserveToPlayer(
      { ...reserve, age: Math.max(18, reserve.age) },
      next.seasonYear
    );
  }
  next = addPlayersToFreeAgents(
    { ...next, playerRegistry: registry },
    releasedReserves.map((r) => ({
      playerId: r.id,
      formerClub: career.club,
      source: "unwanted_reserve" as const,
    }))
  );

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

/** End-of-season auto release — disabled; legacy setting ignored. */
export function applyConfiguredReserveAutoRelease(
  career: ManagerCareer
): ManagerCareer {
  return career;
}

/** Tick years-at-club and attach development review inbox notes. */
export function tickReserveYearsAtClub(career: ManagerCareer): ManagerCareer {
  const reserves = career.reserves.map((r) => {
    const signedSeasonYear = r.signedSeasonYear ?? career.seasonYear;
    const yearsAtClub = Math.max(0, career.seasonYear + 1 - signedSeasonYear);
    return {
      ...r,
      signedSeasonYear,
      signedRating: r.signedRating ?? r.baseRating ?? r.rating,
      yearsAtClub,
    };
  });

  let next: ManagerCareer = { ...career, reserves };
  const reviews = reserves
    .map((r) => evaluateReservePlayerReview(next, r))
    .filter(
      (r) =>
        r.flags.includes("review") ||
        r.flags.includes("promote") ||
        r.flags.includes("release_candidate")
    );

  if (reviews.length === 0) return next;

  const lines = reviews.slice(0, 8).map((r) => {
    const flag = r.flags.includes("promote")
      ? "Promote"
      : r.flags.includes("release_candidate")
        ? "Release"
        : "Review";
    return `${flag}: ${r.reserve.name} — ${r.reasons[0] ?? "Needs attention"}`;
  });
  const more =
    reviews.length > 8 ? `\n…and ${reviews.length - 8} more` : "";

  return pushInboxMessage(next, {
    id: `reserve-dev-review-s${career.seasonYear + 1}`,
    type: "reserve_report",
    title: "Reserve development review",
    body: lines.join("\n") + more,
    week: 0,
    season: career.seasonYear + 1,
    gameWeek: 0,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

/** Migrate reserve tenure fields on load. */
export function hydrateReserveTenure(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    reserves: career.reserves.map((r) => {
      const signedSeasonYear = r.signedSeasonYear ?? career.seasonYear;
      const signedRating = r.signedRating ?? r.baseRating ?? r.rating;
      const yearsAtClub =
        typeof r.yearsAtClub === "number"
          ? r.yearsAtClub
          : Math.max(0, career.seasonYear - signedSeasonYear);
      return { ...r, signedSeasonYear, signedRating, yearsAtClub };
    }),
  };
}
