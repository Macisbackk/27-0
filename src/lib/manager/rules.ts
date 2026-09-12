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

export const SALARY_CAP = {
  "super-league": {
    annualCap: 2_100_000,
    weeklyCap: Math.round(2_100_000 / 52), // ~£40,385
    maxMarqueePlayers: 2,
    marqueeWeeklyCapCharge: Math.round(150_000 / 52), // Marquee player counts as £150k max against cap
    homegrownDiscountPct: 0.5, // 50% discount for academy graduates under 21
  },
  "championship": {
    annualCap: 1_000_000,
    weeklyCap: Math.round(1_000_000 / 52), // ~£19,230
    maxMarqueePlayers: 1,
    marqueeWeeklyCapCharge: Math.round(75_000 / 52),
    homegrownDiscountPct: 0.5,
  },
  "challenge-cup": {
    annualCap: 2_100_000,
    weeklyCap: Math.round(2_100_000 / 52),
    maxMarqueePlayers: 2,
    marqueeWeeklyCapCharge: Math.round(150_000 / 52),
    homegrownDiscountPct: 0.5,
  },
  "friendlies": {
    annualCap: 2_100_000,
    weeklyCap: Math.round(2_100_000 / 52),
    maxMarqueePlayers: 2,
    marqueeWeeklyCapCharge: Math.round(150_000 / 52),
    homegrownDiscountPct: 0.5,
  },
} as const;

export const CALENDAR_RULES = {
  PRE_SEASON_WEEKS: 2,
  REGULAR_SEASON_WEEKS: 26,
  PLAYOFF_WEEKS: 4,
  TOTAL_WEEKS: 32,
  TRANSFER_WINDOW_DEADLINE_WEEK: 24, // Transfers close after week 24
} as const;

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
    weekly = Math.round(weekly * 0.6); // Championship wages ~60% of SL
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
