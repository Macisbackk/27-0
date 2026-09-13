/**
 * Hidden goal-kicking ability (1–99).
 * Real players use IRL-informed overrides where known; otherwise a
 * position-weighted deterministic roll from their id. Generated players
 * roll at creation — halfbacks dominate, props never kick well.
 */

import { PLAYER_GOAL_KICKING_OVERRIDES } from "../../../data/player-goal-kicking-overrides";
import type { ManagerPlayer, Position } from "./types";

function clampKick(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

/** Stable 0–1 RNG from a string seed (player id). */
export function seededUnit(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Roll a goal-kicking rating for a position.
 * Props are capped low. Halfbacks are usually strong. Other backs rarely excel.
 */
export function rollGoalKickingRating(
  position: Position,
  rng: () => number = Math.random
): number {
  if (position === "PROP") {
    // Never good — 32–48
    return clampKick(32 + Math.floor(rng() * 17));
  }

  if (
    position === "HOOKER" ||
    position === "SECOND_ROW" ||
    position === "LOOSE_FORWARD"
  ) {
    // Vast majority poor; tiny chance of a specialist (e.g. Rhyse Martin type)
    if (rng() < 0.035) {
      return clampKick(68 + Math.floor(rng() * 18)); // 68–85
    }
    return clampKick(38 + Math.floor(rng() * 18)); // 38–55
  }

  if (position === "WING" || position === "CENTRE" || position === "FULLBACK") {
    const roll = rng();
    if (roll < 0.1) {
      return clampKick(72 + Math.floor(rng() * 16)); // occasional specialist 72–87
    }
    if (roll < 0.3) {
      return clampKick(58 + Math.floor(rng() * 12)); // usable 58–69
    }
    return clampKick(40 + Math.floor(rng() * 18)); // ordinary 40–57
  }

  // SCRUM_HALF / STAND_OFF — majority are competent+ kickers
  const roll = rng();
  if (roll < 0.1) {
    return clampKick(90 + Math.floor(rng() * 8)); // elite 90–97
  }
  if (roll < 0.72) {
    return clampKick(74 + Math.floor(rng() * 16)); // majority good 74–89
  }
  if (roll < 0.92) {
    return clampKick(60 + Math.floor(rng() * 14)); // average half 60–73
  }
  return clampKick(48 + Math.floor(rng() * 12)); // rare weak half 48–59
}

/** Resolve effective goal-kicking (override → stored → seeded roll). */
export function getPlayerGoalKicking(player: ManagerPlayer): number {
  const override = PLAYER_GOAL_KICKING_OVERRIDES[player.id];
  if (typeof override === "number") {
    return clampKick(override);
  }
  if (typeof player.goalKicking === "number" && Number.isFinite(player.goalKicking)) {
    return clampKick(player.goalKicking);
  }
  return rollGoalKickingRating(player.position, seededUnit(`gk:${player.id}`));
}

/** Assign a stored goalKicking value for new / backfilled players. */
export function assignGoalKicking(
  playerId: string,
  position: Position,
  preferOverride = true
): number {
  if (preferOverride) {
    const override = PLAYER_GOAL_KICKING_OVERRIDES[playerId];
    if (typeof override === "number") return clampKick(override);
  }
  return rollGoalKickingRating(position, seededUnit(`gk:${playerId}`));
}

export function isEligibleGoalKickerPosition(position: Position): boolean {
  return position !== "PROP";
}

/** Best goal kicker in a pool (highest goalKicking; tie-break rating). */
export function pickBestGoalKicker(
  players: ManagerPlayer[]
): ManagerPlayer | undefined {
  const eligible = players.filter(
    (p) =>
      isEligibleGoalKickerPosition(p.position) &&
      !p.injury &&
      !p.suspension
  );
  if (eligible.length === 0) return undefined;
  return [...eligible].sort((a, b) => {
    const gk = getPlayerGoalKicking(b) - getPlayerGoalKicking(a);
    if (gk !== 0) return gk;
    return b.rating - a.rating;
  })[0];
}
