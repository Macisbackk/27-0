/**
 * Shared Monte Carlo drafting for Classic (current cards) and Era Classic, using the real
 * slot-spin flows:
 *   Classic — club choice: each slot spins, and the player is offered up to three cards that
 *             can play it, each from a different club (prepareSlotClubChoicePlayers).
 *   Era     — club spin: each slot spins a club-season, and the player is offered up to three
 *             cards from it (prepareSlotTeamYearPlayers). Also Daily / Weekly / Gauntlet /
 *             One-Club on either card set (`flow: "club-spin"`).
 * Strategies (Classic scores a card by its rating for the slot plus the chemistry it adds —
 * getChoiceScore, the same "Top" the picker shows; Era has no chemistry, so rating alone):
 *   best   — always the top-scoring offered card (near-perfect draft)
 *   good   — one of the two best offered (strong draft)
 *   random — any offered card (typical draft)
 *   weak   — always the lowest-scoring offered card
 */
import seedrandom from "seedrandom";
import { createEmptySquad, RECRUIT_SLOT_ORDER } from "../../src/lib/positions";
import {
  generateSlotTeamYearTargetForSlot,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotClubChoicePlayers,
  prepareSlotTeamYearPlayers,
  type SlotTeamYearPlayer,
} from "../../src/lib/game/slot-team-year-pick";
import { getChemistryGain, getChoiceScore } from "../../src/lib/game/chemistry";
import { getPlayerRatingForPosition } from "../../src/lib/players/player-positions";
import type { SquadSlot } from "../../src/lib/types";
import type { SpinRuleFilter } from "../../src/lib/game/daily-rule-filter";
import type { SpinPoolVariant } from "../../src/lib/game/player-pool-eligibility";

export type DraftStrategy = "best" | "good" | "random" | "weak";
export type DraftMode = "classic" | "era";
/** "club-choice" = normal Classic; "club-spin" = Era and the modes that keep the club spin. */
export type DraftFlow = "club-choice" | "club-spin";

export interface DraftSquadOptions {
  /** Override the pool variant (One-Club XI uses "all"). */
  spinVariant?: SpinPoolVariant;
  /** Spin rule (One-Club XI's club filter, a Weekly theme…). */
  ruleFilter?: SpinRuleFilter | null;
  /** Default: club choice for Classic, club spin for Era (and whenever a rule is set). */
  flow?: DraftFlow;
}

export function draftSquad(
  seed: string,
  mode: DraftMode,
  strategy: DraftStrategy,
  options: DraftSquadOptions = {}
): SquadSlot[] {
  const spinVariant = options.spinVariant ?? (mode === "era" ? "era" : "current");
  const flow: DraftFlow =
    options.flow ??
    (mode === "classic" && spinVariant === "current" && !options.ruleFilter
      ? "club-choice"
      : "club-spin");
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
      // Club choice never steers away from clubs already used (repeats are how links happen).
      flow === "club-choice" ? new Set() : usedTeamYears,
      {
        spinVariant,
        ruleFilter: options.ruleFilter ?? null,
      }
    );
    if (!target) continue;
    usedTeamYears.add(target.teamYearKey);
    const slot = squad.find((s) => s.slotIndex === slotIndex)!;
    const entries: SlotTeamYearPlayer[] =
      flow === "club-choice"
        ? prepareSlotClubChoicePlayers(target, usedIds, squad, slotIndex, { seed, spinVariant })
        : prepareSlotTeamYearPlayers(target, usedIds, squad, slotIndex, {
            seed,
            ruleFilter: options.ruleFilter ?? null,
          });
    const score = (e: SlotTeamYearPlayer) =>
      getChoiceScore(
        getPlayerRatingForPosition(e.player, slot.position),
        flow === "club-choice" ? getChemistryGain(squad, slotIndex, e.player) : 0
      );
    const offered = entries
      .map((e) => ({ e, s: score(e) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
    if (offered.length === 0) continue;
    const pick =
      strategy === "best"
        ? offered[0]!
        : strategy === "weak"
          ? offered[offered.length - 1]!
          : strategy === "good"
            ? offered[Math.min(offered.length - 1, Math.floor(rng() * 2))]!
            : offered[Math.floor(rng() * offered.length)]!;
    squad = placeSlotRecruitPlayerAtSlot(squad, pick.player, pick.target ?? target, slotIndex) ?? squad;
  }
  return squad;
}
