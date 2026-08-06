import { syncPlayerValueFromRating } from "../players/ratings";
import {
  CHAMPIONSHIP_PLAYER_MIN_RATING,
  GENERATED_CHAMPIONSHIP_MAX_RATING,
} from "../players/rating-floors";
import type { ManagerCareer } from "./types";
import {
  championshipPlayerToPlayer,
  GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
} from "./championship/championshipSquads";
import { remapChampionshipFirstSeasonOverrated } from "./championship/championshipRatingScale";

/**
 * First-season Championship balance: generated max 83, bands 70–83.
 * Remaps peakRating > 80 for generated champ players without regenerating squads.
 */
export const CHAMPIONSHIP_FIRST_SEASON_BALANCE_VERSION = 3;

export function migrateChampionshipFirstSeasonBalance(
  career: ManagerCareer
): ManagerCareer {
  if (
    (career.championshipFirstSeasonBalanceVersion ?? 0) >=
    CHAMPIONSHIP_FIRST_SEASON_BALANCE_VERSION
  ) {
    return career;
  }

  let championshipSquads = career.championshipSquads;
  if (
    championshipSquads &&
    Object.keys(championshipSquads.players).length > 0
  ) {
    const remapped = remapChampionshipFirstSeasonOverrated(
      championshipSquads.players
    );
    championshipSquads = {
      ...championshipSquads,
      version: Math.max(
        championshipSquads.version,
        GENERATED_CHAMPIONSHIP_SQUADS_VERSION
      ),
      players: remapped,
    };
  }

  const playerRegistry = { ...(career.playerRegistry ?? {}) };
  for (const [id, saved] of Object.entries(playerRegistry)) {
    if (!id.startsWith("generated-championship-")) continue;
    const fromSquad = championshipSquads?.players[id];
    if (fromSquad) {
      playerRegistry[id] = championshipPlayerToPlayer(fromSquad);
      continue;
    }
    if (saved.peakRating <= 80) continue;
    const mapped = Math.max(
      CHAMPIONSHIP_PLAYER_MIN_RATING,
      Math.min(
        GENERATED_CHAMPIONSHIP_MAX_RATING,
        Math.round(
          CHAMPIONSHIP_PLAYER_MIN_RATING +
            ((Math.min(89, Math.max(81, saved.peakRating)) - 81) / 8) *
              (GENERATED_CHAMPIONSHIP_MAX_RATING - CHAMPIONSHIP_PLAYER_MIN_RATING)
        )
      )
    );
    playerRegistry[id] = syncPlayerValueFromRating({
      ...saved,
      peakRating: mapped,
    });
  }

  const playerDevelopment = { ...(career.playerDevelopment ?? {}) };
  for (const [id, dev] of Object.entries(playerDevelopment)) {
    if (!id.startsWith("generated-championship-")) continue;
    const squadRating = championshipSquads?.players[id]?.peakRating;
    const floor = squadRating ?? CHAMPIONSHIP_PLAYER_MIN_RATING;
    const rating = Math.max(
      CHAMPIONSHIP_PLAYER_MIN_RATING,
      Math.min(GENERATED_CHAMPIONSHIP_MAX_RATING, Math.round(dev.rating))
    );
    const aligned = squadRating != null ? Math.min(
      GENERATED_CHAMPIONSHIP_MAX_RATING,
      Math.max(floor, Math.min(rating, squadRating + 2))
    ) : rating;
    playerDevelopment[id] = {
      ...dev,
      rating: aligned,
      peakRating: Math.min(
        GENERATED_CHAMPIONSHIP_MAX_RATING,
        Math.max(dev.peakRating ?? aligned, aligned)
      ),
      potential: Math.max(
        aligned,
        Math.min(
          GENERATED_CHAMPIONSHIP_MAX_RATING,
          Math.round(dev.potential ?? aligned)
        )
      ),
      seasonStartRating:
        dev.seasonStartRating != null
          ? Math.max(
              CHAMPIONSHIP_PLAYER_MIN_RATING,
              Math.min(
                GENERATED_CHAMPIONSHIP_MAX_RATING,
                Math.round(dev.seasonStartRating)
              )
            )
          : dev.seasonStartRating,
    };
  }

  return {
    ...career,
    championshipSquads,
    playerRegistry,
    playerDevelopment,
    generatedChampionshipSquadsVersion:
      championshipSquads?.version ?? career.generatedChampionshipSquadsVersion,
    championshipFirstSeasonBalanceVersion:
      CHAMPIONSHIP_FIRST_SEASON_BALANCE_VERSION,
  };
}
