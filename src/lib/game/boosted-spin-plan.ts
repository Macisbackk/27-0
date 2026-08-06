/**
 * Quick Mode boosted team/year spin planning.
 * When a 90+ or Legend boost is armed, the next spin must land on a
 * compatible pool that can supply an eligible boosted player — never an
 * unfiltered random team/year.
 */
import seedrandom from "seedrandom";
import type { Player, SquadSlot } from "../types";
import {
  isLegendBoostPlayer,
  isNinetyPlusPlayer,
} from "../boosts/applyQuickModeBoost";
import {
  buildSlotRevealTarget,
  type SlotRevealTarget,
} from "./recruitment-slot-reveal";
import {
  getSpinTeamYearPoolsCached,
  type SpinPoolVariant,
} from "./player-pool-eligibility";
import { pickClubUniformTeamYearPool } from "./spin-club-pick";
import {
  buildTeamYearId,
  type TeamYearPool,
} from "./team-year-pools";
import {
  eligiblePlayersForSlot,
  prepareSlotTeamYearPlayers,
  type SlotSpinPickOptions,
} from "./slot-team-year-pick";
import type { QmSelectionBoostId } from "./quick-mode-pregame-boost";

export const BOOSTED_SPIN_PLAN_VERSION = 2;

export type BoostedSpinPlan = {
  runId: string;
  boostId: "qm-90-plus-player" | "qm-goat-hall-of-fame";
  positionId: string;
  slotIndex: number;
  compatibleTeamYearKeys: string[];
  selectedTeamId: string;
  selectedTeam: string;
  selectedYear: string;
  compatiblePlayerIds: string[];
  guaranteedPlayerId: string;
  secondaryPlayerId?: string;
  playerChoiceIds: string[];
  status: "planned" | "team-spun" | "players-generated" | "consumed" | "failed";
  failureReason?: string;
  version: number;
};

export type BuildBoostedSpinPlanInput = {
  runId: string;
  seed: string;
  spinIndex: number;
  boostId: QmSelectionBoostId;
  usedIds: Set<string>;
  squad: SquadSlot[];
  slotIndex: number;
  usedTeamYearKeys?: ReadonlySet<string>;
  options?: SlotSpinPickOptions & {
    /** Run seed for prepareSlotTeamYearPlayers shuffle. */
    prepareSeed?: string;
  };
};

function boostMatchFn(
  boostId: QmSelectionBoostId
): (player: Player) => boolean {
  return boostId === "qm-90-plus-player"
    ? isNinetyPlusPlayer
    : isLegendBoostPlayer;
}

function teamYearKey(pool: Pick<TeamYearPool, "team" | "year">): string {
  return `${pool.team}|${pool.year}`;
}

/** Prefer team-years not yet used this run; fall back if pool exhausted. */
function preferUnusedTeamYearPools(
  pools: TeamYearPool[],
  usedTeamYearKeys: ReadonlySet<string>
): TeamYearPool[] {
  if (usedTeamYearKeys.size === 0) return pools;
  const unused = pools.filter(
    (pool) => !usedTeamYearKeys.has(teamYearKey(pool))
  );
  return unused.length > 0 ? unused : pools;
}

function eligibleForBoostInPool(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  boostId: QmSelectionBoostId,
  requireLegendPlayer?: boolean
): Player[] {
  const match = boostMatchFn(boostId);
  let eligible = eligiblePlayersForSlot(pool, usedIds, squad, slotIndex);
  if (requireLegendPlayer) {
    eligible = eligible.filter((player) => player.category === "legend");
  }
  return eligible.filter(match);
}

function emptyFailedPlan(
  input: Pick<
    BuildBoostedSpinPlanInput,
    "runId" | "boostId" | "slotIndex" | "squad"
  >,
  reason: string,
  compatibleTeamYearKeys: string[] = []
): BoostedSpinPlan {
  const slot = input.squad.find((s) => s.slotIndex === input.slotIndex);
  return {
    runId: input.runId,
    boostId: input.boostId,
    positionId: slot ? String(slot.position) : String(input.slotIndex),
    slotIndex: input.slotIndex,
    compatibleTeamYearKeys,
    selectedTeamId: "",
    selectedTeam: "",
    selectedYear: "",
    compatiblePlayerIds: [],
    guaranteedPlayerId: "",
    playerChoiceIds: [],
    status: "failed",
    failureReason: reason,
    version: BOOSTED_SPIN_PLAN_VERSION,
  };
}

/**
 * All spin pools where the slot has at least one unused player matching the boost.
 * Respects requireLegendPlayer. Prefers unused team-years but falls back when exhausted.
 */
export function listCompatibleTeamYearsForBoost(
  boostId: QmSelectionBoostId,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  usedTeamYearKeys: ReadonlySet<string> = new Set(),
  options: SlotSpinPickOptions = {}
): TeamYearPool[] {
  const variant: SpinPoolVariant = options.spinVariant ?? "current";
  const requireLegend = options.requireLegendPlayer === true;

  const eligible = getSpinTeamYearPoolsCached(variant).filter(
    (pool) =>
      eligibleForBoostInPool(
        pool,
        usedIds,
        squad,
        slotIndex,
        boostId,
        requireLegend
      ).length > 0
  );

  return preferUnusedTeamYearPools(eligible, usedTeamYearKeys);
}

/**
 * Plan the next boosted spin: pick a compatible team/year and prepare player
 * choices (including a guaranteed boosted player) before animation starts.
 * Never picks a random unfiltered team when no compatible pool exists.
 */
export function buildBoostedSpinPlan(
  input: BuildBoostedSpinPlanInput
): BoostedSpinPlan {
  const {
    runId,
    seed,
    spinIndex,
    boostId,
    usedIds,
    squad,
    slotIndex,
    usedTeamYearKeys = new Set(),
    options = {},
  } = input;
  const variant: SpinPoolVariant = options.spinVariant ?? "current";
  const requireLegend = options.requireLegendPlayer === true;
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  const positionId = slot ? String(slot.position) : String(slotIndex);

  const failReason =
    boostId === "qm-90-plus-player"
      ? "No eligible 90+ player for this slot — boost kept for a later pick."
      : "No eligible Legend player for this slot — boost kept for a later pick.";

  const compatible = listCompatibleTeamYearsForBoost(
    boostId,
    usedIds,
    squad,
    slotIndex,
    usedTeamYearKeys,
    options
  );
  const compatibleTeamYearKeys = compatible.map(teamYearKey);

  if (compatible.length === 0) {
    return emptyFailedPlan(input, failReason, compatibleTeamYearKeys);
  }

  const validatePool = (pool: TeamYearPool) =>
    eligibleForBoostInPool(
      pool,
      usedIds,
      squad,
      slotIndex,
      boostId,
      requireLegend
    ).length > 0;

  const rng = seedrandom(
    `${seed}-slot-boost-${boostId}-${slotIndex}-${spinIndex}`
  );
  const { pool: pick } = pickClubUniformTeamYearPool(
    compatible,
    rng,
    validatePool,
    variant
  );

  if (!pick) {
    return emptyFailedPlan(input, failReason, compatibleTeamYearKeys);
  }

  const target = buildSlotRevealTarget(pick.team, pick.year);
  const boostedInPool = eligibleForBoostInPool(
    pick,
    usedIds,
    squad,
    slotIndex,
    boostId,
    requireLegend
  );
  const compatiblePlayerIds = boostedInPool.map((p) => p.id);

  const choices = prepareSlotTeamYearPlayers(
    target,
    usedIds,
    squad,
    slotIndex,
    {
      seed: options.prepareSeed ?? seed,
      legendOnly: requireLegend,
      selectionBoostId: boostId,
      guaranteedPlayerId: compatiblePlayerIds[0],
    }
  );

  if (choices.length === 0) {
    return emptyFailedPlan(
      input,
      "Boosted selection could not be generated for this slot — boost kept.",
      compatibleTeamYearKeys
    );
  }

  const match = boostMatchFn(boostId);
  const guaranteed =
    choices.find((e) => match(e.player)) ??
    choices.find((e) => e.player.id === compatiblePlayerIds[0]) ??
    choices[0]!;
  const playerChoiceIds = choices.map((e) => e.player.id);
  const secondary = playerChoiceIds.find((id) => id !== guaranteed.player.id);

  return {
    runId,
    boostId,
    positionId,
    slotIndex,
    compatibleTeamYearKeys,
    selectedTeamId: target.teamYearKey,
    selectedTeam: target.team,
    selectedYear: target.year,
    compatiblePlayerIds,
    guaranteedPlayerId: guaranteed.player.id,
    secondaryPlayerId: secondary,
    playerChoiceIds,
    status: "planned",
    version: BOOSTED_SPIN_PLAN_VERSION,
  };
}

export function slotRevealTargetFromBoostedPlan(
  plan: BoostedSpinPlan
): SlotRevealTarget | null {
  if (
    plan.status === "failed" ||
    !plan.selectedTeam ||
    !plan.selectedYear
  ) {
    return null;
  }
  return buildSlotRevealTarget(plan.selectedTeam, plan.selectedYear);
}

export function markBoostedSpinPlanTeamSpun(
  plan: BoostedSpinPlan
): BoostedSpinPlan {
  if (plan.status === "failed" || plan.status === "consumed") return plan;
  return { ...plan, status: "team-spun" };
}

export function markBoostedSpinPlanPlayersGenerated(
  plan: BoostedSpinPlan
): BoostedSpinPlan {
  if (plan.status === "failed" || plan.status === "consumed") return plan;
  return { ...plan, status: "players-generated" };
}

export function markBoostedSpinPlanConsumed(
  plan: BoostedSpinPlan
): BoostedSpinPlan {
  return { ...plan, status: "consumed" };
}

/** Resolve planned choice IDs back into prepared slot entries. */
export function resolveBoostedSpinPlanPlayers(
  plan: BoostedSpinPlan,
  target: SlotRevealTarget,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  prepareSeed?: string
): ReturnType<typeof prepareSlotTeamYearPlayers> {
  if (
    plan.status === "failed" ||
    plan.playerChoiceIds.length === 0 ||
    plan.selectedTeamId !== target.teamYearKey
  ) {
    return [];
  }

  return prepareSlotTeamYearPlayers(target, usedIds, squad, slotIndex, {
    seed: prepareSeed,
    selectionBoostId: plan.boostId,
    guaranteedPlayerId: plan.guaranteedPlayerId,
    forcedPlayerIds: plan.playerChoiceIds,
  });
}

export function boostFailureNotice(
  boostId: QmSelectionBoostId,
  reason?: string
): string {
  if (reason) return reason;
  return boostId === "qm-90-plus-player"
    ? "No eligible 90+ player for this slot — boost kept for a later pick."
    : "No eligible Legend player for this slot — boost kept for a later pick.";
}

export function teamYearIdForPlan(plan: BoostedSpinPlan): string {
  if (!plan.selectedTeam || !plan.selectedYear) return "";
  return buildTeamYearId(plan.selectedTeam, plan.selectedYear);
}
