import type { SeasonResult } from "./season-simulation";

const BOTTOM_POSITION = 14;
const PLAYOFF_CUTOFF = 6;

type CommentaryContext = {
  wins: number;
  losses: number;
  leaguePosition: number;
  pointsDifference: number;
  grade: string;
  isPerfect: boolean;
  isWinless: boolean;
  wonLeague: boolean;
  madePlayoffs: boolean;
  finishedBottom: boolean;
  seed: number;
};

function hashSeason(
  wins: number,
  losses: number,
  position: number,
  pointsDifference: number
): number {
  return (
    wins * 31 +
    losses * 17 +
    position * 13 +
    Math.abs(pointsDifference) * 7
  );
}

function pickVariant(lines: string[], seed: number): string {
  return lines[seed % lines.length];
}

const PERFECT_SEASON = [
  "Greatest squad assembled.",
  "27 from 27. Flawless.",
  "Perfection. Folklore.",
  "Unbeaten. Untouchable.",
  "Owned the league.",
];

const WINLESS_SEASON = [
  "Best left forgotten.",
  "Winless. Rebuild required.",
  "Zero wins. Rock bottom.",
  "Erase and start again.",
  "Zero wins. Total overhaul.",
];

const CHAMPION = [
  "Outstanding campaign.",
  "League champions.",
  "Trophy secured.",
  "Crowned. Real authority.",
  "Top of the pile.",
];

const RUNNER_UP = [
  "Title challenge. Just short.",
  "Second. Serious honour.",
  "Champions in waiting.",
  "Missed the summit.",
  "Second best — not second rate.",
];

const PLAYOFF = [
  "Finals secured.",
  "Top six. Title shot.",
  "Playoffs with belief.",
  "Earned a shot.",
  "Among the contenders.",
];

const MID_TABLE_HIGH = [
  "Strong season. Positives.",
  "Solid platform.",
  "Mid-table. Real quality.",
  "Competitive throughout.",
  "Rising squad signs.",
];

const MID_TABLE = [
  "Mixed. Flashes of quality.",
  "Inconsistent but capable.",
  "Promise and frustration.",
  "Neither spectacular nor grim.",
  "Could have been more.",
];

const LOWER_MID = [
  "Disappointing. Flashes of hope.",
  "Below expectations.",
  "Frustrating. Occasional brilliance.",
  "Promised more.",
  "Inconsistency cost them.",
];

const LOWER_TABLE = [
  "Too many close defeats.",
  "No consistency when it mattered.",
  "Never found rhythm.",
  "Rebuild after a tough year.",
  "Too many losses.",
];

const BOTTOM = [
  "Season to forget. Rebuild.",
  "Rock bottom. Reset.",
  "Credibility gone.",
  "Grim. Nowhere to hide.",
  "Last place. Only way is up.",
];

const NEAR_PERFECT = [
  "One slip from 27-0.",
  "Near-perfect. Haunting.",
  "Champions in all but perfection.",
  "One defeat from folklore.",
];

const STRONG_RECORD = [
  "Formidable. Frightened the league.",
  "20+ wins. Title credentials.",
  "Dominant stretches. Top-tier.",
];

const POSITIVE_PD = [
  "Positive PD. Real quality.",
  "Scored and defended well.",
];

const NEGATIVE_PD = [
  "Negative PD. Defensive frailty.",
  "Conceded too many.",
];

function buildContext(
  result: SeasonResult,
  grade: string
): CommentaryContext {
  return {
    wins: result.wins,
    losses: result.losses,
    leaguePosition: result.leaguePosition,
    pointsDifference: result.pointsDifference,
    grade,
    isPerfect: result.isPerfect,
    isWinless: result.wins === 0,
    wonLeague: result.leaguePosition === 1,
    madePlayoffs: result.leaguePosition <= PLAYOFF_CUTOFF,
    finishedBottom: result.leaguePosition >= BOTTOM_POSITION,
    seed: hashSeason(
      result.wins,
      result.losses,
      result.leaguePosition,
      result.pointsDifference
    ),
  };
}

function positionCommentary(ctx: CommentaryContext): string {
  if (ctx.isPerfect) return pickVariant(PERFECT_SEASON, ctx.seed);
  if (ctx.isWinless) return pickVariant(WINLESS_SEASON, ctx.seed + 1);

  if (ctx.losses <= 1 && ctx.wins >= 26) {
    return pickVariant(NEAR_PERFECT, ctx.seed + 2);
  }

  if (ctx.wonLeague) return pickVariant(CHAMPION, ctx.seed + 3);

  if (ctx.leaguePosition === 2) return pickVariant(RUNNER_UP, ctx.seed + 4);

  if (ctx.madePlayoffs) return pickVariant(PLAYOFF, ctx.seed + 5);

  if (ctx.finishedBottom) return pickVariant(BOTTOM, ctx.seed + 6);

  if (ctx.leaguePosition <= 8) {
    return pickVariant(
      ctx.leaguePosition <= 5 ? MID_TABLE_HIGH : LOWER_MID,
      ctx.seed + 7
    );
  }

  if (ctx.leaguePosition <= 11) {
    return pickVariant(MID_TABLE, ctx.seed + 8);
  }

  return pickVariant(LOWER_TABLE, ctx.seed + 9);
}

function supplementalCommentary(ctx: CommentaryContext): string | null {
  if (ctx.isPerfect || ctx.isWinless) return null;

  if (ctx.wins >= 20 && !ctx.wonLeague) {
    return pickVariant(STRONG_RECORD, ctx.seed + 10);
  }

  if (ctx.pointsDifference >= 120) {
    return pickVariant(POSITIVE_PD, ctx.seed + 11);
  }

  if (ctx.pointsDifference <= -80) {
    return pickVariant(NEGATIVE_PD, ctx.seed + 12);
  }

  if (ctx.grade === "S" || ctx.grade === "S+") {
    const elite = [
      "An S-grade squad that delivered on its promise.",
      "Elite talent converted into elite results.",
    ];
    return pickVariant(elite, ctx.seed + 13);
  }

  if (ctx.grade === "F") {
    const poor = [
      "On paper and on the pitch, this squad fell short.",
      "The grade reflects a season that never clicked.",
    ];
    return pickVariant(poor, ctx.seed + 14);
  }

  return null;
}

export function getSeasonCommentary(
  result: SeasonResult,
  grade: string
): string {
  const ctx = buildContext(result, grade);
  const primary = positionCommentary(ctx);
  const extra = supplementalCommentary(ctx);

  if (extra && extra !== primary) {
    return `${primary} ${extra}`;
  }

  return primary;
}

export const COMMENTARY_CATEGORIES = [
  "Perfect Season (27-0)",
  "Winless Season (0-27)",
  "Near Perfect (26+ wins)",
  "League Champion (1st)",
  "Runner Up (2nd)",
  "Playoff Qualification (Top 6)",
  "Upper Mid Table (3rd–5th)",
  "Mid Table (6th–8th)",
  "Lower Mid Table (9th–11th)",
  "Lower Table (12th–13th)",
  "Bottom Finish (14th)",
  "Strong Record (20+ wins)",
  "Positive Points Difference",
  "Negative Points Difference",
  "Elite Grade (S/S+)",
  "Poor Grade (F)",
] as const;
