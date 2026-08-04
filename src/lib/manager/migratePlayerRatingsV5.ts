import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { syncPlayerValueFromRating } from "../players/ratings";
import {
  RANDOM_FREE_AGENT_MAX_RATING,
  RANDOM_FREE_AGENT_MIN_RATING,
  RESERVE_MIN_RATING,
  clampRandomFreeAgentRating,
  clampReservePlayerRating,
} from "../players/rating-floors";
import {
  CURRENT_NINETY_PLUS_AUDIT_BY_ID,
  CURRENT_NINETY_PLUS_AUDIT_VERSION,
} from "../../../data/current-ninety-plus-audit";
import { CLUB_REPUTATION_SCHEMA_VERSION } from "../../../data/club-reputation";
import type { ManagerCareer, ManagerReservePlayer } from "./types";
import { migratePlayerRatingsV4 } from "./migratePlayerRatingsV4";

/** Schema 5: reserve floor correction + Current 90+ audit + FA band clamp. */
export const PLAYER_RATING_SCHEMA_VERSION = 5;

/** Reserve scale after mistaken V3 floor-80 pass. */
export const RESERVE_RATING_SCALE_VERSION = 2;

export const MANAGER_BOOST_HUB_VERSION = 1;

/**
 * Deterministic current ability from age + potential (not flat -10).
 * Mirrors reserve generation bands in managerReserves.ratingForAge.
 */
export function recalculateReserveRatingFromProfile(
  reserve: Pick<
    ManagerReservePlayer,
    "id" | "age" | "potentialRating" | "rating"
  >
): number {
  const rng = seedrandom(`${reserve.id}-v5-reserve-scale`);
  const potential = clampReservePlayerRating(
    Math.max(RESERVE_MIN_RATING, Math.round(reserve.potentialRating))
  );
  const age = Math.max(16, Math.min(36, Math.round(reserve.age)));

  let base: number;
  const roll = rng();
  if (age <= 18) {
    if (roll < 0.45) base = 70 + Math.floor(rng() * 3);
    else if (roll < 0.8) base = 73 + Math.floor(rng() * 3);
    else base = 76 + Math.floor(rng() * 3);
  } else if (age <= 20) {
    if (roll < 0.35) base = 72 + Math.floor(rng() * 3);
    else if (roll < 0.75) base = 75 + Math.floor(rng() * 4);
    else base = 79 + Math.floor(rng() * 3);
  } else if (age <= 23) {
    if (roll < 0.3) base = 74 + Math.floor(rng() * 3);
    else if (roll < 0.7) base = 77 + Math.floor(rng() * 4);
    else if (roll < 0.95) base = 81 + Math.floor(rng() * 3);
    else base = 84 + Math.floor(rng() * 2);
  } else {
    // Older reserves kept nearer prior ability but pulled out of false 80 floor.
    if (roll < 0.4) base = 76 + Math.floor(rng() * 4);
    else if (roll < 0.8) base = 80 + Math.floor(rng() * 4);
    else base = 84 + Math.floor(rng() * 2);
  }

  // High potential pulls current ability up slightly within reserve bands.
  const potBoost = potential >= 88 ? 2 : potential >= 84 ? 1 : 0;
  return clampReservePlayerRating(
    Math.min(potential, base + potBoost)
  );
}

function wasMistakenlyFloor80Reserve(reserve: ManagerReservePlayer): boolean {
  const rating = Math.round(reserve.rating);
  if (rating < 80 || rating > 85) return false;
  if (rating === 80) return true;
  const base = reserve.baseRating ?? reserve.signedRating;
  if (base === 80) return true;
  if (
    reserve.potentialRating >= rating + 5 &&
    reserve.age <= 24 &&
    rating <= 85
  ) {
    return true;
  }
  return false;
}

function migrateReserveV5(reserve: ManagerReservePlayer): ManagerReservePlayer {
  if (!wasMistakenlyFloor80Reserve(reserve)) {
    // Still enforce reserve floor 70 if somehow below.
    if (reserve.rating < RESERVE_MIN_RATING) {
      const rating = clampReservePlayerRating(reserve.rating);
      return {
        ...reserve,
        rating,
        baseRating: clampReservePlayerRating(
          reserve.baseRating ?? rating
        ),
        signedRating: clampReservePlayerRating(
          reserve.signedRating ?? rating
        ),
        potentialRating: Math.max(
          rating,
          clampReservePlayerRating(reserve.potentialRating)
        ),
      };
    }
    return reserve;
  }

  const rating = recalculateReserveRatingFromProfile(reserve);
  const potentialRating = Math.max(
    rating,
    clampReservePlayerRating(reserve.potentialRating)
  );
  return {
    ...reserve,
    rating,
    potentialRating,
    baseRating: rating,
    signedRating: rating,
  };
}

function migrateRandomFreeAgentRating(oldRating: number, playerId: string): number {
  if (!Number.isFinite(oldRating)) {
    return RANDOM_FREE_AGENT_MIN_RATING + 4;
  }
  // Exact 80 often means the old senior floor — re-band into 70–84.
  if (Math.round(oldRating) === 80) {
    const rng = seedrandom(`${playerId}-v5-fa-scale`);
    const roll = rng();
    if (roll < 0.35) return 70 + Math.floor(rng() * 3);
    if (roll < 0.65) return 73 + Math.floor(rng() * 3);
    if (roll < 0.85) return 76 + Math.floor(rng() * 3);
    if (roll < 0.95) return 79 + Math.floor(rng() * 3);
    return 82 + Math.floor(rng() * 3);
  }
  if (oldRating < RANDOM_FREE_AGENT_MIN_RATING || oldRating > RANDOM_FREE_AGENT_MAX_RATING) {
    return clampRandomFreeAgentRating(oldRating);
  }
  return Math.round(oldRating);
}

function applyNinetyPlusAuditToRegistry(
  career: ManagerCareer
): ManagerCareer["playerRegistry"] {
  const playerRegistry = { ...(career.playerRegistry ?? {}) };
  for (const [id, saved] of Object.entries(playerRegistry)) {
    const audit = CURRENT_NINETY_PLUS_AUDIT_BY_ID[id];
    if (!audit) continue;
    const canonical = getPlayerById(id);
    const base = audit.newRating;
    const growthAboveOld = Math.max(0, saved.peakRating - audit.oldRating);
    const nextRating = Math.max(
      base,
      Math.min(99, base + Math.min(2, Math.floor(growthAboveOld / 2)))
    );
    playerRegistry[id] = syncPlayerValueFromRating({
      ...saved,
      ...(canonical ?? {}),
      peakRating: nextRating,
      club: saved.club || canonical?.club || audit.club,
    });
  }
  return playerRegistry;
}

/**
 * Migrate a career to playerRatingSchemaVersion 5.
 * - Runs v4 first
 * - Recalculates reserves mistakenly clamped to 80 / forced 80–85 (age/potential)
 * - Clamps random FA (mgr-fa-*) into 70–84
 * - Applies Current 90+ audit to cached registry copies only
 * - Does not regenerate reserves wholesale or alter non-audit Current seniors
 */
export function migratePlayerRatingsV5(career: ManagerCareer): ManagerCareer {
  let next = migratePlayerRatingsV4(career);

  const schemaOk =
    (next.playerRatingSchemaVersion ?? 0) >= PLAYER_RATING_SCHEMA_VERSION;
  const reserveScaleOk =
    (next.reserveRatingScaleVersion ?? 0) >= RESERVE_RATING_SCALE_VERSION;
  const auditOk =
    (next.currentNinetyPlusAuditVersion ?? 0) >=
    CURRENT_NINETY_PLUS_AUDIT_VERSION;

  if (schemaOk && reserveScaleOk && auditOk) {
    return {
      ...next,
      clubReputationSchemaVersion:
        next.clubReputationSchemaVersion ?? CLUB_REPUTATION_SCHEMA_VERSION,
      managerBoostHubVersion:
        next.managerBoostHubVersion ?? MANAGER_BOOST_HUB_VERSION,
    };
  }

  let playerRegistry = { ...(next.playerRegistry ?? {}) };

  if (!reserveScaleOk) {
    for (const [id, saved] of Object.entries(playerRegistry)) {
      if (!id.startsWith("mgr-res-") && !id.startsWith("mgr-youth-")) continue;
      const asReserve: ManagerReservePlayer = {
        id,
        name: saved.name,
        age: next.seasonYear - (saved.birthYear ?? next.seasonYear - 20),
        nationality: saved.nationality ?? "England",
        position: saved.position,
        eligiblePositions: [saved.position],
        rating: saved.peakRating,
        potentialRating: saved.peakRating,
        developmentRate: 0.7,
        form: 60,
        fitness: 90,
        reserveAppearances: 0,
        reserveTries: 0,
        calledUpForNextMatch: false,
        baseRating: saved.peakRating,
        signedRating: saved.peakRating,
      };
      if (!wasMistakenlyFloor80Reserve(asReserve)) continue;
      const rating = recalculateReserveRatingFromProfile(asReserve);
      playerRegistry[id] = syncPlayerValueFromRating({
        ...saved,
        peakRating: rating,
      });
    }
  }

  // Random free agents
  for (const [id, saved] of Object.entries(playerRegistry)) {
    if (!id.startsWith("mgr-fa-")) continue;
    const mapped = migrateRandomFreeAgentRating(saved.peakRating, id);
    if (mapped === saved.peakRating) continue;
    playerRegistry[id] = syncPlayerValueFromRating({
      ...saved,
      peakRating: mapped,
    });
  }

  if (!auditOk) {
    playerRegistry = applyNinetyPlusAuditToRegistry({
      ...next,
      playerRegistry,
    });
  }

  const reserves = !reserveScaleOk
    ? (next.reserves ?? []).map(migrateReserveV5)
    : next.reserves;

  const leagueClubReserves = !reserveScaleOk && next.leagueClubReserves
    ? Object.fromEntries(
        Object.entries(next.leagueClubReserves).map(([club, list]) => [
          club,
          list.map(migrateReserveV5),
        ])
      )
    : next.leagueClubReserves;

  const youthProspects = !reserveScaleOk
    ? (next.youthProspects ?? []).map(migrateReserveV5)
    : next.youthProspects;

  // Development rows for audited Current players — align floor to new rating.
  const playerDevelopment = { ...(next.playerDevelopment ?? {}) };
  if (!auditOk) {
    for (const [id, dev] of Object.entries(playerDevelopment)) {
      const audit = CURRENT_NINETY_PLUS_AUDIT_BY_ID[id];
      if (!audit) continue;
      const floor = audit.newRating;
      const rating = Math.max(floor, Math.min(99, Math.round(dev.rating)));
      playerDevelopment[id] = {
        ...dev,
        rating,
        peakRating: Math.max(dev.peakRating ?? rating, rating),
        potential: Math.max(
          rating,
          Math.min(99, Math.round(dev.potential ?? rating))
        ),
        seasonStartRating:
          dev.seasonStartRating != null
            ? Math.max(floor, Math.min(99, Math.round(dev.seasonStartRating)))
            : dev.seasonStartRating,
      };
    }
  }

  return {
    ...next,
    playerRegistry,
    playerDevelopment,
    reserves,
    leagueClubReserves,
    youthProspects,
    playerRatingSchemaVersion: PLAYER_RATING_SCHEMA_VERSION,
    reserveRatingScaleVersion: RESERVE_RATING_SCALE_VERSION,
    currentNinetyPlusAuditVersion: CURRENT_NINETY_PLUS_AUDIT_VERSION,
    clubReputationSchemaVersion: CLUB_REPUTATION_SCHEMA_VERSION,
    managerBoostHubVersion: MANAGER_BOOST_HUB_VERSION,
  };
}
