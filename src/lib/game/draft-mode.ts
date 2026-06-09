import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";

/** Pick a random unfilled slot (deterministic per seed + pick index). */
export function pickRandomUnfilledSlot(
  squad: SquadSlot[],
  skipSlots: number[],
  seed: string,
  pickIndex: number
): number | null {
  const skip = new Set(skipSlots);
  const empty = squad.filter((s) => !s.player && !skip.has(s.slotIndex));
  if (empty.length === 0) return null;

  const rng = seedrandom(`${seed}-draft-pick-${pickIndex}`);
  return empty[Math.floor(rng() * empty.length)].slotIndex;
}
