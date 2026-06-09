import type { SquadSlot } from "./types";
import { getAverageSquadRating } from "./squad-analysis";

export type SquadGrade = "S+" | "S" | "A" | "B" | "C" | "D" | "E" | "F";

export interface GradeInfo {
  grade: SquadGrade;
  label: string;
  subtitle: string;
  explanation: string;
  color: string;
  glow: string;
}

export interface SeasonGradeInput {
  wins: number;
  losses: number;
  leaguePosition: number;
  pointsDifference: number;
  totalValue: number;
  avgRating: number;
  isPerfect: boolean;
}

const GRADE_ORDER: SquadGrade[] = [
  "F",
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
  "S+",
];

const GRADE_META: Record<
  SquadGrade,
  Omit<GradeInfo, "grade">
> = {
  "S+": {
    label: "Rugby League Dynasty",
    subtitle: "Dynasty",
    explanation: "One of the greatest squads ever assembled.",
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.55)",
  },
  S: {
    label: "Super Squad",
    subtitle: "Super Squad",
    explanation: "An elite side that dominated the competition.",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.5)",
  },
  A: {
    label: "Grand Final Winner",
    subtitle: "Grand Final Winner",
    explanation: "A championship-calibre squad.",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.45)",
  },
  B: {
    label: "Playoff Team",
    subtitle: "Playoff Team",
    explanation: "A strong playoff-level team.",
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.4)",
  },
  C: {
    label: "Mid Table",
    subtitle: "Mid Table",
    explanation: "Competitive but inconsistent.",
    color: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.4)",
  },
  D: {
    label: "Struggling",
    subtitle: "Struggling",
    explanation: "A difficult season with limited success.",
    color: "#94a3b8",
    glow: "rgba(148, 163, 184, 0.35)",
  },
  E: {
    label: "Relegation Form",
    subtitle: "Relegation Form",
    explanation: "Serious rebuilding required.",
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.35)",
  },
  F: {
    label: "Wooden Spoon",
    subtitle: "Wooden Spoon",
    explanation: "Wooden spoon form. Back to training.",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.35)",
  },
};

/** Primary grade from win total — results drive the band. */
function getRecordGrade(wins: number, isPerfect: boolean): SquadGrade {
  if (isPerfect || wins === 27) return "S+";
  if (wins >= 24) return "S";
  if (wins >= 20) return "A";
  if (wins >= 15) return "B";
  if (wins >= 11) return "C";
  if (wins >= 7) return "D";
  if (wins >= 4) return "E";
  return "F";
}

/** Hard ceiling so poor records never receive a respectable grade. */
function capGradeByWins(grade: SquadGrade, wins: number): SquadGrade {
  let maxGrade: SquadGrade;
  if (wins <= 3) maxGrade = "F";
  else if (wins <= 6) maxGrade = "E";
  else if (wins <= 10) maxGrade = "D";
  else if (wins <= 14) maxGrade = "C";
  else if (wins <= 19) maxGrade = "B";
  else if (wins <= 23) maxGrade = "A";
  else if (wins <= 26) maxGrade = "S";
  else maxGrade = "S+";

  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const maxIdx = GRADE_ORDER.indexOf(maxGrade);
  return GRADE_ORDER[Math.min(gradeIdx, maxIdx)];
}

function gradeFromIndex(index: number): SquadGrade {
  return GRADE_ORDER[Math.max(0, Math.min(GRADE_ORDER.length - 1, index))];
}

/**
 * Secondary adjustment using performance metrics.
 * Can shift grade by at most one step, and never above the record cap.
 */
function adjustGradeByPerformance(
  grade: SquadGrade,
  input: SeasonGradeInput
): SquadGrade {
  const { wins, leaguePosition, pointsDifference, avgRating, totalValue } =
    input;
  let idx = GRADE_ORDER.indexOf(grade);

  const winPct = wins / 27;
  const eliteSquad =
    avgRating >= 86 && totalValue >= 3_500_000 && pointsDifference > 120;
  const strongSquad =
    avgRating >= 82 && totalValue >= 2_200_000 && pointsDifference > 40;
  const weakSquad =
    avgRating < 74 || totalValue < 1_000_000 || pointsDifference < -80;

  if (wins >= 20 && eliteSquad && leaguePosition <= 2 && idx < GRADE_ORDER.length - 1) {
    idx += 1;
  } else if (wins >= 15 && strongSquad && leaguePosition <= 4 && idx < GRADE_ORDER.length - 1) {
    idx += 1;
  } else if (wins <= 14 && weakSquad && leaguePosition >= 10 && idx > 0) {
    idx -= 1;
  } else if (winPct < 0.3 && pointsDifference < -150 && idx > 0) {
    idx -= 1;
  }

  const adjusted = gradeFromIndex(idx);
  return capGradeByWins(adjusted, wins);
}

function buildGradeInfo(grade: SquadGrade): GradeInfo {
  return { grade, ...GRADE_META[grade] };
}

export function getSeasonGrade(input: SeasonGradeInput): GradeInfo {
  const recordGrade = getRecordGrade(input.wins, input.isPerfect);
  const capped = capGradeByWins(recordGrade, input.wins);
  const finalGrade = adjustGradeByPerformance(capped, input);
  return buildGradeInfo(finalGrade);
}

export function getSeasonGradeFromSquad(
  squad: SquadSlot[],
  season: {
    wins: number;
    losses: number;
    leaguePosition: number;
    pointsDifference: number;
    isPerfect: boolean;
  },
  totalValue: number
): GradeInfo {
  return getSeasonGrade({
    wins: season.wins,
    losses: season.losses,
    leaguePosition: season.leaguePosition,
    pointsDifference: season.pointsDifference,
    totalValue,
    avgRating: getAverageSquadRating(squad),
    isPerfect: season.isPerfect,
  });
}

/** @deprecated Use getSeasonGrade — value-only grading removed. */
export function getSquadGrade(totalValue: number): GradeInfo {
  void totalValue;
  return buildGradeInfo("C");
}

export function formatGradeDisplay(info: GradeInfo): string {
  return `${info.grade} Grade (${info.label})`;
}
