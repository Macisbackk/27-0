/**
 * Shared Monte Carlo drafting for Classic (current cards) and Era Classic, using the real
 * slot-spin flow: each slot spins a club-season, the player is offered up to three cards
 * and picks one.
 *   best   — always the highest-rated of the offered cards (near-perfect draft)
 *   good   — one of the two best offered (strong draft)
 *   random — any offered card (typical draft)
 *   weak   — always the lowest-rated offered card
 */
import seedrandom from "seedrandom";
import { createEmptySquad, RECRUIT_SLOT_ORDER } from "../../src/lib/positions";
import {
  generateSlotTeamYearTargetForSlot,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "../../src/lib/game/slot-team-year-pick";
import { getPlayerRatingForPosition } from "../../src/lib/players/player-positions";
import type { SquadSlot } from "../../src/lib/types";
import type { SpinRuleFilter } from "../../src/lib/game/daily-rule-filter";
import type { SpinPoolVariant } from "../../src/lib/game/player-pool-eligibility";

export type DraftStrategy = "best" | "good" | "random" | "weak";
export type DraftMode = "classic" | "era";

export interface DraftSquadOptions {
  /** Override the pool variant (One-Club XI uses "all"). */
  spinVariant?: SpinPoolVariant;
  /** Spin rule (One-Club XI's club filter, a Weekly theme…). */
  ruleFilter?: SpinRuleFilter | null;
}

export function draftSquad(
  seed: string,
  mode: DraftMode,
  strategy: DraftStrategy,
  options: DraftSquadOptions = {}
): SquadSlot[] {
  let squad = createEmptySquad();
  const usedTeamYears = new Set<string>();
  const rng = seedrandom(`${seed}-pick`);
  let spinIndex = 0;
  for (const slotIndex of RECRUIT_SLOT_ORDER) {
    const usedIds = new Set(squad.filter((s) => s.player).map((s) => s.player!.id));
    const target = generateSlotTeamYearTargetForSlot(
      seed,
      spinIndex++,
      usedIds,
      squad,
      slotIndex,
      usedTeamYears,
      {
        spinVariant: options.spinVariant ?? (mode === "era" ? "era" : "current"),
        ruleFilter: options.ruleFilter ?? null,
      }
    );
    if (!target) continue;
    usedTeamYears.add(target.teamYearKey);
    const slot = squad.find((s) => s.slotIndex === slotIndex)!;
    const offered = prepareSlotTeamYearPlayers(target, usedIds, squad, slotIndex, {
      seed,
      ruleFilter: options.ruleFilter ?? null,
    })
      .map((e) => e.player)
      .sort(
        (a, b) =>
          getPlayerRatingForPosition(b, slot.position) -
          getPlayerRatingForPosition(a, slot.position)
      );
    if (offered.length === 0) continue;
    const pick =
      strategy === "best"
        ? offered[0]!
        : strategy === "weak"
          ? offered[offered.length - 1]!
          : strategy === "good"
            ? offered[Math.min(offered.length - 1, Math.floor(rng() * 2))]!
            : offered[Math.floor(rng() * offered.length)]!;
    squad = placeSlotRecruitPlayerAtSlot(squad, pick, target, slotIndex) ?? squad;
  }
  return squad;
}
