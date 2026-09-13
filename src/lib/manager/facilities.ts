/**
 * Club Facilities, Infrastructure Upgrades & Player Career Investments Engine.
 * Allows managers to invest club treasury funds to upgrade facilities,
 * expand stadium capacity, and sponsor player career development programs.
 */

import type {
  ClubFacilities,
  CompetitionId,
  FacilityType,
  FinancialTransaction,
  ManagerClub,
  ManagerPlayer,
  ManagerState,
  PlayerCareerBuff,
  PlayerInvestmentType,
} from "./types";

export interface FacilityDefinition {
  type: FacilityType;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  perks: string[];
}

export const FACILITY_DEFINITIONS: Record<FacilityType, FacilityDefinition> = {
  training: {
    type: "training",
    name: "Senior Training Ground",
    shortName: "Training Pitch & Gym",
    icon: "🏋️",
    description: "State-of-the-art weights facility, video theatre, and pristine training pitches.",
    perks: [
      "Accelerates weekly rating development for young and prime players",
      "Increases team tactical preparation and matchday sharpness",
      "Improves skill execution in competitive matches",
    ],
  },
  youth: {
    type: "youth",
    name: "Youth Academy Complex",
    shortName: "Academy Campus",
    icon: "⭐",
    description: "Dedicated junior development centre, dormitory accommodation, and high-performance pitches.",
    perks: [
      "Generates higher initial ratings for new youth trialists",
      "Boosts potential ceilings (+2 to +4) for generated academy recruits",
      "Accelerates youth development (ages 17–21)",
    ],
  },
  medical: {
    type: "medical",
    name: "Medical & Rehabilitation Centre",
    shortName: "Medical & Rehab",
    icon: "🏥",
    description: "Advanced physiotherapy rooms, hydrotherapy pools, and diagnostic imaging equipment.",
    perks: [
      "Accelerates injury recovery (players heal 1–2 weeks faster)",
      "Reduces in-match injury occurrence through superior preventative physio",
      "Speeds up post-match recovery and treatment of minor knocks",
    ],
  },
  performance: {
    type: "performance",
    name: "Sports Science & Conditioning Lab",
    shortName: "Sports Science Lab",
    icon: "🧬",
    description: "Cryotherapy chambers, GPS tracking telemetry, and tailored nutrition science.",
    perks: [
      "Sheds weekly fatigue faster (+8 to +15 fatigue recovery per week)",
      "Maintains higher baseline match fitness",
      "Delays veteran physical decline, extending player careers into their mid-30s",
    ],
  },
  analytics: {
    type: "analytics",
    name: "Video Analysis & Tactical Suite",
    shortName: "Tactical Analytics",
    icon: "📊",
    description: "High-definition drone footage analysis, statistical modeling, and opposition scouting.",
    perks: [
      "Stabilizes matchday form and insulates against severe slumps",
      "Improves tactical discipline and reduces sin-bin / yellow card rates",
      "Enhances in-game decision making and drop goal precision",
    ],
  },
};

export interface PlayerInvestmentDefinition {
  type: PlayerInvestmentType;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  effects: string[];
}

export const PLAYER_INVESTMENT_DEFINITIONS: Record<PlayerInvestmentType, PlayerInvestmentDefinition> = {
  elite_masterclass: {
    type: "elite_masterclass",
    name: "Elite Skills Masterclass & Leadership Camp",
    icon: "⚡",
    tagline: "Breakthrough development for high-upside players",
    description: "Intensive 1-on-1 mentoring masterclass with rugby league legends and skill specialists.",
    effects: [
      "+2 Potential Ceiling permanently",
      "+1 Immediate Overall Rating increase",
      "+15 Player Morale and peak confidence",
    ],
  },
  accelerated_rehab: {
    type: "accelerated_rehab",
    name: "Specialist Orthopaedic & Accelerated Rehab",
    icon: "🩹",
    tagline: "Fast-track recovery for injured players",
    description: "Sends an injured player to a world-leading private sports medicine clinic for accelerated therapy.",
    effects: [
      "Instantly removes 2 to 3 weeks of remaining injury duration",
      "Clears injury immediately if remaining time is 2 weeks or less",
      "Provides mental peace of mind and recovery morale boost",
    ],
  },
  physical_transformation: {
    type: "physical_transformation",
    name: "Biomechanics & Physical Transformation",
    icon: "💪",
    tagline: "Peak conditioning, fatigue reset & veteran longevity",
    description: "Intensive physiological reconditioning program addressing muscular imbalances and stamina.",
    effects: [
      "Resets player Fatigue to 0 immediately",
      "Restores Match Fitness to 100",
      "Delays age-related decline for veterans (30+) for the rest of the season",
      "Grants 25% injury risk reduction for the remainder of the season",
    ],
  },
  sports_psychology: {
    type: "sports_psychology",
    name: "Sports Psychology & Mental Toughness Clinic",
    icon: "🧠",
    tagline: "Unshakable form, morale & big-game focus",
    description: "Comprehensive psychological coaching focusing on resilience, clutch execution, and composure.",
    effects: [
      "Instantly locks Morale to 100",
      "Sets player Form to 8.5+",
      "Guarantees form stability against post-loss slumps for 8 weeks",
    ],
  },
};

/**
 * Returns the upgrade cost in GBP for the next star level of a facility.
 * Returns null if the facility is already at maximum level (5 stars).
 */
export function getFacilityUpgradeCost(
  currentLevel: number,
  competitionId: CompetitionId = "championship"
): number | null {
  if (currentLevel >= 5) return null;

  const isSL = competitionId === "super-league";

  switch (currentLevel) {
    case 1: // Upgrade to 2 Stars
      return isSL ? 120_000 : 75_000;
    case 2: // Upgrade to 3 Stars
      return isSL ? 220_000 : 140_000;
    case 3: // Upgrade to 4 Stars
      return isSL ? 360_000 : 230_000;
    case 4: // Upgrade to 5 Stars (World Class)
      return isSL ? 550_000 : 360_000;
    default:
      return null;
  }
}

/**
 * Returns the upgrade cost in GBP for the next star level of coaching staff.
 * Returns null if coaching quality is already at maximum (5 stars).
 */
export function getCoachingUpgradeCost(
  currentQuality: number,
  competitionId: CompetitionId = "championship"
): number | null {
  if (currentQuality >= 5) return null;

  const isSL = competitionId === "super-league";

  switch (currentQuality) {
    case 1:
      return isSL ? 90_000 : 55_000;
    case 2:
      return isSL ? 160_000 : 105_000;
    case 3:
      return isSL ? 260_000 : 175_000;
    case 4:
      return isSL ? 400_000 : 270_000;
    default:
      return null;
  }
}

/**
 * Returns cost in GBP to add seats to the club stadium.
 */
export function getStadiumExpansionCost(
  additionalSeats: number,
  competitionId: CompetitionId = "championship"
): number {
  const isSL = competitionId === "super-league";
  const costPerSeat = isSL ? 115 : 85;
  return Math.round(additionalSeats * costPerSeat);
}

/**
 * Returns cost in GBP for a direct player career investment program.
 */
export function getPlayerInvestmentCost(
  programType: PlayerInvestmentType,
  competitionId: CompetitionId = "championship"
): number {
  const isSL = competitionId === "super-league";

  switch (programType) {
    case "elite_masterclass":
      return isSL ? 50_000 : 30_000;
    case "accelerated_rehab":
      return isSL ? 40_000 : 24_000;
    case "physical_transformation":
      return isSL ? 35_000 : 22_000;
    case "sports_psychology":
      return isSL ? 25_000 : 15_000;
  }
}

/**
 * Checks whether an individual player can receive a specific career investment program.
 */
export function canPlayerReceiveInvestment(
  player: ManagerPlayer,
  programType: PlayerInvestmentType
): { eligible: boolean; reason?: string } {
  if (player.isRetired) {
    return { eligible: false, reason: "Player has retired from active rugby league." };
  }

  const existingBuffs = player.careerBuffs || [];

  switch (programType) {
    case "accelerated_rehab":
      if (!player.injury) {
        return { eligible: false, reason: "Player is completely healthy with zero active injuries." };
      }
      return { eligible: true };

    case "elite_masterclass": {
      const timesAttended = existingBuffs.filter((b) => b.type === "elite_masterclass").length;
      if (timesAttended >= 1) {
        return { eligible: false, reason: "Player has already completed this masterclass program." };
      }
      if (player.rating >= 96) {
        return { eligible: false, reason: "Player has already reached world-class generational rating ceiling." };
      }
      return { eligible: true };
    }

    case "physical_transformation": {
      const hadThisSeason = existingBuffs.some(
        (b) => b.type === "physical_transformation" && b.appliedSeason === 2026
      );
      if (hadThisSeason) {
        return { eligible: false, reason: "Player has already completed a Physical Transformation regime this season." };
      }
      return { eligible: true };
    }

    case "sports_psychology": {
      if (player.morale >= 98 && player.form >= 8.5) {
        return { eligible: false, reason: "Player already possesses peak 100 morale and elite 8.5+ form." };
      }
      return { eligible: true };
    }
  }
}

/**
 * Upgrades a club facility by one star level.
 * Pure state transition function.
 */
export function upgradeClubFacility(
  state: ManagerState,
  clubId: string,
  facilityType: FacilityType
): { success: boolean; error?: string; state: ManagerState } {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, error: "Club not found in universe.", state };
  }

  const facilities: ClubFacilities = {
    training: club.facilities.training || 3,
    youth: club.facilities.youth || 3,
    medical: club.facilities.medical || Math.min(5, Math.max(1, club.facilities.training || 3)),
    performance: club.facilities.performance || Math.min(5, Math.max(1, club.facilities.training || 3)),
    analytics: club.facilities.analytics || Math.min(5, Math.max(1, (club.facilities.training || 3) - 1 || 1)),
    stadiumCapacity: club.facilities.stadiumCapacity,
  };

  const currentLevel = facilities[facilityType] || 1;
  const cost = getFacilityUpgradeCost(currentLevel, club.competitionId);

  if (cost === null || currentLevel >= 5) {
    return { success: false, error: "Facility is already upgraded to maximum 5-star standard.", state };
  }

  if (club.finances.balance < cost) {
    return {
      success: false,
      error: `Insufficient treasury funds. Upgrade costs £${cost.toLocaleString()}, available balance is £${club.finances.balance.toLocaleString()}.`,
      state,
    };
  }

  const newLevel = currentLevel + 1;
  const facilityDef = FACILITY_DEFINITIONS[facilityType];

  const updatedFacilities: ClubFacilities = {
    ...facilities,
    [facilityType]: newLevel,
  };

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const transaction: FinancialTransaction = {
    id: `tx_fac_${facilityType}_${Date.now()}`,
    season: currentSeason,
    week: currentWeek,
    amount: -cost,
    category: "facilities",
    description: `Infrastructure Upgrade: ${facilityDef.name} upgraded to ★${newLevel}`,
  };

  const updatedClub: ManagerClub = {
    ...club,
    facilities: updatedFacilities,
    boardConfidence: Math.min(100, club.boardConfidence + 3),
    finances: {
      ...club.finances,
      balance: club.finances.balance - cost,
      seasonExpenses: club.finances.seasonExpenses + cost,
      history: [transaction, ...club.finances.history],
    },
  };

  return {
    success: true,
    state: {
      ...state,
      clubs: {
        ...state.clubs,
        [clubId]: updatedClub,
      },
    },
  };
}

/**
 * Upgrades club coaching staff standard by one star level.
 * Pure state transition function.
 */
export function upgradeCoachingStaff(
  state: ManagerState,
  clubId: string
): { success: boolean; error?: string; state: ManagerState } {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, error: "Club not found in universe.", state };
  }

  const currentLevel = club.coachingQuality || 3;
  const cost = getCoachingUpgradeCost(currentLevel, club.competitionId);

  if (cost === null || currentLevel >= 5) {
    return { success: false, error: "Coaching staff is already at maximum 5-star standard.", state };
  }

  if (club.finances.balance < cost) {
    return {
      success: false,
      error: `Insufficient treasury funds. Upgrade costs £${cost.toLocaleString()}, available balance is £${club.finances.balance.toLocaleString()}.`,
      state,
    };
  }

  const newLevel = currentLevel + 1;
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const transaction: FinancialTransaction = {
    id: `tx_coach_${Date.now()}`,
    season: currentSeason,
    week: currentWeek,
    amount: -cost,
    category: "facilities",
    description: `Staff Investment: Coaching standard upgraded to ★${newLevel}`,
  };

  const updatedClub: ManagerClub = {
    ...club,
    coachingQuality: newLevel,
    boardConfidence: Math.min(100, club.boardConfidence + 2),
    finances: {
      ...club.finances,
      balance: club.finances.balance - cost,
      seasonExpenses: club.finances.seasonExpenses + cost,
      history: [transaction, ...club.finances.history],
    },
  };

  return {
    success: true,
    state: {
      ...state,
      clubs: {
        ...state.clubs,
        [clubId]: updatedClub,
      },
    },
  };
}

/**
 * Expands club stadium seating capacity.
 * Pure state transition function.
 */
export function expandStadium(
  state: ManagerState,
  clubId: string,
  additionalSeats = 2000
): { success: boolean; error?: string; state: ManagerState } {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, error: "Club not found in universe.", state };
  }

  const currentCapacity = club.facilities.stadiumCapacity || 8000;
  if (currentCapacity + additionalSeats > 75000) {
    return { success: false, error: "Stadium has reached maximum permitted grounds expansion limit (75,000 capacity).", state };
  }

  const cost = getStadiumExpansionCost(additionalSeats, club.competitionId);

  if (club.finances.balance < cost) {
    return {
      success: false,
      error: `Insufficient treasury funds. Expansion of ${additionalSeats.toLocaleString()} seats costs £${cost.toLocaleString()}, balance is £${club.finances.balance.toLocaleString()}.`,
      state,
    };
  }

  const newCapacity = currentCapacity + additionalSeats;
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const transaction: FinancialTransaction = {
    id: `tx_stadium_${Date.now()}`,
    season: currentSeason,
    week: currentWeek,
    amount: -cost,
    category: "facilities",
    description: `Ground Development: +${additionalSeats.toLocaleString()} seats added to ${club.stadiumName} (Now ${newCapacity.toLocaleString()})`,
  };

  const updatedClub: ManagerClub = {
    ...club,
    facilities: {
      ...club.facilities,
      stadiumCapacity: newCapacity,
    },
    boardConfidence: Math.min(100, club.boardConfidence + 3),
    finances: {
      ...club.finances,
      balance: club.finances.balance - cost,
      seasonExpenses: club.finances.seasonExpenses + cost,
      history: [transaction, ...club.finances.history],
    },
  };

  return {
    success: true,
    state: {
      ...state,
      clubs: {
        ...state.clubs,
        [clubId]: updatedClub,
      },
    },
  };
}

/**
 * Invests club funds directly into an individual player's career program.
 * Applies authentic stat buffs, potential ceiling lifts, or injury reductions.
 * Pure state transition function.
 */
export function investInPlayer(
  state: ManagerState,
  clubId: string,
  playerId: string,
  programType: PlayerInvestmentType
): { success: boolean; error?: string; state: ManagerState } {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, error: "Club not found.", state };
  }

  const player = state.players[playerId];
  if (!player) {
    return { success: false, error: "Player not found.", state };
  }

  if (player.clubId !== clubId && player.loan?.destinationClubId !== clubId) {
    return { success: false, error: "You can only fund career programs for players currently registered with your squad.", state };
  }

  const eligibility = canPlayerReceiveInvestment(player, programType);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason || "Player is not eligible for this program.", state };
  }

  const cost = getPlayerInvestmentCost(programType, club.competitionId);
  if (club.finances.balance < cost) {
    return {
      success: false,
      error: `Insufficient treasury funds. Program costs £${cost.toLocaleString()}, available balance is £${club.finances.balance.toLocaleString()}.`,
      state,
    };
  }

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;
  const programDef = PLAYER_INVESTMENT_DEFINITIONS[programType];

  let updatedPlayer: ManagerPlayer = { ...player };
  const existingBuffs: PlayerCareerBuff[] = [...(player.careerBuffs || [])];

  switch (programType) {
    case "elite_masterclass": {
      const newPot = Math.min(99, player.potential + 2);
      const newRating = Math.min(newPot, player.rating + 1);
      const buff: PlayerCareerBuff = {
        id: `buff_mc_${Date.now()}`,
        type: "elite_masterclass",
        title: "Elite Skills Masterclass Alum",
        description: "+2 Potential Ceiling and enhanced technical execution.",
        appliedSeason: currentSeason,
        appliedWeek: currentWeek,
      };
      existingBuffs.push(buff);
      updatedPlayer = {
        ...updatedPlayer,
        potential: newPot,
        rating: newRating,
        morale: Math.min(100, updatedPlayer.morale + 15),
        careerBuffs: existingBuffs,
      };
      break;
    }

    case "accelerated_rehab": {
      if (updatedPlayer.injury) {
        const remaining = updatedPlayer.injury.weeksRemaining - 3;
        const buff: PlayerCareerBuff = {
          id: `buff_rehab_${Date.now()}`,
          type: "accelerated_rehab",
          title: "Specialist Orthopaedic Treatment",
          description: "Fast-tracked clinical rehabilitation and recovery.",
          appliedSeason: currentSeason,
          appliedWeek: currentWeek,
        };
        existingBuffs.push(buff);
        updatedPlayer = {
          ...updatedPlayer,
          injury: remaining > 0 ? { ...updatedPlayer.injury, weeksRemaining: remaining } : null,
          morale: Math.min(100, updatedPlayer.morale + 10),
          careerBuffs: existingBuffs,
        };
      }
      break;
    }

    case "physical_transformation": {
      const buff: PlayerCareerBuff = {
        id: `buff_phys_${Date.now()}`,
        type: "physical_transformation",
        title: "Biomechanics & Physical Transformation",
        description: "Fatigue cleared, peak stamina, and age decline protection.",
        appliedSeason: currentSeason,
        appliedWeek: currentWeek,
      };
      existingBuffs.push(buff);
      updatedPlayer = {
        ...updatedPlayer,
        fatigue: 0,
        fitness: 100,
        morale: Math.min(100, updatedPlayer.morale + 10),
        careerBuffs: existingBuffs,
      };
      break;
    }

    case "sports_psychology": {
      const buff: PlayerCareerBuff = {
        id: `buff_psych_${Date.now()}`,
        type: "sports_psychology",
        title: "Sports Psychology Mastery",
        description: "100 Morale and elite 8.5+ form with slump insulation.",
        appliedSeason: currentSeason,
        appliedWeek: currentWeek,
      };
      existingBuffs.push(buff);
      updatedPlayer = {
        ...updatedPlayer,
        morale: 100,
        form: Math.max(8.5, updatedPlayer.form),
        careerBuffs: existingBuffs,
      };
      break;
    }
  }

  const transaction: FinancialTransaction = {
    id: `tx_p_invest_${Date.now()}`,
    season: currentSeason,
    week: currentWeek,
    amount: -cost,
    category: "facilities",
    description: `Player Investment: ${programDef.name} for ${player.name}`,
  };

  const updatedClub: ManagerClub = {
    ...club,
    finances: {
      ...club.finances,
      balance: club.finances.balance - cost,
      seasonExpenses: club.finances.seasonExpenses + cost,
      history: [transaction, ...club.finances.history],
    },
  };

  return {
    success: true,
    state: {
      ...state,
      clubs: {
        ...state.clubs,
        [clubId]: updatedClub,
      },
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
    },
  };
}
