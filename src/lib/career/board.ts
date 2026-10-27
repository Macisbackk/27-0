/**
 * The board's season target: one league place to finish at or above, set when the season starts
 * from where the squad is expected to finish (with a little slack). It's a goal to chase on the
 * hub and a verdict on the review screen — no money rides on it, so missing it never punishes.
 */
import type { Division } from "./types";

/** Places the board picks from, best first. */
function bands(division: Division, size: number): number[] {
  if (division === "super-league") return [4, 6, 9, Math.max(1, size - 2)];
  return [2, 5, Math.ceil(size / 2), Math.max(1, size - 2)];
}

/** Target place for a club expected to finish `expectedRank` of `size`. */
export function boardTargetForRank(division: Division, expectedRank: number, size: number): number {
  const options = bands(division, size).filter((b) => b <= size);
  return options.find((b) => b >= expectedRank + 1) ?? options[options.length - 1] ?? size;
}

/** "Reach the play-offs", "Finish in the top 6", "Stay up"… */
export function boardTargetLabel(division: Division, target: number, size: number): string {
  if (division === "super-league") {
    if (target <= 4) return "Reach the play-offs (top 4)";
    if (target >= size - 2) return `Stay up (${target}th or better)`;
    return `Finish in the top ${target}`;
  }
  if (target === 1) return "Win the Championship";
  if (target === 2) return "Push for promotion (top 2)";
  return `Finish in the top ${target}`;
}
