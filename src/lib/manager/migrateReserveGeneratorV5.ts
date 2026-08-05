import type { ManagerCareer, ManagerReservePlayer } from "./types";
import {
  RESERVE_GENERATOR_VERSION,
  pickGeneratedReserveRating,
  pickPotential,
} from "./managerReserves";
import seedrandom from "seedrandom";

/**
 * One-shot remapping for opening generated reserves that still sit on the old
 * high bands. Preserves players who have already developed (rating > signed).
 */
export function migrateReserveGeneratorV5(
  career: ManagerCareer
): ManagerCareer {
  if ((career.reserveGeneratorVersion ?? 0) >= RESERVE_GENERATOR_VERSION) {
    return career;
  }

  const reserves = career.reserves.map((reserve, index) =>
    maybeRemapGeneratedReserve(career, reserve, index)
  );
  const youthProspects = career.youthProspects?.map((reserve, index) =>
    maybeRemapGeneratedReserve(career, reserve, index)
  );
  const leagueClubReserves = career.leagueClubReserves
    ? Object.fromEntries(
        Object.entries(career.leagueClubReserves).map(([club, list]) => [
          club,
          list.map((reserve, index) =>
            maybeRemapGeneratedReserve(career, reserve, index)
          ),
        ])
      )
    : career.leagueClubReserves;

  return {
    ...career,
    reserves,
    youthProspects,
    leagueClubReserves,
    reserveGeneratorVersion: RESERVE_GENERATOR_VERSION,
  };
}

function isGeneratedReserveId(id: string): boolean {
  return (
    id.startsWith("mgr-res-") ||
    id.startsWith("mgr-youth-") ||
    id.startsWith("reserve-") ||
    id.startsWith("youth-")
  );
}

function maybeRemapGeneratedReserve(
  career: ManagerCareer,
  reserve: ManagerReservePlayer,
  index: number
): ManagerReservePlayer {
  const stamped = reserve.ratingGeneration?.source === "generated-reserve";
  const looksGenerated = stamped || isGeneratedReserveId(reserve.id);
  if (!looksGenerated) return reserve;

  const signed = reserve.signedRating ?? reserve.baseRating ?? reserve.rating;
  const developed = reserve.rating > signed;
  if (developed) {
    return {
      ...reserve,
      ratingGeneration: reserve.ratingGeneration ?? {
        source: "generated-reserve",
        generatorVersion: RESERVE_GENERATOR_VERSION,
        baseRating: signed,
        developmentModifier: 0,
      },
    };
  }

  const oldVersion = reserve.ratingGeneration?.generatorVersion ?? 0;
  const needsRemap =
    oldVersion < RESERVE_GENERATOR_VERSION && reserve.rating >= 77;
  if (!needsRemap && stamped && oldVersion >= RESERVE_GENERATOR_VERSION) {
    return reserve;
  }
  if (!needsRemap && stamped) {
    return {
      ...reserve,
      ratingGeneration: {
        ...reserve.ratingGeneration!,
        generatorVersion: RESERVE_GENERATOR_VERSION,
      },
    };
  }
  if (!needsRemap) {
    return {
      ...reserve,
      ratingGeneration: {
        source: "generated-reserve",
        generatorVersion: RESERVE_GENERATOR_VERSION,
        baseRating: reserve.rating,
        developmentModifier: 0,
      },
    };
  }

  const rng = seedrandom(
    `${career.seed}-remap-res-v5-${reserve.id}-${index}`
  );
  const baseRating = pickGeneratedReserveRating(rng, 0);
  const potential = Math.max(
    baseRating,
    reserve.potentialRating,
    pickPotential(reserve.age, rng, 0)
  );

  return {
    ...reserve,
    rating: baseRating,
    baseRating,
    signedRating: reserve.signedRating ?? baseRating,
    potentialRating: potential,
    ratingGeneration: {
      source: "generated-reserve",
      generatorVersion: RESERVE_GENERATOR_VERSION,
      baseRating,
      developmentModifier: 0,
    },
  };
}
