/**
 * Monte Carlo: boosted Quick Mode spins must land on compatible team-years.
 */
import {
  buildBoostedSpinPlan,
  slotRevealTargetFromBoostedPlan,
} from "../src/lib/game/boosted-spin-plan";
import { createEmptySquad } from "../src/lib/positions";
import type { QmSelectionBoostId } from "../src/lib/game/quick-mode-pregame-boost";
import { playerMatchesSelectionBoost } from "../src/lib/boosts/applyQuickModeBoost";
import { prepareSlotTeamYearPlayers } from "../src/lib/game/slot-team-year-pick";
import { getTeamYearPoolFromTarget } from "../src/lib/game/team-year-pools";

const RUNS = Number(process.env.SIM_RUNS ?? 1000);
const BOOSTS: QmSelectionBoostId[] = [
  "qm-90-plus-player",
  "qm-goat-hall-of-fame",
];
const VARIANTS = ["current", "era"] as const;

function main() {
  const squad = createEmptySquad();
  let incompatible = 0;
  let emptyPool = 0;
  let failedPlans = 0;
  let ok = 0;
  let missingGuarantee = 0;

  for (const boostId of BOOSTS) {
    for (const spinVariant of VARIANTS) {
      for (let i = 0; i < RUNS; i++) {
        const seed = `boost-sim-${boostId}-${spinVariant}-${i}`;
        const slotIndex = i % 13;
        const plan = buildBoostedSpinPlan({
          runId: seed,
          seed,
          spinIndex: i,
          boostId,
          usedIds: new Set(),
          squad,
          slotIndex,
          usedTeamYearKeys: new Set(),
          options: { spinVariant, prepareSeed: seed },
        });

        if (plan.status === "failed") {
          failedPlans++;
          continue;
        }

        const target = slotRevealTargetFromBoostedPlan(plan);
        const pool = getTeamYearPoolFromTarget(target);
        if (!pool) {
          incompatible++;
          continue;
        }

        const choices = prepareSlotTeamYearPlayers(
          target,
          new Set(),
          squad,
          slotIndex,
          {
            selectionBoostId: boostId,
            seed,
            forcedPlayerIds: plan.playerChoiceIds,
            guaranteedPlayerId: plan.guaranteedPlayerId,
          }
        );

        if (choices.length === 0) {
          emptyPool++;
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

  const total = BOOSTS.length * VARIANTS.length * RUNS;
  console.log(
    JSON.stringify(
      {
        runsPerBoostVariant: RUNS,
        totalAttempts: total,
        ok,
        failedPlans,
        incompatibleTeam: incompatible,
        emptyPlayerPool: emptyPool,
        missingGuarantee,
      },
      null,
      2
    )
  );

  if (incompatible > 0 || emptyPool > 0 || missingGuarantee > 0) {
    process.exitCode = 1;
  }
}

main();
