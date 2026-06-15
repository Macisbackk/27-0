import type { ClubPlayerEntry } from "./squad-analysis";
import {
  getFormationSlotDisplayLabel,
  getFormationSlotSortOrder,
} from "./positions";
import { formatPositionReviewText } from "./squad-display";

export interface TeamSheetLineupRow {
  positionLabel: string;
  player: ClubPlayerEntry;
}

/** Build a flat team-sheet lineup in formation order (matches squad selection layout). */
export function buildTeamSheetLineup(
  players: ClubPlayerEntry[]
): TeamSheetLineupRow[] {
  const sorted = [...players].sort(
    (a, b) =>
      getFormationSlotSortOrder(a.slotIndex) -
        getFormationSlotSortOrder(b.slotIndex) ||
      a.name.localeCompare(b.name)
  );

  return sorted.map((player) => ({
    positionLabel:
      player.slotLabel ||
      getFormationSlotDisplayLabel(player.slotIndex),
    player,
  }));
}

export function formatLineupPositionText(player: ClubPlayerEntry): string {
  return formatPositionReviewText(player);
}
