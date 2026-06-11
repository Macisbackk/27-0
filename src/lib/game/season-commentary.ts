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
  "One of the greatest Rugby League squads ever assembled.",
  "A flawless campaign for the ages — 27 wins from 27.",
  "Perfection achieved. This squad belongs in folklore.",
  "Unbeaten, untouchable, and utterly dominant.",
  "The Dream Team didn't just win the league — they owned it.",
];

const WINLESS_SEASON = [
  "A campaign best left in the history books.",
  "Winless and wounded — a rebuild is non-negotiable.",
  "Not a single victory all season. Rock bottom in every sense.",
  "A year to erase from memory and start again.",
  "Zero wins. Maximum pain. Total overhaul required.",
];

const CHAMPION = [
  "An outstanding campaign that will live long in the memory.",
  "League champions. A season of brilliance from first whistle to last.",
  "The trophy is yours — a masterclass in squad building.",
  "Crowned champions after a campaign of real authority.",
  "Top of the pile. This squad conquered Super League.",
];

const RUNNER_UP = [
  "A title challenge that fell just short.",
  "So close to glory — second place with serious honour.",
  "Champions in waiting. One more push next season.",
  "A magnificent effort that just missed the summit.",
  "Second best in the league — but far from second rate.",
];

const PLAYOFF = [
  "Finals rugby league secured — the hard work paid off.",
  "A top-six finish and a genuine shot at the title race.",
  "Into the playoffs with momentum and belief.",
  "Playoff rugby secured — this squad earned their shot at the title.",
  "A strong finish booked a place among the contenders.",
];

const MID_TABLE_HIGH = [
  "A strong season with plenty of positives.",
  "Respectable form throughout — a solid platform to build on.",
  "Mid-table respectability with moments of real quality.",
  "A competitive campaign that never drifted from the fight.",
  "Steady progress and genuine signs of a rising squad.",
];

const MID_TABLE = [
  "A mixed campaign — flashes of brilliance, spells to forget.",
  "Inconsistent but capable. The potential is there.",
  "A season of two halves — promise and frustration in equal measure.",
  "Neither spectacular nor disastrous. Room for growth.",
  "A workmanlike year that could have been so much more.",
];

const LOWER_MID = [
  "A disappointing campaign with flashes of promise.",
  "Below expectations, but not without hope.",
  "Frustrating results masked occasional brilliance.",
  "A season that promised more than it delivered.",
  "Inconsistency cost this squad a better finish.",
];

const LOWER_TABLE = [
  "A difficult season — too many close defeats.",
  "Struggled for consistency when it mattered most.",
  "A campaign that never found its rhythm.",
  "Rebuilding required after a tough year.",
  "Too many losses and not enough answers.",
];

const BOTTOM = [
  "A season to forget. Major rebuilding required.",
  "Rock bottom. This squad needs a complete reset.",
  "Survival wasn't the issue — credibility was.",
  "A grim campaign with no hiding from the table.",
  "Last place. Only direction left is up.",
];

const NEAR_PERFECT = [
  "So close to immortality — one slip from 27-0.",
  "A near-perfect season that will haunt the dressing room.",
  "Champions in all but perfection. What a squad.",
  "One defeat from folklore. Still an elite campaign.",
];

const STRONG_RECORD = [
  "A formidable record — this squad frightened the league.",
  "Twenty-plus wins speaks to genuine title credentials.",
  "Dominant for long stretches. A top-tier season.",
];

const POSITIVE_PD = [
  "A positive points difference underlined the squad's quality.",
  "Scored heavily and defended well — a balanced threat.",
];

const NEGATIVE_PD = [
  "A negative points difference told the story of defensive frailty.",
  "Conceded too many points despite occasional heroics.",
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
