/**
 * Configurable rules, caps, and constants for Manager Mode.
 */

import type { CompetitionId, Position } from "./types";

export const MANAGER_SAVE_VERSION = 1;

/** Standard matchday starting 13 positions in order: 1 to 13 */
export const STARTING_POSITIONS: Position[] = [
  "FULLBACK",      // 1
  "WING",          // 2
  "CENTRE",        // 3
  "CENTRE",        // 4
  "WING",          // 5
  "STAND_OFF",     // 6
  "SCRUM_HALF",    // 7
  "PROP",          // 8
  "HOOKER",        // 9
  "PROP",          // 10
  "SECOND_ROW",    // 11
  "SECOND_ROW",    // 12
  "LOOSE_FORWARD", // 13
];

/**
 * Salary cap — sized so a full first team can renew at market wages.
 * Pressure comes from stacking elites (full wage after marquee slots),
 * not from routine squad retention.
 */
export const SALARY_CAP = {
  "super-league": {
    annualCap: 3_200_000,
    weeklyCap: Math.round(3_200_000 / 52), // ~£61,538
    maxMarqueePlayers: 3,
    marqueeWeeklyCapCharge: Math.round(200_000 / 52), // Marquee counts as £200k/yr max against cap
    homegrownDiscountPct: 0.5, // 50% discount for academy graduates under 21
  },
  "championship": {
    annualCap: 1_600_000,
    weeklyCap: Math.round(1_600_000 / 52), // ~£30,769
    maxMarqueePlayers: 2,
    marqueeWeeklyCapCharge: Math.round(100_000 / 52),
    homegrownDiscountPct: 0.5,
  },
  "challenge-cup": {
    annualCap: 3_200_000,
    weeklyCap: Math.round(3_200_000 / 52),
    maxMarqueePlayers: 3,
    marqueeWeeklyCapCharge: Math.round(200_000 / 52),
    homegrownDiscountPct: 0.5,
  },
  "friendlies": {
    annualCap: 3_200_000,
    weeklyCap: Math.round(3_200_000 / 52),
    maxMarqueePlayers: 3,
    marqueeWeeklyCapCharge: Math.round(200_000 / 52),
    homegrownDiscountPct: 0.5,
  },
} as const;

/**
 * Only this many highest first-team wages count against the cap.
 * Extra depth / reserves / academy do not block routine renewals —
 * the cap exists to limit elite wage stacking, not paperwork.
 */
export const SALARY_CAP_COUNTABLE_FIRST_TEAM = 17;

/** Soft ceiling on elite first-team depth — stops endless 86+ stacking. */
export const ELITE_SQUAD_LIMITS = {
  "super-league": { minRating: 86, maxFirstTeam: 8 },
  "championship": { minRating: 84, maxFirstTeam: 4 },
  "challenge-cup": { minRating: 86, maxFirstTeam: 8 },
  "friendlies": { minRating: 86, maxFirstTeam: 8 },
} as const;

/** Loyalty renewals (≤ market ask, non-elite) get modest cap headroom. */
export const RENEWAL_CAP_BUFFER = {
  /** Fraction of weekly cap added as temporary room for loyalty renewals. */
  LOYALTY_HEADROOM_PCT: 0.12,
  /** Players at/above this rating do not get loyalty headroom. */
  ELITE_RATING_FLOOR: 86,
  /** Offered wage must stay within this multiple of market wage. */
  MAX_MARKET_MULTIPLIER: 1.12,
} as const;

export const CALENDAR_RULES = {
  PRE_SEASON_WEEKS: 2,
  REGULAR_SEASON_WEEKS: 26,
  PLAYOFF_WEEKS: 4,
  TOTAL_WEEKS: 32,
  TRANSFER_WINDOW_DEADLINE_WEEK: 24, // Transfers close after week 24
} as const;

/** Matchday squad must always be a full 17 (13 starters + 4 interchange). */
export const MATCHDAY_RULES = {
  STARTERS: 13,
  BENCH: 4,
  SQUAD_SIZE: 17,
} as const;

/** Academy and Reserves grades field a full 17 like the first team. */
export const DEVELOPMENT_SQUAD_SIZE = 17;

/**
 * Championship economy tuning — keep Super League cash untouched while
 * preventing second-tier clubs from stacking SL-level transfer war chests.
 */
export const CHAMPIONSHIP_ECONOMY = {
  TICKET_PRICE: 8,
  SUPER_LEAGUE_TICKET_PRICE: 22,
  COMMERCIAL_PER_REPUTATION: 500,
  SUPER_LEAGUE_COMMERCIAL_PER_REPUTATION: 3000,
  /** Crowd fill vs Super League model (weaker midweek/weekend Championship gates). */
  ATTENDANCE_FILL_MULTIPLIER: 0.6,
  /** Soft-cap retained cash when remaining in / relegated to Championship. */
  CARRYOVER_SOFT_CAP_BY_REPUTATION: {
    1: 60_000,
    2: 90_000,
    3: 120_000,
    4: 140_000,
    5: 160_000,
  } as Record<number, number>,
  DEFAULT_SEASON_PRIZE: 8_000,
  STARTING_BALANCE_TOP: 55_000,
  STARTING_BALANCE_DEFAULT: 25_000,
  /** Championship wages as a fraction of Super League market rates. */
  WAGE_MULTIPLIER: 0.75,
} as const;

/** Personal-terms negotiation — players accept below their full ask. */
export const CONTRACT_NEGOTIATION = {
  MIN_WEEKLY_WAGE: 200,
  /** Soft floor as a fraction of asking wage (negotiation room). */
  ACCEPTANCE_FLOOR_PCT: 0.85,
  /** Players moving clubs (transfer / free agent) ask slightly less. */
  MOVE_ASK_DISCOUNT: 0.95,
  /** Per contract year beyond the first, slight ask reduction (capped). */
  YEAR_ASK_DISCOUNT: 0.02,
  MAX_YEAR_ASK_DISCOUNT: 0.06,
} as const;

/**
 * Championship clubs pay a premium to prise players out of Super League,
 * especially elites — stops cash-rich Champ sides shopping the top division cheaply.
 */
export function getCrossDivisionTransferFeeMultiplier(
  buyingComp: CompetitionId,
  sellingComp: CompetitionId,
  rating: number
): number {
  if (buyingComp !== "championship" || sellingComp !== "super-league") {
    return 1;
  }
  if (rating >= 85) return 2.4;
  if (rating >= 80) return 2.0;
  if (rating >= 75) return 1.6;
  return 1.3;
}

export function calculateTransferFeeBetweenClubs(
  rating: number,
  potential: number,
  age: number,
  buyingComp: CompetitionId,
  sellingComp: CompetitionId
): number {
  const base = calculatePlayerValue(rating, potential, age);
  const mult = getCrossDivisionTransferFeeMultiplier(buyingComp, sellingComp, rating);
  return Math.max(5_000, Math.round((base * mult) / 1_000) * 1_000);
}

export function getChampionshipCarryoverSoftCap(reputation: number): number {
  const key = Math.max(1, Math.min(5, Math.round(reputation)));
  return CHAMPIONSHIP_ECONOMY.CARRYOVER_SOFT_CAP_BY_REPUTATION[key] ?? 100_000;
}

/** Wage valuation based on player rating and tier */
export function calculateMarketWage(rating: number, age: number, comp: CompetitionId): number {
  const baseRating = Math.max(40, Math.min(99, rating));
  // Super League: ratings 70-95 correspond to £500 - £8,000/week
  // Championship: ratings 55-80 correspond to £250 - £2,500/week
  let weekly = 300;
  if (baseRating >= 90) {
    weekly = 5500 + (baseRating - 90) * 800; // £5.5k - £12k
  } else if (baseRating >= 85) {
    weekly = 3500 + (baseRating - 85) * 400; // £3.5k - £5.5k
  } else if (baseRating >= 80) {
    weekly = 2000 + (baseRating - 80) * 300; // £2k - £3.5k
  } else if (baseRating >= 75) {
    weekly = 1200 + (baseRating - 75) * 160; // £1.2k - £2k
  } else if (baseRating >= 70) {
    weekly = 700 + (baseRating - 70) * 100; // £700 - £1.2k
  } else if (baseRating >= 65) {
    weekly = 450 + (baseRating - 65) * 50;
  } else {
    weekly = 300 + (baseRating - 40) * 6;
  }

  // Age premium / discount
  if (age < 21) {
    weekly = Math.round(weekly * 0.7); // Young players on lower wage scales
  } else if (age > 33) {
    weekly = Math.round(weekly * 0.85); // Older players taper
  }

  if (comp === "championship") {
    weekly = Math.round(weekly * CHAMPIONSHIP_ECONOMY.WAGE_MULTIPLIER);
  }

  return Math.max(200, Math.round(weekly / 50) * 50);
}

/** Player market transfer fee valuation based on rating, potential, age and contract length */
export function calculatePlayerValue(rating: number, potential: number, age: number): number {
  let baseValue = 10_000;
  if (rating >= 90) {
    baseValue = 350_000 + (rating - 90) * 100_000;
  } else if (rating >= 85) {
    baseValue = 180_000 + (rating - 85) * 34_000;
  } else if (rating >= 80) {
    baseValue = 80_000 + (rating - 80) * 20_000;
  } else if (rating >= 75) {
    baseValue = 35_000 + (rating - 75) * 9_000;
  } else if (rating >= 70) {
    baseValue = 15_000 + (rating - 70) * 4_000;
  } else {
    baseValue = 5_000 + Math.max(0, rating - 50) * 500;
  }

  // Potential upside multiplier for young players
  if (age <= 22 && potential > rating) {
    const upside = potential - rating;
    baseValue = Math.round(baseValue * (1 + upside * 0.08));
  } else if (age >= 32) {
    const declineYears = age - 31;
    baseValue = Math.round(baseValue * Math.max(0.2, 1 - declineYears * 0.2));
  }

  return Math.max(5_000, Math.round(baseValue / 1_000) * 1_000);
}
