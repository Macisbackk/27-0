import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import {
  getCommercialGateMultiplier,
  getEffectiveStadiumCapacity,
  ensureClubFacilities,
} from "./managerFacilities";
import { getClubBaseStrength } from "../game/club-strength";
import type {
  ClubAttendanceData,
  GateIncomeRecord,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  ManagerSeasonSummary,
  MatchAttendanceMeta,
} from "./types";
import type { MatchFixture } from "../game/season-simulation";
import { applyClubRevenue, splitRevenue } from "./managerFinance";
import { areRivalClubs } from "./managerRivals";
import { getUserLeagueTablePosition } from "./managerFixtures";
import {
  GRAND_FINAL_ATTENDANCE_MAX,
  GRAND_FINAL_ATTENDANCE_MIN,
  GRAND_FINAL_VENUE,
  isGrandFinalFixture,
} from "./managerPlayoffs";
import {
  MAGIC_WEEKEND_VENUE,
  calculateMagicWeekendAttendance,
  isMagicWeekendFixture,
} from "./managerMagicWeekend";
import {
  CHALLENGE_CUP_FINAL_ATTENDANCE_MAX,
  CHALLENGE_CUP_FINAL_ATTENDANCE_MIN,
  CHALLENGE_CUP_FINAL_VENUE,
  isChallengeCupFinalFixture,
} from "./managerChallengeCup";
import { isChampionshipClubName } from "../clubs/championship-clubs";

const FRENCH_SUPER_LEAGUE_CLUBS = new Set([
  "Catalans Dragons",
  "Toulouse Olympique",
]);

/**
 * Super League clubs with limited travelling support — same gate penalty as
 * Championship visitors (see hasPoorAwayFollowing).
 */
const POOR_AWAY_FOLLOWING_SL_CLUBS = new Set([
  "York Knights",
  "Huddersfield Giants",
]);

export function isFrenchSuperLeagueClub(club: string): boolean {
  return FRENCH_SUPER_LEAGUE_CLUBS.has(club);
}

export function isCrossChannelFixture(
  homeClub: string,
  visitingClub: string
): boolean {
  const homeFrench = isFrenchSuperLeagueClub(homeClub);
  const awayFrench = isFrenchSuperLeagueClub(visitingClub);
  return homeFrench !== awayFrench;
}

/** English host vs French visitor in a friendly — limited travelling support. */
export function expectsLimitedCrossChannelFriendlyAwaySupport(
  homeClub: string,
  visitingClub: string,
  competition?: ManagerCompetition
): boolean {
  return (
    competition === "friendly" &&
    isCrossChannelFixture(homeClub, visitingClub) &&
    !isFrenchSuperLeagueClub(homeClub)
  );
}

export const CLUB_ATTENDANCE_PROFILES: Record<
  string,
  { base: number; capacity: number; min?: number }
> = {
  "Wigan Warriors": { base: 13_500, capacity: 25_000 },
  "St Helens": { base: 12_000, capacity: 18_000 },
  "Leeds Rhinos": { base: 13_000, capacity: 21_000 },
  "Warrington Wolves": { base: 10_500, capacity: 15_000 },
  "Hull FC": { base: 11_000, capacity: 25_000 },
  "Hull KR": { base: 10_000, capacity: 12_000 },
  "Catalans Dragons": { base: 9_000, capacity: 13_000 },
  "Leigh Leopards": { base: 8_500, capacity: 12_000 },
  "Wakefield Trinity": { base: 6_500, capacity: 9_000 },
  "Huddersfield Giants": { base: 5_500, capacity: 24_000 },
  "Castleford Tigers": { base: 7_000, capacity: 10_000 },
  "Bradford Bulls": { base: 7_500, capacity: 25_000, min: 6_700 },
  "Toulouse Olympique": { base: 5_000, capacity: 19_000 },
  "York Knights": { base: 4_500, capacity: 8_500 },
};

export function getClubAttendanceProfile(club: string): {
  base: number;
  capacity: number;
  min?: number;
} {
  return (
    CLUB_ATTENDANCE_PROFILES[club] ?? { base: 6_000, capacity: 12_000 }
  );
}

export function getClubAttendanceFloor(
  club: string,
  baseAttendance: number,
  storedFloor?: number
): number {
  if (storedFloor != null) return storedFloor;
  const profile = getClubAttendanceProfile(club);
  return profile.min ?? Math.round(baseAttendance * 0.55);
}

function initialAttendanceFloor(club: string, baseAttendance: number): number {
  return getClubAttendanceFloor(club, baseAttendance);
}

function clampAttendance(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seasonPerformanceScore(summary: ManagerSeasonSummary): number {
  let score = 0;
  if (summary.position === 1) score += 0.9;
  else if (summary.position <= 3) score += 0.55;
  else if (summary.position <= 6) score += 0.25;
  else if (summary.position <= 9) score -= 0.05;
  else if (summary.position <= 11) score -= 0.25;
  else score -= 0.45;

  if (summary.playoffFinish === "Super League Champions") score += 0.4;
  if (summary.trophies.includes("League Leaders") || summary.position === 1) {
    score += 0.15;
  }
  if (summary.trophies.includes("Challenge Cup")) score += 0.2;

  const games = summary.wins + summary.losses;
  if (games > 0) {
    score += (summary.wins / games - 0.5) * 0.5;
  }

  return clampAttendance(score, -1, 1);
}

/** -1 (struggling) to 1 (historic success) from career results and fan mood. */
export function getHistoricalPerformanceSignal(career: ManagerCareer): number {
  let weighted = 0;
  let weight = 0;

  for (let i = 0; i < career.seasonHistory.length; i++) {
    const season = career.seasonHistory[i]!;
    const seasonWeight = 0.65 + i * 0.12;
    weighted += seasonPerformanceScore(season) * seasonWeight;
    weight += seasonWeight;
  }

  const games = career.wins + career.losses;
  if (games > 0) {
    const position = getUserLeagueTablePosition(career);
    const winRate = career.wins / games;
    let current = (winRate - 0.5) * 1.6;
    if (position <= 2) current += 0.35;
    else if (position <= 6) current += 0.15;
    else if (position >= 12) current -= 0.25;
    weighted += clampAttendance(current, -1, 1) * 1.1;
    weight += 1.1;
  }

  if (weight <= 0) return 0;
  return clampAttendance(weighted / weight, -1, 1);
}

export type AttendanceDriftIntensity = "home_match" | "season_end";

/** Slowly shift floor/base/average from long-term club performance. */
export function applyAttendancePerformanceDrift(
  career: ManagerCareer,
  intensity: AttendanceDriftIntensity
): ManagerCareer {
  const profile = getClubAttendanceProfile(career.club);
  const data = career.attendanceData;
  const signal = getHistoricalPerformanceSignal(career);

  const profileFloor =
    profile.min ?? Math.round(profile.base * 0.55);
  const profileBase = profile.base;
  const floor =
    data.attendanceFloor ?? initialAttendanceFloor(career.club, data.baseAttendance);

  const maxFloor = Math.round(
    Math.min(data.baseAttendance * 0.95, data.stadiumCapacity * 0.88)
  );
  const minBase = Math.round(profileBase * 0.72);
  // Sustained success can push home crowds toward sell-outs.
  const maxBase = Math.round(
    Math.min(profileBase * 1.45, data.stadiumCapacity * 0.96)
  );

  const floorStep = intensity === "season_end" ? 420 : 28;
  const baseStep = intensity === "season_end" ? 380 : 22;
  const avgStep = intensity === "season_end" ? 260 : 16;

  const floorDelta =
    signal >= 0
      ? Math.round(signal * floorStep)
      : Math.round(signal * floorStep * 0.3);
  const baseDelta = Math.round(signal * baseStep);
  const avgDelta =
    signal >= 0
      ? Math.round(signal * avgStep * 0.55)
      : Math.round(signal * avgStep);

  const newFloor = clampAttendance(
    floor + floorDelta,
    profileFloor,
    Math.max(profileFloor, maxFloor)
  );
  const newBase = clampAttendance(
    data.baseAttendance + baseDelta,
    minBase,
    maxBase
  );
  const newAverage = clampAttendance(
    data.currentAverageAttendance + avgDelta,
    Math.round(newBase * 0.82),
    data.stadiumCapacity
  );

  if (
    newFloor === floor &&
    newBase === data.baseAttendance &&
    newAverage === data.currentAverageAttendance
  ) {
    return career;
  }

  return {
    ...career,
    attendanceData: {
      ...data,
      attendanceFloor: newFloor,
      baseAttendance: newBase,
      currentAverageAttendance: newAverage,
    },
  };
}

export function createClubAttendanceData(club: string): ClubAttendanceData {
  const { base, capacity } = getClubAttendanceProfile(club);
  return {
    baseAttendance: base,
    currentAverageAttendance: base,
    stadiumCapacity: capacity,
    attendanceFloor: initialAttendanceFloor(club, base),
  };
}

/** Refresh floor defaults without wiping drifted attendance or stadium upgrades. */
export function syncClubAttendanceData(
  club: string,
  data: ClubAttendanceData,
  facilities?: import("./types").ClubFacilities
): ClubAttendanceData {
  const profileCapacity = getClubAttendanceProfile(club).capacity;
  const capacity = facilities
    ? getEffectiveStadiumCapacity(club, ensureClubFacilities(facilities))
    : data.stadiumCapacity > profileCapacity
      ? data.stadiumCapacity
      : profileCapacity;
  const profileFloor = getClubAttendanceFloor(club, data.baseAttendance);
  return {
    ...data,
    stadiumCapacity: capacity,
    attendanceFloor: data.attendanceFloor ?? profileFloor,
    // Fan Mood removed — drop legacy field on hydrate.
    fanMood: undefined,
  };
}

function formMultiplier(recentForm: string[]): number {
  const last5 = recentForm.slice(-5);
  if (last5.length === 0) return 1;
  const wins = last5.filter((r) => r === "W").length;
  return 0.85 + wins * 0.06;
}

function leaguePositionMultiplier(position: number): number {
  if (position <= 3) return 1.15;
  if (position <= 6) return 1.08;
  if (position <= 10) return 1;
  if (position <= 12) return 0.92;
  return 0.85;
}

function opponentMultiplier(opponent: string): number {
  // Poor away following is applied in awayTravelCrowdMultiplier only —
  // stacking both crushed Championship / York / Huddersfield gates.
  const strength = getClubBaseStrength(opponent);
  return 0.9 + (strength - 70) * 0.008;
}

function awayTravelCrowdMultiplier(
  homeClub: string,
  visitingClub: string,
  competition?: ManagerCompetition
): number {
  if (isCrossChannelFixture(homeClub, visitingClub)) {
    if (competition === "friendly") {
      if (isFrenchSuperLeagueClub(homeClub)) {
        const visitorStrength = getClubBaseStrength(visitingClub);
        if (visitorStrength >= 88) return 1.12;
        if (visitorStrength >= 84) return 1.06;
        return 1.02;
      }
      return 0.76;
    }
    if (isFrenchSuperLeagueClub(homeClub)) {
      const visitorStrength = getClubBaseStrength(visitingClub);
      if (visitorStrength >= 88) return 1.16;
      if (visitorStrength >= 84) return 1.1;
      return 1.06;
    }
    return 0.96;
  }
  if (hasPoorAwayFollowing(visitingClub)) return 0.72;
  return 1;
}

export type AttendanceOutlookLevel = "low" | "medium" | "high";

/** Huddersfield/York-tier travelling support — includes all Championship clubs. */
export function hasPoorAwayFollowing(club: string): boolean {
  return (
    POOR_AWAY_FOLLOWING_SL_CLUBS.has(club) || isChampionshipClubName(club)
  );
}

function attendanceOutlookFromPredicted(
  predicted: number,
  baseAttendance: number,
  visitingOpponent: string,
  homeClub: string,
  competition?: ManagerCompetition
): { level: AttendanceOutlookLevel; label: string } {
  if (competition === "playoffs") {
    if (areRivalClubs(homeClub, visitingOpponent)) {
      return { level: "high", label: "Play-off derby — sell-out expected" };
    }
    const fill = predicted / Math.max(1, getClubAttendanceProfile(homeClub).capacity);
    if (fill >= 0.92) {
      return { level: "high", label: "Play-offs — near sell-out expected" };
    }
    return { level: "high", label: "Play-offs — bumper crowd expected" };
  }

  if (areRivalClubs(homeClub, visitingOpponent)) {
    return { level: "high", label: "Rivalry fixture — near sell-out expected" };
  }

  if (isCrossChannelFixture(homeClub, visitingOpponent)) {
    if (competition === "friendly") {
      if (isFrenchSuperLeagueClub(homeClub)) {
        return { level: "high", label: "Strong away support" };
      }
      return {
        level: "low",
        label: "Cross-channel friendly — low away turnout expected",
      };
    }
    if (isFrenchSuperLeagueClub(homeClub)) {
      return {
        level: "high",
        label: "Strong English away support",
      };
    }
    return {
      level: "medium",
      label: "Steady gate — cross-channel trip",
    };
  }

  const ratio = predicted / Math.max(1, baseAttendance);
  const poorAway = hasPoorAwayFollowing(visitingOpponent);

  if (poorAway) {
    if (ratio < 0.78) {
      return {
        level: "low",
        label: "Modest crowd — limited away support",
      };
    }
    if (ratio < 0.95) {
      return {
        level: "medium",
        label: "Average gate — few travelling fans",
      };
    }
    return {
      level: "medium",
      label: "Steady gate — weak away following",
    };
  }

  if (ratio >= 1.08) {
    return { level: "high", label: "Strong turnout expected" };
  }
  if (ratio >= 0.88) {
    return { level: "medium", label: "Good gate expected" };
  }
  return { level: "low", label: "Modest crowd expected" };
}

/** Predicted home gate + fan-facing label for an upcoming fixture. */
export function getHomeFixtureAttendanceOutlook(
  career: ManagerCareer,
  fixture: Pick<
    ManagerScheduledFixture,
    "opponent" | "isHome" | "competition" | "round" | "id" | "isNeutral" | "playoffRound" | "cupRound"
  >
): { label: string; predictedAttendance: number; level: AttendanceOutlookLevel } | null {
  if (isGrandFinalFixture(fixture)) {
    const predictedAttendance = calculateGrandFinalAttendance(career, fixture as ManagerScheduledFixture);
    return {
      label: `Grand Final at ${GRAND_FINAL_VENUE} — bumper crowd expected`,
      predictedAttendance,
      level: "high",
    };
  }

  if (isChallengeCupFinalFixture(fixture)) {
    const predictedAttendance = calculateChallengeCupFinalAttendance(
      career,
      fixture as ManagerScheduledFixture
    );
    return {
      label: `Challenge Cup Final at ${CHALLENGE_CUP_FINAL_VENUE} — bumper crowd expected`,
      predictedAttendance,
      level: "high",
    };
  }

  if (isMagicWeekendFixture(fixture)) {
    const predictedAttendance = calculateMagicWeekendAttendance(
      career.seed,
      fixture.id ?? `magic-${fixture.round}`
    );
    return {
      label: `Magic Weekend at ${MAGIC_WEEKEND_VENUE} — bumper crowd expected`,
      predictedAttendance,
      level: "high",
    };
  }

  if (!fixture.isHome) return null;

  const scheduled = fixture as ManagerScheduledFixture;
  const predictedAttendance = calculateMatchAttendance(career, scheduled);
  const { label, level } = attendanceOutlookFromPredicted(
    predictedAttendance,
    career.attendanceData.baseAttendance,
    fixture.opponent,
    career.club,
    fixture.competition
  );

  return { label, predictedAttendance, level };
}

export function calculateGrandFinalAttendance(
  career: ManagerCareer,
  fixture: Pick<ManagerScheduledFixture, "id">
): number {
  const rng = seedrandom(`${career.seed}-gf-att-${fixture.id}`);
  const span = GRAND_FINAL_ATTENDANCE_MAX - GRAND_FINAL_ATTENDANCE_MIN + 1;
  return GRAND_FINAL_ATTENDANCE_MIN + Math.floor(rng() * span);
}

export function calculateChallengeCupFinalAttendance(
  career: ManagerCareer,
  fixture: Pick<ManagerScheduledFixture, "id">
): number {
  const rng = seedrandom(`${career.seed}-ccf-att-${fixture.id}`);
  const span =
    CHALLENGE_CUP_FINAL_ATTENDANCE_MAX - CHALLENGE_CUP_FINAL_ATTENDANCE_MIN + 1;
  return CHALLENGE_CUP_FINAL_ATTENDANCE_MIN + Math.floor(rng() * span);
}

function processMagicWeekendAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  _match: MatchFixture
): {
  career: ManagerCareer;
  meta: MatchAttendanceMeta;
} {
  const attendance = calculateMagicWeekendAttendance(
    career.seed,
    fixture.id ?? `magic-${fixture.round}`
  );

  return {
    career,
    meta: {
      attendance,
      gateIncome: 0,
      transferAllocation: 0,
      operatingAllocation: 0,
      ticketPrice: 0,
      venue: MAGIC_WEEKEND_VENUE,
      excludedFromClubFunds: true,
    },
  };
}

function processChallengeCupFinalAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  _match: MatchFixture
): {
  career: ManagerCareer;
  meta: MatchAttendanceMeta;
} {
  const attendance = calculateChallengeCupFinalAttendance(career, fixture);

  return {
    career,
    meta: {
      attendance,
      gateIncome: 0,
      transferAllocation: 0,
      operatingAllocation: 0,
      ticketPrice: 0,
      venue: CHALLENGE_CUP_FINAL_VENUE,
      excludedFromClubFunds: true,
    },
  };
}

function processGrandFinalAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  _match: MatchFixture
): {
  career: ManagerCareer;
  meta: MatchAttendanceMeta;
} {
  const attendance = calculateGrandFinalAttendance(career, fixture);

  return {
    career,
    meta: {
      attendance,
      gateIncome: 0,
      transferAllocation: 0,
      operatingAllocation: 0,
      ticketPrice: 0,
      venue: GRAND_FINAL_VENUE,
      excludedFromClubFunds: true,
    },
  };
}

export function processMatchAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  match: MatchFixture
): {
  career: ManagerCareer;
  meta: MatchAttendanceMeta | null;
} {
  if (isGrandFinalFixture(fixture)) {
    return processGrandFinalAttendance(career, fixture, match);
  }
  if (isChallengeCupFinalFixture(fixture)) {
    return processChallengeCupFinalAttendance(career, fixture, match);
  }
  if (isMagicWeekendFixture(fixture)) {
    return processMagicWeekendAttendance(career, fixture, match);
  }
  return processHomeMatchAttendance(career, fixture, match);
}

function competitionMultiplier(competition: ManagerCompetition): number {
  if (competition === "challenge_cup") return 1.12;
  if (competition === "playoffs") return 1;
  return 1;
}

function sellOutAttendance(stadiumCapacity: number): number {
  return stadiumCapacity;
}

function playoffFixtureAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  stadiumCapacity: number,
  baseAttendance: number
): number {
  const rng = seedrandom(
    `${career.seed}-playoff-att-${fixture.id ?? `${career.club}-${fixture.opponent}-r${fixture.round}`}`
  );
  const fillRatio = 0.84 + rng() * 0.12;
  const fromCapacity = Math.round(stadiumCapacity * fillRatio);
  const floor = Math.round(
    Math.max(baseAttendance * 1.45, stadiumCapacity * 0.8)
  );
  return Math.max(floor, Math.min(stadiumCapacity, fromCapacity));
}

function ticketPrice(competition: ManagerCompetition, isBigGame: boolean): number {
  if (competition === "playoffs") return 28;
  if (competition === "challenge_cup") return 22;
  if (isBigGame) return 24;
  return 20;
}

function rivalFixtureAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  stadiumCapacity: number
): number {
  const rng = seedrandom(
    `${career.seed}-rival-att-${fixture.id ?? `${career.club}-${fixture.opponent}`}`
  );
  const fillRatio = 0.92 + rng() * 0.08;
  return Math.round(stadiumCapacity * fillRatio);
}

export function calculateMatchAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture
): number {
  if (!fixture.isHome) return 0;

  const { baseAttendance, stadiumCapacity } = career.attendanceData;
  const isPlayoff = fixture.competition === "playoffs";
  const isRival = areRivalClubs(career.club, fixture.opponent);

  if (isPlayoff && isRival) {
    return sellOutAttendance(stadiumCapacity);
  }

  if (isPlayoff) {
    return playoffFixtureAttendance(
      career,
      fixture,
      stadiumCapacity,
      baseAttendance
    );
  }

  if (isRival) {
    return rivalFixtureAttendance(career, fixture, stadiumCapacity);
  }

  const position =
    career.leagueTable.find((r) => r.isUserTeam)?.position ?? 10;

  const mult =
    formMultiplier(career.recentForm) *
    leaguePositionMultiplier(position) *
    opponentMultiplier(fixture.opponent) *
    awayTravelCrowdMultiplier(
      career.club,
      fixture.opponent,
      fixture.competition
    ) *
    competitionMultiplier(fixture.competition);

  const floor = getClubAttendanceFloor(
    career.club,
    baseAttendance,
    career.attendanceData.attendanceFloor
  );
  const raw = Math.round(baseAttendance * mult);
  return Math.max(floor, Math.min(stadiumCapacity, raw));
}

export function processHomeMatchAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  match: MatchFixture
): {
  career: ManagerCareer;
  meta: MatchAttendanceMeta | null;
} {
  if (!fixture.isHome) {
    return { career, meta: null };
  }

  const attendance = calculateMatchAttendance(career, fixture);
  const limitedCrossChannelFriendly =
    expectsLimitedCrossChannelFriendlyAwaySupport(
      career.club,
      fixture.opponent,
      fixture.competition
    );
  const isBigGame =
    fixture.competition === "playoffs" ||
    fixture.competition === "challenge_cup" ||
    areRivalClubs(career.club, fixture.opponent) ||
    (isCrossChannelFixture(career.club, fixture.opponent) &&
      !limitedCrossChannelFriendly) ||
    (!hasPoorAwayFollowing(fixture.opponent) &&
      getClubBaseStrength(fixture.opponent) >= 80);
  const price = ticketPrice(fixture.competition, isBigGame);
  const commercialMult = getCommercialGateMultiplier(
    ensureClubFacilities(career.clubFacilities).commercial
  );
  const gateIncome = Math.round(attendance * price * commercialMult);
  const { transfer: transferAllocation, operating: operatingAllocation } =
    splitRevenue(gateIncome, "gate");

  const prevAvg = career.attendanceData.currentAverageAttendance;
  const homeGames = career.gateIncomeHistory.length + 1;
  const newAvg = Math.round(
    (prevAvg * (homeGames - 1) + attendance) / homeGames
  );

  const record: GateIncomeRecord = {
    fixtureId: fixture.id,
    round: fixture.round,
    attendance,
    income: gateIncome,
    transferAllocation,
    operatingAllocation,
    competition: fixture.competition,
  };

  const seasonAttendance = {
    total: career.seasonAttendance.total + attendance,
    count: career.seasonAttendance.count + 1,
    high: Math.max(career.seasonAttendance.high, attendance),
    low:
      career.seasonAttendance.count === 0
        ? attendance
        : Math.min(career.seasonAttendance.low, attendance),
  };

  const withRevenue = applyClubRevenue(
    applyAttendancePerformanceDrift(
      {
        ...career,
        attendanceData: {
          ...career.attendanceData,
          currentAverageAttendance: newAvg,
        },
        gateIncomeHistory: [...career.gateIncomeHistory, record],
        seasonAttendance,
      },
      "home_match"
    ),
    gateIncome,
    "gate"
  );

  return {
    career: withRevenue,
    meta: {
      attendance,
      gateIncome,
      transferAllocation,
      operatingAllocation,
      ticketPrice: price,
    },
  };
}

export function getLastHomeGate(
  history: GateIncomeRecord[]
): GateIncomeRecord | null {
  return history.length ? history[history.length - 1]! : null;
}

export function initAllClubAttendance(): Record<string, ClubAttendanceData> {
  const out: Record<string, ClubAttendanceData> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    out[club] = createClubAttendanceData(club);
  }
  return out;
}

export function derbyMultiplier(home: string, away: string): number {
  return areRivalClubs(home, away) ? 1.2 : 1;
}
