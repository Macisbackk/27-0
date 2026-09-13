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
    const medicalQuality = club?.facilities?.medical || club?.facilities?.training || 3;
    let weeksHealed = 1;
    // High-end medical & rehab facilities accelerate injury recovery
    if (medicalQuality >= 5 && Math.random() < 0.65) {
      weeksHealed = 2;
    } else if (medicalQuality >= 4 && Math.random() < 0.40) {
      weeksHealed = 2;
    }

    const remaining = injury.weeksRemaining - weeksHealed;
    if (remaining <= 0) {
      injury = null;
      morale = Math.min(100, morale + 12); // Recovery morale boost
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

  // 3. Fatigue & Fitness progression based on training regime and Sports Science facilities
  const performanceQuality = club?.facilities?.performance || club?.facilities?.training || 3;
  const sportsScienceFatigueBonus = Math.max(0, (performanceQuality - 2) * 4); // +4 to +12 extra fatigue shed

  if (trainingFocus === "recovery") {
    fatigue = Math.max(0, fatigue - 35 - sportsScienceFatigueBonus);
    fitness = Math.min(100, fitness + 15 + Math.round(sportsScienceFatigueBonus / 2));
  } else if (trainingFocus === "fitness") {
    fatigue = Math.max(0, fatigue - 20 - sportsScienceFatigueBonus);
    fitness = Math.min(100, fitness + 25 + Math.round(sportsScienceFatigueBonus / 2));
  } else {
    // Normal / balanced / skill training
    if (intensity === "low") {
      fatigue = Math.max(0, fatigue - 25 - sportsScienceFatigueBonus);
    } else if (intensity === "normal") {
      fatigue = Math.max(0, fatigue - 15 - sportsScienceFatigueBonus);
    } else {
      // High intensity: fatigue stays higher or increases slightly
      fatigue = Math.max(0, fatigue - 5 - Math.round(sportsScienceFatigueBonus / 2));
    }
    fitness = Math.min(100, fitness + 10 + Math.round(sportsScienceFatigueBonus / 3));
  }

  // 4. Player Development & Rating Growth / Decline
  // Can only grow if healthy and not injured
  if (!injury && !player.isRetired) {
    const coachingQuality = club?.coachingQuality || 3;
    const facilitiesQuality = club?.facilities?.training || 3;
    const youthQuality = club?.facilities?.youth || 3;
    const hasMasterclass = player.careerBuffs?.some((b) => b.type === "elite_masterclass");
    const hasPhysicalBuff = player.careerBuffs?.some((b) => b.type === "physical_transformation");

    // Young players (17-23) with headroom develop fastest
    if (age <= 23 && rating < potential) {
      const headroom = potential - rating;
      let growthChance = 0.08 + (headroom * 0.015);

      // Training regime bonus
      if (trainingFocus === "development") growthChance += 0.06;
      if (intensity === "high") growthChance += 0.04;
      if (intensity === "low") growthChance -= 0.03;

      // Coaching, facilities & youth campus boost
      growthChance += (coachingQuality - 3) * 0.02 + (facilitiesQuality - 3) * 0.02;
      if (age <= 21) {
        growthChance += (youthQuality - 3) * 0.03;
      }
      if (hasMasterclass) {
        growthChance += 0.05; // Elite Masterclass alumni develop noticeably faster
      }

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
      let growthChance = 0.03 + (headroom * 0.01);
      growthChance += (coachingQuality - 3) * 0.015 + (facilitiesQuality - 3) * 0.015;
      if (hasMasterclass) growthChance += 0.03;
      if (Math.random() < Math.max(0.01, growthChance)) {
        rating = Math.min(potential, rating + 1);
      }
    } else if (age >= 32) {
      // Veteran physical decline: heavily mitigated by sports science lab and physical transformation buff
      let declineChance = (age - 31) * 0.04;
      if (performanceQuality >= 4) declineChance *= 0.65; // High sports science delays decline
      if (performanceQuality >= 5) declineChance *= 0.50;
      if (hasPhysicalBuff) declineChance *= 0.30; // Biomechanics transformation provides massive longevity boost

      if (Math.random() < declineChance && rating > 50) {
        rating -= 1;
      }
    }
  }

  // 5. Morale & Form natural reversion toward baseline, insulated by Sports Psychology & Analytics
  const analyticsQuality = club?.facilities?.analytics || 2;
  const hasPsychologyBuff = player.careerBuffs?.some((b) => b.type === "sports_psychology");
  const baselineMorale = hasPsychologyBuff ? 90 : (analyticsQuality >= 4 ? 80 : 75);

  if (morale > baselineMorale) {
    morale = Math.max(baselineMorale, morale - 1);
  } else if (morale < baselineMorale) {
    morale = Math.min(baselineMorale, morale + 1);
  }

  if (hasPsychologyBuff && form < 7.5) {
    form = 7.5; // Sports psychology prevents catastrophic slumps
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
