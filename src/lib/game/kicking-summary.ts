import type { FixtureKicking } from "./season-simulation";

export interface KickingSummaryLine {
  name: string;
  label: string;
}

export interface GoalSummaryTag {
  key: "conversion" | "penalty" | "drop";
  label: string;
  count: number;
}

/** Build grouped goal lines for match details (conversions, penalties, drop goals). */
export function buildKickingSummaryLines(
  kicking: FixtureKicking | null | undefined
): KickingSummaryLine[] {
  if (!kicking) return [];

  const lines: KickingSummaryLine[] = [];

  if (kicking.conversions > 0) {
    lines.push({
      name: kicking.name,
      label:
        kicking.conversions > 1
          ? `Conversion ×${kicking.conversions}`
          : "Conversion",
    });
  }
  if (kicking.penalties > 0) {
    lines.push({
      name: kicking.name,
      label:
        kicking.penalties > 1
          ? `Penalty ×${kicking.penalties}`
          : "Penalty",
    });
  }
  if (kicking.dropGoals > 0) {
    lines.push({
      name: kicking.name,
      label:
        kicking.dropGoals > 1
          ? `Drop ×${kicking.dropGoals}`
          : "Drop",
    });
  }

  return lines;
}

/** Compact goal tags for the expand panel (one kicker, short type chips). */
export function buildGoalSummaryTags(
  kicking: FixtureKicking | null | undefined
): GoalSummaryTag[] {
  if (!kicking) return [];

  const tags: GoalSummaryTag[] = [];

  if (kicking.conversions > 0) {
    tags.push({
      key: "conversion",
      count: kicking.conversions,
      label:
        kicking.conversions > 1
          ? `Conv ×${kicking.conversions}`
          : "Conv",
    });
  }
  if (kicking.penalties > 0) {
    tags.push({
      key: "penalty",
      count: kicking.penalties,
      label:
        kicking.penalties > 1 ? `Pen ×${kicking.penalties}` : "Pen",
    });
  }
  if (kicking.dropGoals > 0) {
    tags.push({
      key: "drop",
      count: kicking.dropGoals,
      label:
        kicking.dropGoals > 1
          ? `Drop ×${kicking.dropGoals}`
          : "Drop",
    });
  }

  return tags;
}
