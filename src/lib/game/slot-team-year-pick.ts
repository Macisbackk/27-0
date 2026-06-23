import seedrandom from "seedrandom";
import { formatEraDisplayName } from "../players/era-teams";
import { formatShortYear } from "../players/prime-year";
import { withRunClub } from "../players/run-club";
import { withEraYear } from "../players/player-age";
import type { Player, Position, SquadSlot } from "../types";
import { RECRUIT_SLOT_ORDER } from "../positions";
import { signPlayerToSlot } from "../positions";
import {
  getFirstNaturalPlacementSlot,
  getPlacementPenalty,
  getRecruitListPositionsForSlot,
} from "./position-placement";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  getTeamYearRecruitPosition,
  canPlayerFillTeamYearSlot,
} from "../players/team-year-roster-playable";
import {
  buildSlotRevealTarget,
  getTeamSpinPool,
  getYearSpinPool,
  type SlotRevealTarget,
} from "./recruitment-slot-reveal";
import {
  getSpinTeamYearPoolsCached,
  type SpinPoolVariant,
} from "./player-pool-eligibility";
import { pickClubUniformTeamYearPool } from "./spin-club-pick";
import { pickLegendTeamYearForSlot } from "./legend-spin";
import { spinTimingMark } from "./spin-timing";
import {
  buildTeamYearId,
  getEligiblePlayersForTeamYearPool,
  getRawPlayersForTeamYearPool,
  getTeamYearPoolFromTarget,
  isPlayerInTeamYearPool,
  type TeamYearPool,
  warnTeamYearPoolLeak,
} from "./team-year-pools";

function filterSpinPools(
  pools: TeamYearPool[],
  predicate: (pool: TeamYearPool) => boolean
): TeamYearPool[] {
  return pools.filter(predicate);
}

/** Prefer team-years not yet used this run; fall back if pool exhausted. */
function preferUnusedTeamYearPools(
  pools: TeamYearPool[],
  usedTeamYearKeys: ReadonlySet<string>
): TeamYearPool[] {
  if (usedTeamYearKeys.size === 0) return pools;
  const unused = pools.filter(
    (pool) => !usedTeamYearKeys.has(buildTeamYearId(pool.team, pool.year))
  );
  return unused.length > 0 ? unused : pools;
}

function pickPoolFromCandidates(
  candidates: TeamYearPool[],
  rng: () => number,
  validate: (pool: TeamYearPool) => boolean,
  variant: SpinPoolVariant = "era"
): TeamYearPool | null {
  return pickClubUniformTeamYearPool(candidates, rng, validate, variant).pool;
}

export interface SlotSpinPickOptions {
  requireLegendPlayer?: boolean;
  spinVariant?: SpinPoolVariant;
}

export interface SlotPlayerPrepareOptions {
  legendOnly?: boolean;
}

export interface SlotTeamYearPlayer {
  player: Player;
}

export function getSlotTeamYearSpinPools(target: SlotRevealTarget): {
  teams: string[];
  years: string[];
} {
  return {
    teams: getTeamSpinPool(target.team, target.teamYearKey),
    years: getYearSpinPool(target.team, target.year),
  };
}

/** Place a Normal Mode signing into the user-selected slot. */
export function placeSlotRecruitPlayerAtSlot(
  squad: SquadSlot[],
  player: Player,
  target: SlotRevealTarget,
  slotIndex: number
): SquadSlot[] | null {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return null;

  const prepared = preparePlayerForTeamYear(player, target);
  warnTeamYearPoolLeak(prepared, target);

  if (!canPlayerFillTeamYearSlot(target.team, target.year, prepared, slot.position)) {
    return null;
  }

  const penalty = getPlacementPenalty(prepared.position, slot.position, prepared);
  return signPlayerToSlot(squad, prepared, slotIndex, penalty);
}

/** @deprecated Use placeSlotRecruitPlayerAtSlot for position-first Normal Mode. */
export function autoPlaceSlotRecruitPlayer(
  squad: SquadSlot[],
  player: Player,
  target: SlotRevealTarget
): SquadSlot[] | null {
  const slot = getFirstNaturalPlacementSlot(squad, player);
  if (!slot) return null;

  const prepared = preparePlayerForTeamYear(player, target);
  warnTeamYearPoolLeak(prepared, target);
  const penalty = getPlacementPenalty(prepared.position, slot.position, prepared);
  return signPlayerToSlot(squad, prepared, slot.slotIndex, penalty);
}

export function preparePlayerForTeamYear(
  player: Player,
  target: SlotRevealTarget
): Player {
  const eraYear = Number.parseInt(target.year, 10);
  const runClub = formatEraDisplayName(target.team, target.year);
  const withYear = Number.isFinite(eraYear)
    ? withEraYear(
        { ...player, primeYear: undefined, cardYear: eraYear },
        eraYear
      )
    : { ...player, primeYear: undefined };
  return withRunClub(withYear, runClub, {
    eraYear: Number.isFinite(eraYear) ? eraYear : undefined,
  });
}

function sortPlayersForRecruitSlot(
  entries: SlotTeamYearPlayer[],
  slotPosition: Position,
  team: string,
  year: string
): SlotTeamYearPlayer[] {
  return entries.sort((a, b) => {
    const ratingDiff = b.player.peakRating - a.player.peakRating;
    if (ratingDiff !== 0) return ratingDiff;
    const aPos = getTeamYearRecruitPosition(team, year, a.player);
    const bPos = getTeamYearRecruitPosition(team, year, b.player);
    const aNatural = aPos === slotPosition;
    const bNatural = bPos === slotPosition;
    if (aNatural !== bNatural) return aNatural ? -1 : 1;
    return a.player.name.localeCompare(b.player.name);
  });
}

export function prepareSlotTeamYearPlayers(
  target: SlotRevealTarget,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  options: SlotPlayerPrepareOptions = {}
): SlotTeamYearPlayer[] {
  const pool = getTeamYearPoolFromTarget(target);
  if (!pool) return [];

  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return [];

  const entries = getRawPlayersForTeamYearPool(pool)
    .filter(
      (player) =>
        isPlayerInTeamYearPool(player.id, pool) &&
        !usedIds.has(player.id) &&
        canPlayerFillTeamYearSlot(target.team, target.year, player, slot.position) &&
        (!options.legendOnly || player.category === "legend")
    )
    .map((player) => {
      const prepared = preparePlayerForTeamYear(player, target);
      warnTeamYearPoolLeak(prepared, target);
      return { player: prepared };
    });

  return sortPlayersForRecruitSlot(entries, slot.position, target.team, target.year);
}

function poolHasEligiblePlayers(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[]
): boolean {
  return getEligiblePlayersForTeamYearPool(pool, usedIds, squad).length > 0;
}

function pickSlotTeamYearTargetOnce(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[]
): SlotRevealTarget | null {
  const rng = seedrandom(`${seed}-slot-team-year-spin-${spinIndex}`);
  const pools = filterSpinPools(getSpinTeamYearPoolsCached("era"), (pool) =>
    poolHasEligiblePlayers(pool, usedIds, squad)
  );
  if (pools.length === 0) return null;
  const pick = pickPoolFromCandidates(pools, rng, (pool) =>
    poolHasEligiblePlayers(pool, usedIds, squad)
  );
  if (!pick) return null;
  return buildSlotRevealTarget(pick.team, pick.year);
}

/** Deterministic team/year draw — rerolls internally if pool cannot supply players. */
export function generateSlotTeamYearTarget(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  maxAttempts = 48
): SlotRevealTarget | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const target = pickSlotTeamYearTargetOnce(
      seed,
      spinIndex + attempt,
      usedIds,
      squad
    );
    if (!target) continue;

    const pool = getTeamYearPoolFromTarget(target);
    if (!pool) continue;
    if (poolHasEligiblePlayers(pool, usedIds, squad)) {
      return target;
    }
  }
  return null;
}

function eligiblePlayersForSlot(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number
): Player[] {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return [];

  const allowedPositions = new Set(
    getRecruitListPositionsForSlot(slot.position)
  );

  return getRawPlayersForTeamYearPool(pool).filter(
    (player) =>
      isPlayerInTeamYearPool(player.id, pool) &&
      !usedIds.has(player.id) &&
      canPlayerFillTeamYearSlot(pool.team, pool.year, player, slot.position)
  );
}

function eligibleLegendPlayersForSlot(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number
): Player[] {
  return eligiblePlayersForSlot(pool, usedIds, squad, slotIndex).filter(
    (player) => player.category === "legend"
  );
}

/** Deterministic team/year draw for a selected slot — animation lands on this exact result. */
export function generateSlotTeamYearTargetForSlot(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  usedTeamYearKeys: ReadonlySet<string> = new Set(),
  options: SlotSpinPickOptions = {}
): SlotRevealTarget | null {
  if (options.requireLegendPlayer) {
    const legendPick = pickLegendTeamYearForSlot(
      seed,
      spinIndex,
      usedIds,
      squad,
      slotIndex,
      usedTeamYearKeys,
      options.spinVariant ?? "current"
    );
    if (!legendPick) return null;
    return buildSlotRevealTarget(legendPick.team, legendPick.year);
  }

  const picked = pickTeamYearForSlot(
    seed,
    spinIndex,
    usedIds,
    squad,
    slotIndex,
    usedTeamYearKeys,
    options
  );
  return picked?.target ?? null;
}

function pickTeamYearForSlot(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  usedTeamYearKeys: ReadonlySet<string> = new Set(),
  options: SlotSpinPickOptions = {}
): { target: SlotRevealTarget; nextSpinIndex: number } | null {
  const variant = options.spinVariant ?? "current";
  const t0 = spinTimingMark("pick-team-year-start");
  const validatePool = (pool: TeamYearPool) =>
    options.requireLegendPlayer
      ? eligibleLegendPlayersForSlot(pool, usedIds, squad, slotIndex).length > 0
      : eligiblePlayersForSlot(pool, usedIds, squad, slotIndex).length > 0;

  const rng = seedrandom(`${seed}-slot-autofill-${slotIndex}-${spinIndex}`);
  const eligible = filterSpinPools(
    getSpinTeamYearPoolsCached(variant),
    validatePool
  );
  const pools = preferUnusedTeamYearPools(eligible, usedTeamYearKeys);
  if (pools.length === 0) {
    spinTimingMark("pick-team-year-empty", t0);
    return null;
  }

  const { pool: pick, rerollCount } = pickClubUniformTeamYearPool(
    pools,
    rng,
    validatePool,
    variant
  );

  if (!pick) {
    spinTimingMark(`pick-team-year-no-match-rerolls-${rerollCount}`, t0);
    return null;
  }

  const target = buildSlotRevealTarget(pick.team, pick.year);
  spinTimingMark(`pick-team-year-${target.teamYearId}`, t0);
  return { target, nextSpinIndex: spinIndex + 1 };
}

export interface SlotAutofillResult {
  squad: SquadSlot[];
  nextSpinIndex: number;
  usedTeamYearKeys: string[];
}

/** Fill all remaining Normal Mode slots using valid team-year pools per pick. */
export function autofillSlotRecruitSquad(
  seed: string,
  startSpinIndex: number,
  squad: SquadSlot[],
  usedTeamYearKeys: ReadonlySet<string> = new Set()
): SlotAutofillResult | null {
  let newSquad = squad;
  let usedIds = new Set(
    squad.filter((slot) => slot.player).map((slot) => slot.player!.id)
  );
  let spinIndex = startSpinIndex;
  const teamYearsUsed = new Set(usedTeamYearKeys);

  const emptySlotIndices = RECRUIT_SLOT_ORDER.filter((slotIndex) => {
    const slot = newSquad.find((s) => s.slotIndex === slotIndex);
    return slot && !slot.player;
  });

  for (const slotIndex of emptySlotIndices) {
    const picked = pickTeamYearForSlot(
      seed,
      spinIndex,
      usedIds,
      newSquad,
      slotIndex,
      teamYearsUsed
    );
    if (!picked) return null;

    const { target, nextSpinIndex } = picked;
    spinIndex = nextSpinIndex;
    teamYearsUsed.add(target.teamYearKey);
    const pool = getTeamYearPoolFromTarget(target);
    if (!pool) return null;

    const candidates = eligiblePlayersForSlot(
      pool,
      usedIds,
      newSquad,
      slotIndex
    );
    if (candidates.length === 0) return null;

    const rng = seedrandom(`${seed}-slot-autofill-pick-${slotIndex}-${spinIndex}`);
    const player = preparePlayerForTeamYear(
      candidates[Math.floor(rng() * candidates.length)]!,
      target
    );
    warnTeamYearPoolLeak(player, target);

    newSquad = signPlayerToSlot(newSquad, player, slotIndex);
    usedIds = new Set(
      newSquad.filter((slot) => slot.player).map((slot) => slot.player!.id)
    );
  }

  return {
    squad: newSquad,
    nextSpinIndex: spinIndex,
    usedTeamYearKeys: [...teamYearsUsed],
  };
}

/** Positions eligible when recruiting for a given slot (includes SH/SO and prop/SR compat). */
export function getEligibleRecruitPositions(
  slotPosition: Position
): Position[] {
  return getRecruitListPositionsForSlot(slotPosition);
}

const BIO_SNIPPETS = {
  powerhouse: [
    "a powerhouse era packed with title-winning quality",
    "a golden generation built for big nights",
    "serious pedigree and plenty of star power",
  ],
  modern: [
    "a modern squad with serious top-end talent",
    "pace, power and plenty of big-game pedigree",
    "contemporary quality across the spine",
  ],
  classic: [
    "old-school grit with match-winning class",
    "a classic side that knew how to grind out wins",
    "hard-nosed rugby with genuine star names",
  ],
  default: [
    "a draw packed with recruitment intrigue",
    "plenty of talent waiting in the squad",
    "a squad worth building around",
  ],
} as const;

export function getSlotRevealBio(team: string, year: string): string {
  const y = Number.parseInt(year, 10);
  const key = `${team}|${year}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  }

  let pool: readonly string[];
  if (y >= 2024) pool = BIO_SNIPPETS.modern;
  else if (y <= 2005) pool = BIO_SNIPPETS.classic;
  else if (y >= 2010 && y <= 2016) pool = BIO_SNIPPETS.powerhouse;
  else pool = BIO_SNIPPETS.default;

  const line = pool[hash % pool.length]!;
  return `${team} ${formatShortYear(year)} lands in the slot — ${line}.`;
}
