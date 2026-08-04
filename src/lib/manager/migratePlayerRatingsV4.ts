import { getPlayerById } from "../players";
import { syncPlayerValueFromRating } from "../players/ratings";
import {
  CHAMPIONSHIP_PLAYER_MIN_RATING,
  CURRENT_SUPER_LEAGUE_MIN_RATING,
} from "../players/rating-floors";
import type { ManagerCareer } from "./types";
import {
  championshipPlayerToPlayer,
  GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
} from "./championship/championshipSquads";
import { remapChampionshipSquadRatings } from "./championship/championshipRatingScale";
import { migratePlayerRatingsV3 } from "./migratePlayerRatingsV3";

/**
 * Schema 4: Championship restored to a separate 70–89 floor/scale.
 * Current & Historic keep floor 80 (unchanged by this migration).
 */
export const PLAYER_RATING_SCHEMA_VERSION = 4;

/** Championship-specific corrective scale after the mistaken floor-80 pass. */
export const CHAMPIONSHIP_RATING_SCALE_VERSION = 2;

/**
 * Migrate a career to playerRatingSchemaVersion 4.
 * - Runs v3 first if needed
 * - Remaps Championship generated ratings off the mistaken 80 floor
 * - Does not regenerate Championship squads or alter Current/Historic DB players
 */
export function migratePlayerRatingsV4(career: ManagerCareer): ManagerCareer {
  let next = migratePlayerRatingsV3(career);

  const schemaOk =
    (next.playerRatingSchemaVersion ?? 0) >= PLAYER_RATING_SCHEMA_VERSION;
  const champScaleOk =
    (next.championshipRatingScaleVersion ?? 0) >=
    CHAMPIONSHIP_RATING_SCALE_VERSION;
  if (schemaOk && champScaleOk) {
    return next;
  }

  let championshipSquads = next.championshipSquads;
  const needsChampRemap = !champScaleOk;

  if (
    needsChampRemap &&
    championshipSquads &&
    Object.keys(championshipSquads.players).length > 0
  ) {
    const ratings = Object.values(championshipSquads.players).map(
      (p) => p.peakRating
    );
    const minRating = Math.min(...ratings);
    // Only stretch when the mistaken floor-80 pass lifted everyone to 80+.
    // Fresh 70–89 generation already has depth below 80 — leave it alone.
    if (minRating >= CURRENT_SUPER_LEAGUE_MIN_RATING) {
      const remapped = remapChampionshipSquadRatings(championshipSquads.players);
      championshipSquads = {
        ...championshipSquads,
        version: Math.max(
          championshipSquads.version,
          GENERATED_CHAMPIONSHIP_SQUADS_VERSION
        ),
        players: remapped,
      };
    } else {
      championshipSquads = {
        ...championshipSquads,
        version: Math.max(
          championshipSquads.version,
          GENERATED_CHAMPIONSHIP_SQUADS_VERSION
        ),
      };
    }
  }

  const playerRegistry = { ...(next.playerRegistry ?? {}) };
  if (needsChampRemap) {
    for (const [id, saved] of Object.entries(playerRegistry)) {
      if (!id.startsWith("generated-championship-")) {
        continue;
      }
      const fromSquad = championshipSquads?.players[id];
      if (fromSquad) {
        playerRegistry[id] = championshipPlayerToPlayer(fromSquad);
        continue;
      }
      const old = saved.peakRating;
      const mapped =
        old >= CHAMPIONSHIP_PLAYER_MIN_RATING &&
        old < CURRENT_SUPER_LEAGUE_MIN_RATING
          ? Math.round(old)
          : Math.max(
              CHAMPIONSHIP_PLAYER_MIN_RATING,
              Math.min(
                89,
                Math.round(
                  CHAMPIONSHIP_PLAYER_MIN_RATING +
                    ((Math.min(89, Math.max(80, old)) - 80) / 9) * 19
                )
              )
            );
      playerRegistry[id] = syncPlayerValueFromRating({
        ...saved,
        peakRating: mapped,
      });
    }
  }

  const playerDevelopment = { ...(next.playerDevelopment ?? {}) };
  if (needsChampRemap) {
    for (const [id, dev] of Object.entries(playerDevelopment)) {
      if (!id.startsWith("generated-championship-")) continue;
      const squadRating = championshipSquads?.players[id]?.peakRating;
      const floor = squadRating ?? CHAMPIONSHIP_PLAYER_MIN_RATING;
      const rating = Math.max(
        CHAMPIONSHIP_PLAYER_MIN_RATING,
        Math.min(89, Math.round(dev.rating))
      );
      const aligned = squadRating != null ? Math.max(floor, rating) : rating;
      playerDevelopment[id] = {
        ...dev,
        rating: aligned,
        peakRating: Math.max(dev.peakRating ?? aligned, aligned),
        potential: Math.max(
          aligned,
          Math.min(89, Math.round(dev.potential ?? aligned))
        ),
        seasonStartRating:
          dev.seasonStartRating != null
            ? Math.max(
                CHAMPIONSHIP_PLAYER_MIN_RATING,
                Math.min(89, Math.round(dev.seasonStartRating))
              )
            : dev.seasonStartRating,
      };
    }
  }

  return {
    ...next,
    championshipSquads,
    playerRegistry,
    playerDevelopment,
    generatedChampionshipSquadsVersion:
      championshipSquads?.version ?? next.generatedChampionshipSquadsVersion,
    playerRatingSchemaVersion: PLAYER_RATING_SCHEMA_VERSION,
    championshipRatingScaleVersion: CHAMPIONSHIP_RATING_SCALE_VERSION,
  };
}

/** @deprecated Prefer migratePlayerRatingsV4 — kept for direct v3 tests. */
export { migratePlayerRatingsV3 };

/** Resolve canonical DB rating without touching Championship generated IDs. */
export function refreshCanonicalPlayerRating(playerId: string): number | null {
  const p = getPlayerById(playerId);
  return p?.peakRating ?? null;
}
