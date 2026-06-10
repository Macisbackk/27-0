import type { Player } from "../types";
import { ratingToValue } from "./ratings";
import { resolveCareerTries } from "./career-tries";
import { resolveYearsActive } from "./years-active";
import { isSuperSamHallasId } from "./super-sam-hallas";

/** Normal database Joe Mellor — recruitable in standard modes. */
export const JOE_MELLOR_NORMAL_ID = "bradford-cur-joe-mellor";

/** JM Mode exclusive 99-rated GOAT — never in public database. */
export const JOE_MELLOR_GOAT_ID = "jm-goat-joe-mellor";

/** @deprecated Use JOE_MELLOR_GOAT_ID for JM Mode */
export const JOE_MELLOR_ID = JOE_MELLOR_GOAT_ID;

const HIDDEN_PLAYER_IDS = new Set([JOE_MELLOR_GOAT_ID]);

export function isHiddenPlayer(playerOrId: Player | string): boolean {
  const id = typeof playerOrId === "string" ? playerOrId : playerOrId.id;
  return HIDDEN_PLAYER_IDS.has(id) || isSuperSamHallasId(id);
}

export function isGoatPlayer(player: Player): boolean {
  return player.id === JOE_MELLOR_GOAT_ID;
}

/** Synthetic 99-rated Joe Mellor — JM Mode only. */
export function createJoeMellorGoatPlayer(): Player {
  const peakRating = 99;
  return {
    id: JOE_MELLOR_GOAT_ID,
    name: "Joe Mellor",
    club: "Bradford Bulls",
    position: "LOOSE_FORWARD",
    nationality: "England",
    yearsActive: resolveYearsActive(
      JOE_MELLOR_NORMAL_ID,
      "2011–Present"
    ),
    category: "current",
    peakRating,
    rating: peakRating,
    value: ratingToValue(peakRating),
    tries: resolveCareerTries(JOE_MELLOR_NORMAL_ID, "current"),
    intlCaps: 0,
  };
}

export function getJoeMellorGoatPlayer(): Player {
  return createJoeMellorGoatPlayer();
}
