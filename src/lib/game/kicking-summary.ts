import type { FixtureKicking } from "./season-simulation";

export interface KickingSummaryLine {
  name: string;
  label: string;
}

/** Build grouped kicking lines for match details (conversions, penalties, drop goals). */
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
          ? `Conversion x${kicking.conversions}`
          : "Conversion",
    });
  }
  if (kicking.penalties > 0) {
    lines.push({
      name: kicking.name,
      label:
        kicking.penalties > 1
          ? `Penalty Goal x${kicking.penalties}`
          : "Penalty Goal",
    });
  }
  if (kicking.dropGoals > 0) {
    lines.push({
      name: kicking.name,
      label:
        kicking.dropGoals > 1
          ? `Drop Goal x${kicking.dropGoals}`
          : "Drop Goal",
    });
  }

  return lines;
}
