/**
 * Player development, ageing, training, form, morale, and health progression.
 * Pure simulation logic.
 */

import type {
  ManagerClub,
  ManagerPlayer,
  TrainingFocus,
  TrainingIntensity,
} from "./types";

/**
 * Weekly tick for training and development of a single player.
 */
export function progressPlayerWeek(
  player: ManagerPlayer,
  club: ManagerClub | undefined,
  intensity: TrainingIntensity = "normal"
): ManagerPlayer {
  let { rating, potential, age, fatigue, fitness, injury, suspension, morale, form, trainingFocus } = player;

  // 1. Injury progression
  if (injury) {
    const remaining = injury.weeksRemaining - 1;
    if (remaining <= 0) {
      injury = null;
      morale = Math.min(100, morale + 10); // Recovery morale boost
    } else {
      injury = { ...injury, weeksRemaining: remaining };
    }
  }

  // 2. Suspension progression
  if (suspension) {
    const remaining = suspension.weeksRemaining - 1;
    if (remaining <= 0) {
      suspension = null;
    } else {
      suspension = { ...suspension, weeksRemaining: remaining };
    }
  }

  // 3. Fatigue & Fitness progression based on training regime
  if (trainingFocus === "recovery") {
    fatigue = Math.max(0, fatigue - 35);
    fitness = Math.min(100, fitness + 15);
  } else if (trainingFocus === "fitness") {
    fatigue = Math.max(0, fatigue - 20);
    fitness = Math.min(100, fitness + 25);
  } else {
    // Normal / balanced / skill training
    if (intensity === "low") {
      fatigue = Math.max(0, fatigue - 25);
    } else if (intensity === "normal") {
      fatigue = Math.max(0, fatigue - 15);
    } else {
      // High intensity: fatigue stays higher or increases slightly
      fatigue = Math.max(0, fatigue - 5);
    }
    fitness = Math.min(100, fitness + 10);
  }

  // 4. Player Development & Rating Growth / Decline
  // Can only grow if healthy and not injured
  if (!injury && !player.isRetired) {
    const coachingQuality = club?.coachingQuality || 3;
    const facilitiesQuality = club?.facilities.training || 3;

    // Young players (17-23) with headroom develop fastest
    if (age <= 23 && rating < potential) {
      const headroom = potential - rating;
      let growthChance = 0.08 + (headroom * 0.015);

      // Training regime bonus
      if (trainingFocus === "development") growthChance += 0.06;
      if (intensity === "high") growthChance += 0.04;
      if (intensity === "low") growthChance -= 0.03;

      // Coaching & facilities boost
      growthChance += (coachingQuality - 3) * 0.02 + (facilitiesQuality - 3) * 0.02;

      // Morale boost: happy players develop faster
      if (morale >= 85) growthChance += 0.03;
      if (morale < 60) growthChance -= 0.05;

      // Playing time factor: players playing regular first team develop faster
      if (player.squadTier === "first" && player.stats.apps > 0) {
        growthChance += 0.05;
      }

      if (Math.random() < Math.max(0.02, growthChance)) {
        rating = Math.min(potential, rating + 1);
      }
    } else if (age >= 24 && age <= 28 && rating < potential) {
      // Prime development: slower incremental polish
      const headroom = potential - rating;
      const growthChance = 0.03 + (headroom * 0.01);
      if (Math.random() < growthChance) {
        rating = Math.min(potential, rating + 1);
      }
    } else if (age >= 32) {
      // Gradual veteran physical decline
      const declineChance = (age - 31) * 0.04;
      if (Math.random() < declineChance && rating > 50) {
        rating -= 1;
      }
    }
  }

  // 5. Morale natural reversion toward baseline (75)
  if (morale > 75) {
    morale = Math.max(75, morale - 1);
  } else if (morale < 75) {
    morale = Math.min(75, morale + 1);
  }

  return {
    ...player,
    rating,
    potential,
    fatigue,
    fitness,
    injury,
    suspension,
    morale,
    form,
  };
}

/**
 * Sets individual training focus for a player.
 */
export function setPlayerTrainingFocus(
  player: ManagerPlayer,
  focus: TrainingFocus
): ManagerPlayer {
  return {
    ...player,
    trainingFocus: focus,
  };
}
