import { getPlayerById } from "../players";
import { syncPlayerValueFromRating } from "../players/ratings";
import type { ManagerCareer, ManagerReservePlayer } from "./types";
import type { ChampionshipGeneratedPlayer } from "./championship/championshipSquads";
import { GENERATED_CHAMPIONSHIP_SQUADS_VERSION } from "./championship/championshipSquads";

/** Save marker — Current/Historic floor 80 rebalance. */
export const PLAYER_RATING_SCHEMA_VERSION = 3;

/**
 * Map legacy Championship ratings (approx 50–82) into the temporary 80–89 band
 * used by schema v3. Schema v4 then restores the correct 70–89 Championship scale.
 * Values already in 70–79 (corrected scale) are preserved.
 */
export function migrateChampionshipGeneratedRating(oldRating: number): number {
  if (!Number.isFinite(oldRating)) return 76;
  // Corrected Championship scale — do not lift to 80.
  if (oldRating >= 70 && oldRating < 80) return Math.round(oldRating);
  if (oldRating >= 80 && oldRating <= 89) return Math.round(oldRating);
  if (oldRating > 89) return Math.min(89, Math.round(oldRating));
  const clamped = Math.max(50, Math.min(82, oldRating));
  const t = (clamped - 50) / 32;
  return Math.max(80, Math.min(89, Math.round(80 + t * 9)));
}

function migrateReserve(reserve: ManagerReservePlayer): ManagerReservePlayer {
  const rating = Math.max(80, Math.min(99, Math.round(reserve.rating)));
  const potentialRating = Math.max(
    rating,
    Math.max(80, Math.min(99, Math.round(reserve.potentialRating)))
  );
  const signedRating =
    reserve.signedRating != null
      ? Math.max(80, Math.min(99, Math.round(reserve.signedRating)))
      : reserve.signedRating;
  const baseRating =
    reserve.baseRating != null
      ? Math.max(80, Math.min(99, Math.round(reserve.baseRating)))
      : reserve.baseRating;
  return {
    ...reserve,
    rating,
    potentialRating,
    signedRating,
    baseRating,
  };
}

/**
 * Migrate a career to playerRatingSchemaVersion 3.
 * - DB players: refresh peakRating from canonical ID
 * - Development: keep growth above the new canonical floor
 * - Championship generated: deterministic 50–82 → 80–89 convert
 * - Reserves: floor ability/potential at 80
 */
export function migratePlayerRatingsV3(career: ManagerCareer): ManagerCareer {
  if ((career.playerRatingSchemaVersion ?? 0) >= PLAYER_RATING_SCHEMA_VERSION) {
    return career;
  }

  const playerRegistry = { ...(career.playerRegistry ?? {}) };
  for (const [id, saved] of Object.entries(playerRegistry)) {
    const canonical = getPlayerById(id);
    if (canonical) {
      const oldSaved = saved.peakRating;
      const base = canonical.peakRating;
      const growthAboveOldFloor = Math.max(0, oldSaved - 75);
      // Preserve modest in-save development without treating old 80 as elite.
      const nextRating = Math.max(
        base,
        Math.min(99, base + Math.min(3, Math.floor(growthAboveOldFloor / 4)))
      );
      playerRegistry[id] = syncPlayerValueFromRating({
        ...saved,
        ...canonical,
        peakRating: nextRating,
        club: saved.club || canonical.club,
      });
      continue;
    }

    if (id.startsWith("generated-championship-")) {
      const nextRating = migrateChampionshipGeneratedRating(saved.peakRating);
      playerRegistry[id] = syncPlayerValueFromRating({
        ...saved,
        peakRating: nextRating,
      });
      continue;
    }

    playerRegistry[id] = syncPlayerValueFromRating({
      ...saved,
      peakRating: Math.max(80, Math.min(99, Math.round(saved.peakRating))),
    });
  }

  const playerDevelopment = { ...(career.playerDevelopment ?? {}) };
  for (const [id, dev] of Object.entries(playerDevelopment)) {
    const canonical = getPlayerById(id)?.peakRating;
    const floor = canonical ?? 80;
    const rating = Math.max(floor, Math.max(80, Math.min(99, Math.round(dev.rating))));
    const potential = Math.max(
      rating,
      Math.max(80, Math.min(99, Math.round(dev.potential ?? rating)))
    );
    playerDevelopment[id] = {
      ...dev,
      rating,
      peakRating: Math.max(dev.peakRating ?? rating, rating),
      potential,
      seasonStartRating:
        dev.seasonStartRating != null
          ? Math.max(80, Math.min(99, Math.round(dev.seasonStartRating)))
          : dev.seasonStartRating,
    };
  }

  let championshipSquads = career.championshipSquads;
  if (championshipSquads) {
    const players: Record<string, ChampionshipGeneratedPlayer> = {};
    for (const [id, p] of Object.entries(championshipSquads.players)) {
      players[id] = {
        ...p,
        peakRating: migrateChampionshipGeneratedRating(p.peakRating),
      };
    }
    championshipSquads = {
      ...championshipSquads,
      version: Math.max(
        championshipSquads.version,
        GENERATED_CHAMPIONSHIP_SQUADS_VERSION
      ),
      players,
    };
  }

  const reserves = (career.reserves ?? []).map(migrateReserve);

  const settings = career.managerSettings
    ? {
        ...career.managerSettings,
        reserveDevelopmentSettings: {
          ...career.managerSettings.reserveDevelopmentSettings,
          releaseIfRatingBelow: Math.max(
            80,
            career.managerSettings.reserveDevelopmentSettings
              ?.releaseIfRatingBelow ?? 80
          ),
          flagPotentialBelow: Math.max(
            82,
            career.managerSettings.reserveDevelopmentSettings
              ?.flagPotentialBelow ?? 82
          ),
          fullTimeRatingThreshold: Math.max(
            84,
            career.managerSettings.reserveDevelopmentSettings
              ?.fullTimeRatingThreshold ?? 84
          ),
        },
      }
    : career.managerSettings;

  return {
    ...career,
    playerRegistry,
    playerDevelopment,
    championshipSquads,
    reserves,
    managerSettings: settings,
    generatedChampionshipSquadsVersion:
      championshipSquads?.version ?? career.generatedChampionshipSquadsVersion,
    playerRatingSchemaVersion: PLAYER_RATING_SCHEMA_VERSION,
  };
}
