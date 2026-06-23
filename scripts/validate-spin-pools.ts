/**
 * Validate slot reel display pools for Normal Mode spins.
 * Run: npm run validate:spin-pools
 */
import { getNormalModeTeamYearPools } from "../src/lib/game/player-pool-eligibility";
import {
  buildSlotRevealTarget,
  getAllNormalModeSpinTeams,
  getAllNormalModeSpinYears,
  getSlotSpinTeamPool,
  getSlotSpinYearPool,
} from "../src/lib/game/recruitment-slot-reveal";
import { buildSlotReelPool, computeSlotReelFinalIndex } from "../src/lib/game/slot-reel";

function main(): void {
  const pools = getNormalModeTeamYearPools();
  if (pools.length === 0) {
    console.error("FAIL: no Normal Mode team-year pools");
    process.exit(1);
  }

  const teams = getAllNormalModeSpinTeams();
  const years = getAllNormalModeSpinYears();
  console.log(`Spin teams: ${teams.length}, years: ${years.length}`);

  let failures = 0;
  for (const pool of pools.slice(0, 12)) {
    const target = buildSlotRevealTarget(pool.team, pool.year);
    const teamPool = buildSlotReelPool(
      getSlotSpinTeamPool(target.team, "era", target.teamYearKey),
      target.team
    );
    const yearPool = buildSlotReelPool(
      getSlotSpinYearPool(target.team, target.year, "era"),
      target.year
    );

    const teamFinal = computeSlotReelFinalIndex(teamPool, target.team);
    const yearFinal = computeSlotReelFinalIndex(yearPool, target.year);

    if (!teamPool.includes(target.team)) {
      console.error(`FAIL: team pool missing ${target.team}`);
      failures++;
    }
    if (!yearPool.includes(target.year)) {
      console.error(`FAIL: year pool missing ${target.year}`);
      failures++;
    }
    if (teamFinal < 0 || yearFinal < 0) {
      console.error(`FAIL: invalid final index for ${target.teamYearKey}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} spin pool check(s) failed`);
    process.exit(1);
  }

  console.log("OK: spin reel pools include landing values for sampled targets");
}

main();
