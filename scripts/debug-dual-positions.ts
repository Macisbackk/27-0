import type { Position } from "../src/lib/types";
import { createEmptySquad, signPlayerToSlot, POSITION_SHORT } from "../src/lib/positions";
import { getAllDatabasePlayers } from "../src/lib/players";
import {
  formatPositionAbbreviations,
  getEligiblePositions,
  getPlayerRatingForPosition,
} from "../src/lib/players/player-positions";
import { getPlacementPenalty } from "../src/lib/game/position-placement";
import { getSlotDisplayInfo } from "../src/lib/squad-display";
import { getAverageSquadRating, getEffectivePeakRating } from "../src/lib/squad-analysis";

const players = getAllDatabasePlayers().filter(
  (p) => getEligiblePositions(p).length > 1
);

let failures = 0;
let checked = 0;

for (const player of players) {
  const positions = getEligiblePositions(player);
  const abbrev = formatPositionAbbreviations(player);
  const ratings: string[] = [];
  let playerOk = true;

  for (const position of positions) {
    checked++;
    const squad = signPlayerToSlot(createEmptySquad(), player, slotIndexFor(position));
    const slot = squad.find((s) => s.position === position)!;
    const penalty = getPlacementPenalty(player.position, position, player);
    const effective = getEffectivePeakRating(slot);
    const display = getSlotDisplayInfo(slot);
    const teamAvg = getAverageSquadRating(squad);

    const ok =
      penalty === 0 &&
      effective === player.peakRating &&
      display?.ratingAdjusted === false &&
      display?.positionMismatch === false &&
      teamAvg === player.peakRating &&
      getPlayerRatingForPosition(player, position) === player.peakRating;

    if (!ok) {
      playerOk = false;
      failures++;
    }

    ratings.push(
      `${POSITION_SHORT[position]} ${effective}${ok ? "" : " FAIL"}`
    );
  }

  console.log(
    `${player.name} ${abbrev}: ${ratings.join(", ")} — ${playerOk ? "OK" : "FAIL"}`
  );
}

console.log("");
console.log(
  `Checked ${checked} eligible slot placements across ${players.length} dual-position players.`
);
console.log(failures === 0 ? "All dual-position checks passed." : `${failures} failures.`);

if (failures > 0) {
  process.exit(1);
}

function slotIndexFor(position: Position): number {
  const squad = createEmptySquad();
  const slot = squad.find((s) => s.position === position);
  if (!slot) throw new Error(`No slot for ${position}`);
  return slot.slotIndex;
}
