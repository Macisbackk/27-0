import { getPlayerColorClub } from "@/lib/players/run-club";
import type { SquadSlot } from "@/lib/types";

/** Majority colour-club from a Quick Mode squad — used for Dream Team Match Stats accents. */
export function resolveSquadClubColorOverride(
  squad: SquadSlot[]
): string | undefined {
  const counts = new Map<string, number>();
  for (const slot of squad) {
    if (!slot.player) continue;
    const club = getPlayerColorClub(slot.player);
    if (!club) continue;
    counts.set(club, (counts.get(club) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [club, count] of counts) {
    if (count > bestCount) {
      best = club;
      bestCount = count;
    }
  }
  return best;
}
