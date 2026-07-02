import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getClubBaseStrength } from "../game/club-strength";
import type {
  ClubAttendanceData,
  GateIncomeRecord,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  MatchAttendanceMeta,
} from "./types";
import type { MatchFixture } from "../game/season-simulation";
import { applyClubRevenue, splitRevenue } from "./managerFinance";

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
  baseAttendance: number
): number {
  const profile = getClubAttendanceProfile(club);
  return profile.min ?? Math.round(baseAttendance * 0.55);
}

export function createClubAttendanceData(club: string): ClubAttendanceData {
  const { base, capacity } = getClubAttendanceProfile(club);
  return {
    baseAttendance: base,
    currentAverageAttendance: base,
    stadiumCapacity: capacity,
    fanMood: 50,
  };
}

/** Refresh stored attendance from club profile (e.g. after profile tuning). */
export function syncClubAttendanceData(
  club: string,
  data: ClubAttendanceData
): ClubAttendanceData {
  const { base, capacity } = getClubAttendanceProfile(club);
  const prevBase = data.baseAttendance;
  return {
    ...data,
    baseAttendance: base,
    stadiumCapacity: capacity,
    currentAverageAttendance:
      data.currentAverageAttendance === prevBase ? base : data.currentAverageAttendance,
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
  if (POOR_AWAY_FOLLOWING_CLUBS.has(opponent)) {
    return 0.86;
  }
  const strength = getClubBaseStrength(opponent);
  return 0.9 + (strength - 70) * 0.008;
}

/** Clubs with limited travelling support — smaller crowds when they visit. */
const POOR_AWAY_FOLLOWING_CLUBS = new Set([
  "Toulouse Olympique",
  "Catalans Dragons",
  "York Knights",
  "Huddersfield Giants",
]);

export function hasPoorAwayFollowing(club: string): boolean {
  return POOR_AWAY_FOLLOWING_CLUBS.has(club);
}

function awayTravelCrowdMultiplier(visitingClub: string): number {
  if (POOR_AWAY_FOLLOWING_CLUBS.has(visitingClub)) return 0.72;
  return 1;
}

export type AttendanceOutlookLevel = "low" | "medium" | "high";

function attendanceOutlookFromPredicted(
  predicted: number,
  baseAttendance: number,
  visitingOpponent: string
): { level: AttendanceOutlookLevel; label: string } {
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
    "opponent" | "isHome" | "competition" | "round" | "id"
  >
): { label: string; predictedAttendance: number; level: AttendanceOutlookLevel } | null {
  if (!fixture.isHome) return null;

  const scheduled = fixture as ManagerScheduledFixture;
  const predictedAttendance = calculateMatchAttendance(career, scheduled);
  const { label, level } = attendanceOutlookFromPredicted(
    predictedAttendance,
    career.attendanceData.baseAttendance,
    fixture.opponent
  );

  return { label, predictedAttendance, level };
}

function competitionMultiplier(competition: ManagerCompetition): number {
  return competition === "challenge_cup" ? 1.12 : 1;
}

function ticketPrice(competition: ManagerCompetition, isBigGame: boolean): number {
  if (competition === "challenge_cup") return 22;
  if (isBigGame) return 24;
  return 20;
}

export function calculateMatchAttendance(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture
): number {
  if (!fixture.isHome) return 0;

  const { baseAttendance, stadiumCapacity, fanMood } = career.attendanceData;
  const position =
    career.leagueTable.find((r) => r.isUserTeam)?.position ?? 10;

  const mult =
    formMultiplier(career.recentForm) *
    leaguePositionMultiplier(position) *
    opponentMultiplier(fixture.opponent) *
    awayTravelCrowdMultiplier(fixture.opponent) *
    competitionMultiplier(fixture.competition) *
    (0.85 + fanMood / 200);

  const floor = getClubAttendanceFloor(career.club, baseAttendance);
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
  const isBigGame =
    fixture.competition === "challenge_cup" ||
    (!hasPoorAwayFollowing(fixture.opponent) &&
      getClubBaseStrength(fixture.opponent) >= 80);
  const price = ticketPrice(fixture.competition, isBigGame);
  const gateIncome = attendance * price;
  const { transfer: transferAllocation, operating: operatingAllocation } =
    splitRevenue(gateIncome, "gate");

  let fanMoodChange = 0;
  if (match.result === "W") fanMoodChange += 3;
  else fanMoodChange -= 2;
  if (match.isUpset) fanMoodChange += 2;
  const margin = match.pointsFor - match.pointsAgainst;
  if (margin >= 20) fanMoodChange += 2;
  if (margin <= -15) fanMoodChange -= 2;
  if (fixture.competition === "challenge_cup" && match.result === "W") {
    fanMoodChange += 2;
  }

  const newFanMood = Math.max(
    10,
    Math.min(99, career.attendanceData.fanMood + fanMoodChange)
  );
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
    {
      ...career,
      attendanceData: {
        ...career.attendanceData,
        fanMood: newFanMood,
        currentAverageAttendance: newAvg,
      },
      gateIncomeHistory: [...career.gateIncomeHistory, record],
      seasonAttendance,
    },
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
      fanMoodChange,
      ticketPrice: price,
    },
  };
}

export function fanMoodTrend(fanMood: number): string {
  if (fanMood >= 70) return "Rising";
  if (fanMood >= 45) return "Steady";
  return "Falling";
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
  const rng = seedrandom(`${home}-${away}`);
  if (home.includes("Hull") && away.includes("Hull")) return 1.2;
  if (home.includes("Bradford") && away.includes("Leeds")) return 1.15;
  return 1 + (rng() < 0.1 ? 0.1 : 0);
}
