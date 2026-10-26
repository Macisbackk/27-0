import { getSeasonGradeFromSquad } from "../grades";
import { getSquadValue } from "../positions";
import type { SquadSlot } from "../types";

/**
 * Squad grade for a finished Classic season. Kept out of achievementTriggers.ts and loaded on
 * demand: grading reaches the whole player database (~1.5 MB of JSON), and the triggers module
 * is also imported by Manager Mode and the puzzles, which never grade a Classic squad.
 */
export function gradeQuickSeasonSquad(
  squad: SquadSlot[],
  season: Parameters<typeof getSeasonGradeFromSquad>[1]
) {
  return getSeasonGradeFromSquad(squad, season, getSquadValue(squad));
}
