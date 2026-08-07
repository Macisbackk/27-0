/**
 * Monte Carlo: boosted Quick Mode first-pick auto-plan (position + spin).
 * Run: npx tsx scripts/sim-boosted-first-pick.ts
 * Optional: SIM_RUNS=200 npx tsx scripts/sim-boosted-first-pick.ts
 */
import {
  buildBoostedFirstPickPlan,
  listValidBoostedFirstPickSlots,
  slotRevealTargetFromBoostedPlan,
} from "../src/lib/game/boosted-spin-plan";
import { createEmptySquad } from "../src/lib/positions";
import type { QmSelectionBoostId } from "../src/lib/game/quick-mode-pregame-boost";
import { playerMatchesSelectionBoost } from "../src/lib/boosts/applyQuickModeBoost";
import { prepareSlotTeamYearPlayers } from "../src/lib/game/slot-team-year-pick";
import { getTeamYearPoolFromTarget } from "../src/lib/game/team-year-pools";

const RUNS = Number(process.env.SIM_RUNS ?? 200);
const BOOSTS: QmSelectionBoostId[] = [
  "qm-90-plus-player",
  "qm-goat-hall-of-fame",
];
const VARIANTS = ["current", "era"] as const;

function main() {
  const squad = createEmptySquad();
  let ok = 0;
  let failedPlans = 0;
  let emptyValidSlots = 0;
  let incompatibleTeam = 0;
  let emptyPlayerPool = 0;
  let missingGuarantee = 0;
  let invalidSlotChosen = 0;

  for (const boostId of BOOSTS) {
    for (const spinVariant of VARIANTS) {
      // Legend boost is Era-only in product; skip impossible Current routes.
      if (boostId === "qm-goat-hall-of-fame" && spinVariant === "current") {
        continue;
      }
      for (let i = 0; i < RUNS; i++) {
        const seed = `first-pick-sim-${boostId}-${spinVariant}-${i}`;
        const usedIds = new Set<string>();
        const usedTeamYearKeys = new Set<string>();
        const legendSpinSlotIndex = i % 13;

        const validSlots = listValidBoostedFirstPickSlots(
          boostId,
          usedIds,
          squad,
          usedTeamYearKeys,
          {
            spinVariant,
            legendSpinSlotIndex,
            legendSpinUsed: false,
          }
        );

        if (validSlots.length === 0) {
          emptyValidSlots++;
          continue;
        }

        const plan = buildBoostedFirstPickPlan({
          runId: seed,
          seed,
          spinIndex: i,
          boostId,
          usedIds,
          squad,
          usedTeamYearKeys,
          options: {
            spinVariant,
            prepareSeed: seed,
            legendSpinSlotIndex,
            legendSpinUsed: false,
          },
        });

        if (plan.status === "failed") {
          failedPlans++;
          continue;
        }

        if (!validSlots.includes(plan.selectedSlotIndex)) {
          invalidSlotChosen++;
          continue;
        }

        const target = slotRevealTargetFromBoostedPlan(plan.spinPlan);
        const pool = getTeamYearPoolFromTarget(target);
        if (!pool) {
          incompatibleTeam++;
          continue;
        }

        const choices = prepareSlotTeamYearPlayers(
          target!,
          usedIds,
          squad,
          plan.selectedSlotIndex,
          {
            selectionBoostId: boostId,
            seed,
            forcedPlayerIds: plan.spinPlan.playerChoiceIds,
            guaranteedPlayerId: plan.spinPlan.guaranteedPlayerId,
          }
        );

        if (choices.length === 0) {
          emptyPlayerPool++;
          continue;
        }

        const hasBoost = choices.some((c) =>
          playerMatchesSelectionBoost(c.player, boostId)
        );
        if (!hasBoost) {
          missingGuarantee++;
          continue;
        }

        ok++;
      }
    }
  }

  const total =
    BOOSTS.length * VARIANTS.length * RUNS -
    /* skipped goat×current */ RUNS;
  console.log(
    JSON.stringify(
      {
        runsPerBoostVariant: RUNS,
        totalAttempts: total,
        ok,
        emptyValidSlots,
        failedPlans,
        invalidSlotChosen,
        incompatibleTeam,
        emptyPlayerPool,
        missingGuarantee,
      },
      null,
      2
    )
  );

  if (
    failedPlans > 0 ||
    invalidSlotChosen > 0 ||
    incompatibleTeam > 0 ||
    emptyPlayerPool > 0 ||
    missingGuarantee > 0
  ) {
    process.exitCode = 1;
  }
}

main();
