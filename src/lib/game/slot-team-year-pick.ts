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
  getNaturalPlacementSlots,
  getPlacementPenalty,
  getCompatiblePlayerPositions,
  getRemainingNaturalPlayerPositions,
} from "./position-placement";
import {
  buildSlotRevealTarget,
  getTeamSpinPool,
  getYearSpinPool,
  type SlotRevealTarget,
} from "./recruitment-slot-reveal";
import {
  getAllTeamYearPools,
  getEligiblePlayersForTeamYearPool,
  getTeamYearPoolFromTarget,
  type TeamYearPool,
  warnTeamYearPoolLeak,
} from "./team-year-pools";

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

/** Auto-place a Normal Mode signing into the first matching empty slot. */
export function autoPlaceSlotRecruitPlayer(
  squad: SquadSlot[],
  player: Player,
  target: SlotRevealTarget
): SquadSlot[] | null {
  const slot = getFirstNaturalPlacementSlot(squad, player);
  if (!slot) return null;

  const prepared = preparePlayerForTeamYear(player, target);
  warnTeamYearPoolLeak(prepared, target);
  const penalty = getPlacementPenalty(prepared.position, slot.position);
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
  remainingPositions: Set<Position>
): SlotTeamYearPlayer[] {
  return entries.sort((a, b) => {
    const aEligible = remainingPositions.has(a.player.position);
    const bEligible = remainingPositions.has(b.player.position);
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    return b.player.peakRating - a.player.peakRating;
  });
}

export function prepareSlotTeamYearPlayers(
  target: SlotRevealTarget,
  usedIds: Set<string>,
  squad: SquadSlot[]
): SlotTeamYearPlayer[] {
  const pool = getTeamYearPoolFromTarget(target);
  if (!pool) return [];

  const remainingPositions = getRemainingNaturalPlayerPositions(squad);
  const eligible = getEligiblePlayersForTeamYearPool(pool, usedIds, squad);

  const entries = eligible.map((player) => {
    const prepared = preparePlayerForTeamYear(player, target);
    warnTeamYearPoolLeak(prepared, target);
    return { player: prepared };
  });

  return sortPlayersForRecruitSlot(entries, remainingPositions);
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
  const pools = getAllTeamYearPools().filter((pool) =>
    poolHasEligiblePlayers(pool, usedIds, squad)
  );
  if (pools.length === 0) return null;
  const pick = pools[Math.floor(rng() * pools.length)]!;
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
  return getEligiblePlayersForTeamYearPool(pool, usedIds, squad).filter(
    (player) =>
      getNaturalPlacementSlots(squad, player).some(
        (slot) => slot.slotIndex === slotIndex
      )
  );
}

function pickTeamYearForSlot(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  maxAttempts = 64
): { target: SlotRevealTarget; nextSpinIndex: number } | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idx = spinIndex + attempt;
    const rng = seedrandom(`${seed}-slot-autofill-${slotIndex}-${idx}`);
    const pools = getAllTeamYearPools().filter(
      (pool) => eligiblePlayersForSlot(pool, usedIds, squad, slotIndex).length > 0
    );
    if (pools.length === 0) continue;
    const pick = pools[Math.floor(rng() * pools.length)]!;
    const target = buildSlotRevealTarget(pick.team, pick.year);
    return { target, nextSpinIndex: idx + 1 };
  }
  return null;
}

export interface SlotAutofillResult {
  squad: SquadSlot[];
  nextSpinIndex: number;
}

/** Fill all remaining Normal Mode slots using valid team-year pools per pick. */
export function autofillSlotRecruitSquad(
  seed: string,
  startSpinIndex: number,
  squad: SquadSlot[]
): SlotAutofillResult | null {
  let newSquad = squad;
  let usedIds = new Set(
    squad.filter((slot) => slot.player).map((slot) => slot.player!.id)
  );
  let spinIndex = startSpinIndex;

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
      slotIndex
    );
    if (!picked) return null;

    const { target, nextSpinIndex } = picked;
    spinIndex = nextSpinIndex;
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

  return { squad: newSquad, nextSpinIndex: spinIndex };
}

/** Positions eligible when recruiting for a given slot (includes SH/SO and prop/SR compat). */
export function getEligibleRecruitPositions(
  slotPosition: Position
): Position[] {
  return getCompatiblePlayerPositions(slotPosition);
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
