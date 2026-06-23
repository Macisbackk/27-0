import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";
import { RECRUIT_SLOT_ORDER } from "../positions";
import { getNormalModeTeamYearPoolsCached } from "./player-pool-eligibility";
import { pickClubUniformTeamYearPool } from "./spin-club-pick";
import { buildTeamYearId } from "./team-year-pools";
import {
  getRawPlayersForTeamYearPool,
  isPlayerInTeamYearPool,
  type TeamYearPool,
} from "./team-year-pools";
import { canPlayerFillTeamYearSlot } from "../players/team-year-roster-playable";

function eligibleLegendPlayersForSlot(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number
): boolean {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return false;

  return getRawPlayersForTeamYearPool(pool).some(
    (player) =>
      player.category === "legend" &&
      isPlayerInTeamYearPool(player.id, pool) &&
      !usedIds.has(player.id) &&
      canPlayerFillTeamYearSlot(pool.team, pool.year, player, slot.position)
  );
}

/** Whether any legend can be recruited for this slot in Normal Mode. */
export function slotHasLegendSpinOption(
  squad: SquadSlot[],
  slotIndex: number,
  usedIds: Set<string> = new Set()
): boolean {
  const pools = getNormalModeTeamYearPoolsCached();
  return pools.some((pool) =>
    eligibleLegendPlayersForSlot(pool, usedIds, squad, slotIndex)
  );
}

/** Pick one unfilled slot index for the guaranteed Normal Mode legend spin. */
export function pickLegendSpinSlotIndex(
  seed: string,
  squad: SquadSlot[],
  usedIds: Set<string> = new Set()
): number | null {
  const rng = seedrandom(`${seed}-legend-spin-slot`);
  const candidates = RECRUIT_SLOT_ORDER.filter((slotIndex) => {
    const slot = squad.find((s) => s.slotIndex === slotIndex);
    return slot && !slot.player && slotHasLegendSpinOption(squad, slotIndex, usedIds);
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)]!;
}

/** Club-uniform team-year pick restricted to pools with legend players for the slot. */
export function pickLegendTeamYearForSlot(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  usedTeamYearKeys: ReadonlySet<string>
): { team: string; year: string; teamYearKey: string; teamYearId: string } | null {
  const rng = seedrandom(`${seed}-legend-spin-${slotIndex}-${spinIndex}`);
  let pools = getNormalModeTeamYearPoolsCached().filter((pool) =>
    eligibleLegendPlayersForSlot(pool, usedIds, squad, slotIndex)
  );
  if (usedTeamYearKeys.size > 0) {
    const unused = pools.filter(
      (pool) => !usedTeamYearKeys.has(buildTeamYearId(pool.team, pool.year))
    );
    if (unused.length > 0) pools = unused;
  }
  if (pools.length === 0) return null;

  const { pool } = pickClubUniformTeamYearPool(pools, rng, (p) =>
    eligibleLegendPlayersForSlot(p, usedIds, squad, slotIndex)
  );
  if (!pool) return null;

  const teamYearId = buildTeamYearId(pool.team, pool.year);
  return {
    team: pool.team,
    year: pool.year,
    teamYearKey: teamYearId,
    teamYearId,
  };
}