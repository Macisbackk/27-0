import type { ManagerCareer, ManagerReservePlayer, SquadRole } from "./types";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";

/** Persisted squad-role schema version — bump when role union or migration rules change. */
export const SQUAD_ROLE_SCHEMA_VERSION = 1;

/** All squad roles in display order (senior squad, highest first). */
export const SQUAD_ROLES: readonly SquadRole[] = [
  "key-player",
  "first-team",
  "rotation",
  "squad-depth",
  "reserve",
] as const;

/** Human-readable labels for UI. */
export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  "key-player": "Key Player",
  "first-team": "First Team",
  rotation: "Rotation",
  "squad-depth": "Squad Depth",
  reserve: "Reserve",
};

/** Legacy persisted roles from saves before schema v1. */
export type LegacySquadRole =
  | "Star"
  | "Starter"
  | "Rotation"
  | "Prospect"
  | "Depth";

const LEGACY_ROLE_MAP: Record<LegacySquadRole, SquadRole> = {
  Star: "key-player",
  Starter: "first-team",
  Rotation: "rotation",
  Prospect: "squad-depth",
  Depth: "squad-depth",
};

export function isLegacySquadRole(role: string): role is LegacySquadRole {
  return role in LEGACY_ROLE_MAP;
}

export function normalizeSquadRole(role: string | SquadRole): SquadRole {
  if (isLegacySquadRole(role)) return LEGACY_ROLE_MAP[role];
  if ((SQUAD_ROLES as readonly string[]).includes(role)) return role as SquadRole;
  return "squad-depth";
}

export function formatSquadRole(role: SquadRole | string): string {
  const normalized = normalizeSquadRole(role);
  return SQUAD_ROLE_LABELS[normalized];
}

export interface SquadRoleEvaluationContext {
  rating: number;
  potential?: number;
  age?: number;
  inStartingXiii: boolean;
  seasonAppearances?: number;
  isReserve?: boolean;
  calledUpForNextMatch?: boolean;
}

/** Central role evaluator — uses lineup, minutes, registration and contract context. */
export function evaluateSquadRole(ctx: SquadRoleEvaluationContext): SquadRole {
  if (ctx.isReserve && !ctx.calledUpForNextMatch) return "reserve";

  const rating = ctx.rating;
  const apps = ctx.seasonAppearances ?? 0;
  const inXi = ctx.inStartingXiii;
  const potential = ctx.potential ?? rating;

  if (rating >= 90) return "key-player";
  if (rating >= 88 && inXi && apps >= 4) return "key-player";
  if (inXi && rating >= 84) return "first-team";
  if (apps >= 10 && rating >= 82) return "first-team";
  if (inXi && rating >= 80) return "first-team";
  if (apps >= 6 || (inXi && rating >= 78)) return "rotation";
  if (rating >= 82 && !inXi) return "rotation";
  if (potential >= 86 && (ctx.age ?? 99) <= 22 && apps >= 3) return "rotation";
  return "squad-depth";
}

export function evaluateSquadRoleForPlayer(
  career: ManagerCareer,
  playerId: string
): SquadRole {
  const player = getManagerPlayer(career, playerId);
  if (!player) return "squad-depth";

  const squadState = career.squad.find((p) => p.playerId === playerId);
  const inStartingXiii = (career.matchdayXiii ?? []).includes(playerId);

  return evaluateSquadRole({
    rating: player.peakRating,
    age: getManagerPlayerAge(career, playerId),
    inStartingXiii,
    seasonAppearances: squadState?.seasonAppearances ?? 0,
    isReserve: false,
  });
}

export function evaluateReserveSquadRole(
  reserve: Pick<ManagerReservePlayer, "calledUpForNextMatch" | "rating">
): SquadRole {
  if (reserve.calledUpForNextMatch) {
    return evaluateSquadRole({
      rating: reserve.rating,
      inStartingXiii: false,
      isReserve: true,
      calledUpForNextMatch: true,
    });
  }
  return "reserve";
}

export function roleRank(role: SquadRole | string): number {
  const normalized = normalizeSquadRole(role);
  const ranks: Record<SquadRole, number> = {
    "key-player": 5,
    "first-team": 4,
    rotation: 3,
    "squad-depth": 2,
    reserve: 1,
  };
  return ranks[normalized];
}

export function caresAboutGameTime(role: SquadRole | string): boolean {
  const normalized = normalizeSquadRole(role);
  return normalized === "key-player" || normalized === "first-team";
}

/** @deprecated Use evaluateSquadRole — kept for call sites mid-migration. */
export function inferSquadRole(
  rating: number,
  inStartingXiii: boolean,
  age?: number,
  seasonAppearances = 0
): SquadRole {
  return evaluateSquadRole({
    rating,
    age,
    inStartingXiii,
    seasonAppearances,
  });
}
