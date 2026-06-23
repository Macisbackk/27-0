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
    label: "Title Contender",
    subtitle: "Title Contender",
    explanation: "A championship-calibre squad.",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.45)",
  },
  B: {
    label: "Top Six Contender",
    subtitle: "Top Six Contender",
    explanation: "A strong top-six level team.",
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
        "A once-in-a-generation squad that looked untouchable all season.",
        "27-0 perfection — this campaign belongs in rugby league folklore.",
        "An immaculate season where every week felt inevitable.",
      ],
      seed
    );
  }

  const pools: Record<SquadGrade, string[]> = {
    "S+": [
      "A dominant campaign where the squad looked built for history.",
      "Barely put a foot wrong — this side set the standard all year.",
      "Championship-calibre rugby league from first whistle to last.",
    ],
    S: [
      "A dominant campaign where the squad looked built for history.",
      "Title-chasing form all season — this team meant business.",
      "An elite run that only narrowly missed immortality.",
    ],
    A: [
      "A genuine contender's season — strong, consistent and dangerous.",
      "Title-chasing form all season — this team meant business.",
      "A polished campaign that kept the pressure on at the top.",
    ],
    B: [
      "A solid year with plenty to like, even if silverware stayed just out of reach.",
      "Top-six form without quite breaking into the elite bracket.",
      "Competitive throughout — a platform worth building on.",
    ],
    C: [
      "Middle-of-the-pack rugby league: competitive enough, but lacking a killer edge.",
      "A mixed bag of results that never quite found a defining identity.",
      "Capable in flashes, inconsistent when it mattered most.",
    ],
    D: [
      "Too many missed chances and not enough consistency to climb the table.",
      "A frustrating season that promised more than it delivered.",
      "Fell short of expectations and struggled to build momentum.",
    ],
    E: [
      "A disappointing run that left the squad searching for answers.",
      "Relegation form at times — serious improvement needed next year.",
      "A tough campaign that exposed too many weaknesses.",
    ],
    F: [
      "A season to forget. The rebuild starts now.",
      "Wooden spoon territory — back to the drawing board.",
      "A rebuild is needed. This squad struggled badly.",
    ],
  };

  let bio = pickGradeBio(pools[grade], seed);

  if (wins === 0) {
    bio = pickGradeBio(
      [
        "A winless campaign that never found its rhythm.",
        "Not a single victory all season — a brutal year to endure.",
      ],
      seed + 1
    );
  } else if (losses === 27) {
    bio = pickGradeBio(
      [
        "0-27 misery — one of the toughest seasons imaginable.",
        "A campaign with no respite and no answers.",
      ],
      seed + 2
    );
  } else if (leaguePosition <= 2 && wins >= 20) {
    bio = pickGradeBio(
      [
        "Finished among the elite and looked every bit a title threat.",
        "Near the summit all year — just missing the final step.",
      ],
      seed + 3
    );
  } else if (pointsDifference < -120) {
    bio = pickGradeBio(
      [
        "Outscored heavily — defensive frailties cost this squad dearly.",
        "A negative points difference that told the story of the season.",
      ],
      seed + 4
    );
  }

  return bio;
}

/** Section heading above the season narrative on the review screen. */
export function getSeasonStoryHeading(mode: GameMode): string {
  if (mode === "CHALLENGE_CUP") return "Cup Run Story";
  if (mode === "ERA_CHALLENGE_CUP") return "Era Tournament Story";
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
      "League winners after a dominant campaign.",
      "Top of the table and deserved league winners.",
      "They set the standard across the regular season.",
      "A league-winning season built on consistency.",
    ];
  }

  if (mode === "CHALLENGE_CUP") {
    if (isPerfect || grade === "S+" || grade === "S") {
      return [
        "A cup run for the ages — every round felt like destiny.",
        "Wembley-bound form from the opening tie to the final whistle.",
        "A knockout campaign that turned pressure into silverware.",
      ];
    }
    if (grade === "A" || grade === "B") {
      return [
        "A deep cup run that kept the dream alive deep into the competition.",
        "Statement wins in the knockouts — this side belonged in the latter stages.",
        "Cup football at its best: tight games, big moments, real belief.",
      ];
    }
    return [
      "An early exit that left this squad hungry for another cup tilt.",
      "Knockout football is cruel — one bad afternoon ended the run.",
      "Cup hopes faded, but there were flashes of what this team could do.",
    ];
  }

  if (mode === "ERA_CHALLENGE_CUP") {
    if (isPerfect || grade === "S+" || grade === "S") {
      return [
        "An era-defining tournament — this side looked built for the occasion.",
        "Historic opposition, modern pressure, and a squad that rose to it.",
        "A golden era cup run that will be talked about for years.",
      ];
    }
    if (grade === "A" || grade === "B") {
      return [
        "A strong era tournament showing against legendary opposition.",
        "Big names, tight games — this run had real pedigree.",
        "Survived the early rounds and made a genuine tilt at glory.",
      ];
    }
    return [
      "A tough era draw — experience gained against some of the greats.",
      "Knocked out early, but the era tournament tested this squad properly.",
      "Historic opposition exposed gaps this team will want to fix.",
    ];
  }

  if (isPerfect || wins === 27) {
    return [
      "27-0 perfection — the perfect run watch became reality.",
      "An immaculate league season where every week felt inevitable.",
      "The unbeaten chase delivered rugby league folklore.",
    ];
  }

  if (wins >= 20 && losses <= 4) {
    return [
      "A title-chasing season with real momentum and statement wins.",
      "Top-of-the-table form — this squad kept the pressure on all year.",
      "A defining run that only narrowly missed immortality.",
    ];
  }

  if (losses >= 15) {
    return [
      "A season of setbacks — too many results slipped away when it mattered.",
      "The unbeaten dream faded early; rebuilding the belief is the next job.",
      "Inconsistent form derailed the chase — lessons to take into the next run.",
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

const SAFE_POSITION_FALLBACK_BIO =
  "A competitive campaign with plenty to build on.";

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
