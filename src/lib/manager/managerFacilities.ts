import type { ClubFacilities, FacilityType, ManagerCareer } from "./types";
import { getClubAttendanceProfile } from "./managerAttendance";
import {
  deductTransferFee,
  getTransferBudget,
  scaleManagerEconomy,
  syncManagerFinance,
} from "./managerFinance";

export const FACILITY_MAX_LEVEL = 5;

/** Cost to purchase each star level (index 0 = level 1). Scaled by economy. */
const UPGRADE_COSTS: Record<FacilityType, number[]> = {
  youth: [120_000, 180_000, 260_000, 380_000, 550_000],
  training: [140_000, 210_000, 300_000, 440_000, 620_000],
  stadium: [200_000, 350_000, 500_000, 750_000, 1_000_000],
  commercial: [100_000, 160_000, 240_000, 360_000, 520_000],
};

export const FACILITY_LABELS: Record<FacilityType, string> = {
  youth: "Youth academy",
  training: "Training facilities",
  stadium: "Stadium capacity",
  commercial: "Commercial & marketing",
};

export const FACILITY_DESCRIPTIONS: Record<FacilityType, string> = {
  youth:
    "Better academy graduates — higher starting ratings, potential floor, and more intake each season.",
  training:
    "Improved coaching — players are more likely to gain rating during the season.",
  stadium:
    "Expand stands and hospitality — raises maximum home attendance.",
  commercial:
    "Sponsorship and matchday revenue — bigger gate receipts and match fees.",
};

export function createDefaultClubFacilities(): ClubFacilities {
  return { youth: 0, training: 0, stadium: 0, commercial: 0 };
}

export function ensureClubFacilities(
  facilities?: ClubFacilities | null
): ClubFacilities {
  const base = createDefaultClubFacilities();
  if (!facilities) return base;
  return {
    youth: clampLevel(facilities.youth),
    training: clampLevel(facilities.training),
    stadium: clampLevel(facilities.stadium),
    commercial: clampLevel(facilities.commercial),
  };
}

function clampLevel(level: number): number {
  return Math.max(0, Math.min(FACILITY_MAX_LEVEL, Math.round(level)));
}

export function formatFacilityStars(level: number): string {
  const filled = Math.max(0, Math.min(FACILITY_MAX_LEVEL, level));
  return "★".repeat(filled) + "☆".repeat(FACILITY_MAX_LEVEL - filled);
}

export function getClubFacilities(career: ManagerCareer): ClubFacilities {
  return ensureClubFacilities(career.clubFacilities);
}

export function getFacilityLevel(
  career: ManagerCareer,
  type: FacilityType
): number {
  return getClubFacilities(career)[type];
}

export function getFacilityUpgradeCost(
  career: ManagerCareer,
  type: FacilityType
): number | null {
  const level = getFacilityLevel(career, type);
  if (level >= FACILITY_MAX_LEVEL) return null;
  const raw = UPGRADE_COSTS[type][level]!;
  return scaleManagerEconomy(raw);
}

export function getYouthIntakeBonus(level: number): number {
  if (level >= 5) return 2;
  if (level >= 3) return 1;
  return 0;
}

/** Multiplier on in-season youth/reserve growth chance. */
export function getYouthGrowthMultiplier(level: number): number {
  return 1 + clampLevel(level) * 0.06;
}

/** Multiplier on season-end and in-season player development. */
export function getTrainingDevelopmentMultiplier(level: number): number {
  return 1 + clampLevel(level) * 0.05;
}

export function getStadiumCapacityMultiplier(level: number): number {
  return 1 + clampLevel(level) * 0.04;
}

export function getCommercialGateMultiplier(level: number): number {
  return 1 + clampLevel(level) * 0.04;
}

export function getCommercialMatchIncomeMultiplier(level: number): number {
  return 1 + clampLevel(level) * 0.05;
}

export function getEffectiveStadiumCapacity(
  club: string,
  facilities: ClubFacilities
): number {
  const base = getClubAttendanceProfile(club).capacity;
  return Math.round(base * getStadiumCapacityMultiplier(facilities.stadium));
}

export function getFacilityEffectSummary(
  type: FacilityType,
  level: number
): string {
  const lv = clampLevel(level);
  switch (type) {
    case "youth":
      return lv === 0
        ? "Standard academy intake and prospect quality."
        : `+${getYouthIntakeBonus(lv)} intake/season · +${lv * 2} potential floor · +${lv * 2} starting rating`;
    case "training":
      return lv === 0
        ? "Baseline player development."
        : `+${Math.round((getTrainingDevelopmentMultiplier(lv) - 1) * 100)}% development chance`;
    case "stadium":
      return lv === 0
        ? "Current stadium size."
        : `+${Math.round((getStadiumCapacityMultiplier(lv) - 1) * 100)}% capacity`;
    case "commercial":
      return lv === 0
        ? "Standard matchday and broadcast income."
        : `+${Math.round((getCommercialGateMultiplier(lv) - 1) * 100)}% gate · +${Math.round((getCommercialMatchIncomeMultiplier(lv) - 1) * 100)}% match fees`;
  }
}

export function getNextFacilityEffectPreview(
  type: FacilityType,
  currentLevel: number
): string | null {
  if (currentLevel >= FACILITY_MAX_LEVEL) return null;
  return getFacilityEffectSummary(type, currentLevel + 1);
}

export function getFacilityDevelopmentMultiplier(career: ManagerCareer): number {
  const facilities = getClubFacilities(career);
  return (
    getYouthGrowthMultiplier(facilities.youth) *
    getTrainingDevelopmentMultiplier(facilities.training)
  );
}

export function purchaseFacilityUpgrade(
  career: ManagerCareer,
  type: FacilityType
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const facilities = getClubFacilities(career);
  const level = facilities[type];
  if (level >= FACILITY_MAX_LEVEL) {
    return { ok: false, error: "Facility is already at maximum level." };
  }

  const cost = getFacilityUpgradeCost(career, type);
  if (cost == null) {
    return { ok: false, error: "No upgrade available." };
  }
  if (getTransferBudget(career) < cost) {
    return { ok: false, error: "Insufficient transfer funds for this upgrade." };
  }

  const nextFacilities: ClubFacilities = {
    ...facilities,
    [type]: level + 1,
  };

  let next: ManagerCareer = deductTransferFee(career, cost);
  next = {
    ...next,
    clubFacilities: nextFacilities,
    updatedAt: new Date().toISOString(),
  };

  if (type === "stadium") {
    next = {
      ...next,
      attendanceData: {
        ...next.attendanceData,
        stadiumCapacity: getEffectiveStadiumCapacity(next.club, nextFacilities),
      },
    };
  }

  return { ok: true, career: syncManagerFinance(next) };
}
