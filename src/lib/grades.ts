import type { GameMode, SquadSlot } from "./types";
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
    explanation: "All-time great.",
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.55)",
  },
  S: {
    label: "Super Squad",
    subtitle: "Super Squad",
    explanation: "Elite side.",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.5)",
  },
  A: {
    label: "Title Contender",
    subtitle: "Title Contender",
    explanation: "Title level.",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.45)",
  },
  B: {
    label: "Top Six Contender",
    subtitle: "Top Six Contender",
    explanation: "Top-six side.",
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.4)",
  },
  C: {
    label: "Mid Table",
    subtitle: "Mid Table",
    explanation: "Mid-table.",
    color: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.4)",
  },
  D: {
    label: "Struggling",
    subtitle: "Struggling",
    explanation: "Tough year.",
    color: "#94a3b8",
    glow: "rgba(148, 163, 184, 0.35)",
  },
  E: {
    label: "Relegation Form",
    subtitle: "Relegation Form",
    explanation: "Rebuild needed.",
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.35)",
  },
  F: {
    label: "Wooden Spoon",
    subtitle: "Wooden Spoon",
    explanation: "Wooden spoon.",
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

/** Soft ceiling from wins — still allow league finish to lift the floor. */
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

/**
 * League finish must match the grade story.
 * Current Mode can crown League Leaders with fewer wins than the old
 * win-only bands assumed — never call 1st place "Mid Table".
 */
function floorGradeByPosition(
  grade: SquadGrade,
  leaguePosition: number,
  wins: number
): SquadGrade {
  let minGrade: SquadGrade = "F";
  if (leaguePosition === 1) {
    minGrade = wins >= 22 ? "S" : "A";
  } else if (leaguePosition === 2) {
    minGrade = wins >= 18 ? "A" : "B";
  } else if (leaguePosition <= 6) {
    minGrade = wins >= 14 ? "B" : "C";
  } else if (leaguePosition <= 10) {
    minGrade = "C";
  }

  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const minIdx = GRADE_ORDER.indexOf(minGrade);
  return GRADE_ORDER[Math.max(gradeIdx, minIdx)];
}

function gradeFromIndex(index: number): SquadGrade {
  return GRADE_ORDER[Math.max(0, Math.min(GRADE_ORDER.length - 1, index))];
}

/**
 * Secondary adjustment using performance metrics.
 * Can shift grade by at most one step, then position floor is applied.
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
  } else if (
    wins <= 14 &&
    weakSquad &&
    leaguePosition >= 10 &&
    leaguePosition > 6 &&
    idx > 0
  ) {
    idx -= 1;
  } else if (winPct < 0.3 && pointsDifference < -150 && leaguePosition > 6 && idx > 0) {
    idx -= 1;
  }

  const adjusted = gradeFromIndex(idx);
  const capped = capGradeByWins(adjusted, wins);
  return floorGradeByPosition(capped, leaguePosition, wins);
}

function buildGradeInfo(
  grade: SquadGrade,
  leaguePosition?: number
): GradeInfo {
  const meta = GRADE_META[grade];
  if (leaguePosition === 1 && (grade === "A" || grade === "S" || grade === "S+")) {
    return {
      grade,
      label: grade === "A" ? "League Leaders" : meta.label,
      subtitle: grade === "A" ? "League Leaders" : meta.subtitle,
      explanation:
        grade === "A" ? "League winners." : meta.explanation,
      color: meta.color,
      glow: meta.glow,
    };
  }
  return { grade, ...meta };
}

export function getSeasonGrade(input: SeasonGradeInput): GradeInfo {
  const recordGrade = getRecordGrade(input.wins, input.isPerfect);
  const capped = capGradeByWins(recordGrade, input.wins);
  const finalGrade = adjustGradeByPerformance(capped, input);
  return buildGradeInfo(finalGrade, input.leaguePosition);
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

export interface GradeReviewContext {
  wins: number;
  losses: number;
  leaguePosition: number;
  pointsDifference: number;
  isPerfect: boolean;
}

function pickGradeBio(pool: string[], seed: number): string {
  if (pool.length === 0) return "";
  return pool[Math.abs(seed) % pool.length]!;
}

/** Short review-page bio shown under the grade heading. */
export function getGradeReviewBio(
  grade: SquadGrade,
  ctx: GradeReviewContext
): string {
  const { wins, losses, leaguePosition, pointsDifference, isPerfect } = ctx;
  const seed =
    wins * 31 +
    losses * 17 +
    leaguePosition * 13 +
    Math.round(pointsDifference);

  if (isPerfect || wins === 27) {
    return pickGradeBio(
      [
        "Untouchable all season.",
        "27-0. Folklore.",
        "Immaculate. Inevitable.",
      ],
      seed
    );
  }

  const pools: Record<SquadGrade, string[]> = {
    "S+": [
      "Built for history.",
      "Set the standard all year.",
      "Championship calibre throughout.",
    ],
    S: [
      "Built for history.",
      "Title-chasing form.",
      "Elite — just short of perfect.",
    ],
    A: [
      "Genuine contender.",
      "Title-chasing form.",
      "Pressure on at the top.",
    ],
    B: [
      "Solid year. No silverware.",
      "Top-six form.",
      "Competitive. Build on it.",
    ],
    C: [
      "Mid-table. No killer edge.",
      "Mixed results. No identity.",
      "Flashes of quality. Inconsistent.",
    ],
    D: [
      "Too many misses. No climb.",
      "Promised more than it delivered.",
      "Fell short. No momentum.",
    ],
    E: [
      "Searching for answers.",
      "Relegation form. Improve.",
      "Too many weaknesses.",
    ],
    F: [
      "Season to forget. Rebuild.",
      "Wooden spoon. Start again.",
      "Struggled. Rebuild needed.",
    ],
  };

  let bio = pickGradeBio(pools[grade], seed);

  if (wins === 0) {
    bio = pickGradeBio(
      ["Winless. No rhythm.", "Zero wins. Brutal year."],
      seed + 1
    );
  } else if (losses === 27) {
    bio = pickGradeBio(
      ["0-27. No answers.", "No respite all year."],
      seed + 2
    );
  } else if (leaguePosition <= 2 && wins >= 20) {
    bio = pickGradeBio(
      ["Among the elite.", "Near the summit all year."],
      seed + 3
    );
  } else if (pointsDifference < -120) {
    bio = pickGradeBio(
      ["Outscored heavily.", "Points difference told the story."],
      seed + 4
    );
  }

  return bio;
}

/** Section heading above the season narrative on the review screen. */
export function getSeasonStoryHeading(mode: GameMode): string {
  return "Season Story";
}

function modeStoryBioPool(
  mode: GameMode,
  grade: SquadGrade,
  ctx: GradeReviewContext
): string[] | null {
  const { wins, losses, isPerfect, leaguePosition } = ctx;

  if (mode === "CLASSIC" && leaguePosition === 1 && !isPerfect && wins < 27) {
    return [
      "League winners.",
      "Top of the table. Deserved.",
      "Set the regular-season standard.",
      "League title. Built on consistency.",
    ];
  }

  if (isPerfect || wins === 27) {
    return [
      "27-0. Perfect.",
      "Immaculate. Inevitable.",
      "Unbeaten. Folklore.",
    ];
  }

  if (wins >= 20 && losses <= 4) {
    return [
      "Title chase. Statement wins.",
      "Top-table pressure all year.",
      "Defining run — just short.",
    ];
  }

  if (losses >= 15) {
    return [
      "Too many setbacks.",
      "Unbeaten dream faded early.",
      "Inconsistent. Lessons for next run.",
    ];
  }

  return null;
}

/** Mode-aware season narrative — never references grand finals. */
export function getSeasonReviewStoryBio(
  mode: GameMode,
  grade: SquadGrade,
  ctx: GradeReviewContext,
  tablePosition: number
): string {
  const modePool = modeStoryBioPool(mode, grade, ctx);
  if (modePool) {
    const seed =
      ctx.wins * 31 +
      ctx.losses * 17 +
      tablePosition * 13 +
      Math.round(ctx.pointsDifference);
    return pickGradeBio(modePool, seed);
  }
  return getValidatedGradeReviewBio(grade, ctx, tablePosition);
}

const SAFE_POSITION_FALLBACK_BIO = "Competitive. Plenty to build on.";

const POSITION_MENTION_PATTERNS = [
  /\bfinished\s+(?:1st|2nd|3rd|\d+th)\b/i,
  /\b(?:1st|2nd|3rd)\s+place\b/i,
  /\b(?:top|bottom)\s+of\s+the\s+(?:table|pile)\b/i,
  /\bmid-?table\b/i,
  /\bwooden\s+spoon\b/i,
  /\blast\s+place\b/i,
  /\bleague\s+champions?\b/i,
  /\brunner[- ]?up\b/i,
  /\bplayoff\b/i,
];

function bioMentionsFinishingPosition(bio: string): boolean {
  return POSITION_MENTION_PATTERNS.some((pattern) => pattern.test(bio));
}

function positionBucket(position: number): string {
  if (position === 1) return "champion";
  if (position === 2) return "runner-up";
  if (position <= 6) return "playoff";
  if (position <= 8) return "upper-mid";
  if (position <= 11) return "mid";
  if (position <= 13) return "lower";
  return "bottom";
}

function bioMatchesTablePosition(bio: string, tablePosition: number): boolean {
  const bucket = positionBucket(tablePosition);
  const lower = bio.toLowerCase();

  if (bucket === "champion") {
    return (
      lower.includes("champion") ||
      lower.includes("trophy") ||
      lower.includes("crowned") ||
      lower.includes("top of the pile")
    );
  }
  if (bucket === "runner-up") {
    return lower.includes("runner") || lower.includes("second");
  }
  if (bucket === "playoff") {
    return (
      lower.includes("playoff") ||
      lower.includes("finals") ||
      lower.includes("top-six") ||
      lower.includes("top six")
    );
  }
  if (bucket === "bottom") {
    return (
      lower.includes("bottom") ||
      lower.includes("last place") ||
      lower.includes("wooden spoon") ||
      lower.includes("rock bottom")
    );
  }
  if (bucket === "mid" || bucket === "upper-mid" || bucket === "lower") {
    return (
      lower.includes("mid-table") ||
      lower.includes("middle") ||
      lower.includes("respectability") ||
      lower.includes("mixed") ||
      lower.includes("inconsistent") ||
      lower.includes("platform") ||
      lower.includes("competitive")
    );
  }
  return true;
}

/** Grade bio with dev-time position consistency guard. */
export function getValidatedGradeReviewBio(
  grade: SquadGrade,
  ctx: GradeReviewContext,
  tablePosition: number
): string {
  const bio = getGradeReviewBio(grade, {
    ...ctx,
    leaguePosition: tablePosition,
  });

  if (
    process.env.NODE_ENV === "development" &&
    bioMentionsFinishingPosition(bio) &&
    !bioMatchesTablePosition(bio, tablePosition)
  ) {
    console.warn(
      `[season-review] Grade bio position mismatch (table ${tablePosition}): "${bio}"`
    );
    return SAFE_POSITION_FALLBACK_BIO;
  }

  return bio;
}
