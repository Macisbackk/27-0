import seedrandom from "seedrandom";
import { formatEraDisplayName, resolveEraTeamClubName } from "../players/era-teams";
import { CHEMISTRY_PAIRS, getChemistryClub } from "./chemistry";
import { formatShortYear } from "../players/prime-year";
import { withRunClub } from "../players/run-club";
import { withEraYear } from "../players/player-age";
import type { Player, Position, SquadSlot } from "../types";
import { normalizePlayerNameKey } from "../player-name-normalize";

/**
 * The same real player has a separate card per club/era (e.g. Jamie Peacock at Bradford and
 * Leeds). Card ids differ, so filtering by id alone let one person be signed twice.
 */
function signedPersonKeys(squad: SquadSlot[]): Set<string> {
  const keys = new Set<string>();
  for (const slot of squad) {
    if (!slot.player) continue;
    keys.add(normalizePlayerNameKey(slot.player.name));
    if (slot.player.basePlayerId) keys.add(`base:${slot.player.basePlayerId}`);
  }
  return keys;
}

export function isPersonAlreadySigned(player: Player, squad: SquadSlot[]): boolean {
  const keys = signedPersonKeys(squad);
  return (
    keys.has(normalizePlayerNameKey(player.name)) ||
    (player.basePlayerId ? keys.has(`base:${player.basePlayerId}`) : false)
  );
}
import { RECRUIT_SLOT_ORDER } from "../positions";
import { signPlayerToSlot } from "../positions";
import {
  getFirstNaturalPlacementSlot,
  getPlacementPenalty,
  getRecruitListPositionsForSlot,
} from "./position-placement";
import {
  getTeamYearRecruitPosition,
  canPlayerFillTeamYearSlot,
} from "../players/team-year-roster-playable";
import {
  buildSlotRevealTarget,
  buildTeamYearKey,
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
import {
  isGoatOrHallOfFamePlayer,
  isNinetyPlusPlayer,
  playerMatchesSelectionBoost,
} from "../boosts/applyQuickModeBoost";
import { spinTimingMark } from "./spin-timing";
import {
  getEligiblePlayersForTeamYearPool,
  getRawPlayersForTeamYearPool,
  getTeamYearPoolFromTarget,
  isPlayerInTeamYearPool,
  type TeamYearPool,
  warnTeamYearPoolLeak,
} from "./team-year-pools";
import {
  applyPlayerRuleWithFallback,
  poolPassesRule,
  type SpinRuleFilter,
} from "./daily-rule-filter";

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
    (pool) => !usedTeamYearKeys.has(buildTeamYearKey(pool.team, pool.year))
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
  /**
   * Daily Challenge rule: spins land only on team-years with an eligible player who passes it.
   * Falls back to unrestricted pools if the rule can't fill the slot (never soft-locks).
   */
  ruleFilter?: SpinRuleFilter | null;
}

export interface SlotPlayerPrepareOptions {
  legendOnly?: boolean;
  /** Run seed — shuffles eligible recruits deterministically before capping choices. */
  seed?: string;
  /** Force at least one matching Quick Mode selection-boost player into the choice list. */
  selectionBoostId?: "qm-90-plus-player" | "qm-goat-hall-of-fame";
  /** Prefer this boosted player id when injecting a selection-boost guarantee. */
  guaranteedPlayerId?: string;
  /** When set, rebuild choices from these ids (BoostedSpinPlan) instead of shuffling. */
  forcedPlayerIds?: readonly string[];
  /** Daily Challenge rule: only offer players who pass it (unless none in this team-year do). */
  ruleFilter?: SpinRuleFilter | null;
}

export const MAX_SLOT_RECRUIT_CHOICES = 3;

export interface SlotTeamYearPlayer {
  player: Player;
  /**
   * The club-season this card comes from. Set on Classic club-choice offers, where each card
   * is from a different club; absent when every card comes from the one spun team-year.
   */
  target?: SlotRevealTarget;
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
  if (isPersonAlreadySigned(player, squad)) return null;

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

function shuffleSlotRecruitEntries<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
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
  const signed = signedPersonKeys(squad);

  const available = getRawPlayersForTeamYearPool(pool).filter(
    (player) =>
      isPlayerInTeamYearPool(player.id, pool) &&
      !usedIds.has(player.id) &&
      !signed.has(normalizePlayerNameKey(player.name)) &&
      !(player.basePlayerId && signed.has(`base:${player.basePlayerId}`)) &&
      canPlayerFillTeamYearSlot(target.team, target.year, player, slot.position)
  );
  const ruled = applyPlayerRuleWithFallback(available, options.ruleFilter);
  const legends = options.legendOnly
    ? ruled.filter((player) => player.category === "legend")
    : ruled;
  // Safety net: never leave the legend slot with an empty choice list (soft-lock).
  const entries = (legends.length > 0 ? legends : ruled)
    .map((player) => {
      const prepared = preparePlayerForTeamYear(player, target);
      warnTeamYearPoolLeak(prepared, target);
      return { player: prepared };
    });

  const sorted = sortPlayersForRecruitSlot(
    entries,
    slot.position,
    target.team,
    target.year
  );

  if (options.forcedPlayerIds && options.forcedPlayerIds.length > 0) {
    const byId = new Map(sorted.map((e) => [e.player.id, e]));
    const forced = options.forcedPlayerIds
      .map((id) => byId.get(id))
      .filter((e): e is SlotTeamYearPlayer => e != null)
      .slice(0, MAX_SLOT_RECRUIT_CHOICES);
    if (forced.length === 0) return [];
    if (options.selectionBoostId) {
      const match = (p: Player) =>
        playerMatchesSelectionBoost(p, options.selectionBoostId!);
      if (!forced.some((e) => match(e.player))) return [];
    }
    return forced;
  }

  const seed = options.seed ?? `${target.teamYearKey}-${slotIndex}`;
  const rng = seedrandom(`${seed}-slot-recruit-choices-${slotIndex}-${target.teamYearKey}`);
  let chosen = shuffleSlotRecruitEntries(sorted, rng).slice(
    0,
    MAX_SLOT_RECRUIT_CHOICES
  );

  if (options.selectionBoostId) {
    const match = (p: Player) =>
      playerMatchesSelectionBoost(p, options.selectionBoostId!);
    if (!chosen.some((e) => match(e.player))) {
      const preferredId = options.guaranteedPlayerId;
      const boosted =
        (preferredId
          ? sorted.find((e) => e.player.id === preferredId && match(e.player))
          : undefined) ?? sorted.find((e) => match(e.player));
      if (!boosted) return [];
      chosen = [
        boosted,
        ...chosen.filter((e) => e.player.id !== boosted.player.id),
      ].slice(0, MAX_SLOT_RECRUIT_CHOICES);
    }
  }

  return chosen;
}

/** Position names on Classic's position reel. */
export const POSITION_SPIN_LABELS: Record<Position, string> = {
  FULLBACK: "Fullback",
  WING: "Wing",
  CENTRE: "Centre",
  STAND_OFF: "Stand Off",
  SCRUM_HALF: "Scrum Half",
  PROP: "Prop",
  HOOKER: "Hooker",
  SECOND_ROW: "Second Row",
  LOOSE_FORWARD: "Loose Forward",
};

export interface PositionSpinOption {
  position: Position;
  label: string;
  /** The empty slot a signing for this position goes into (first in team-sheet order). */
  slotIndex: number;
}

/**
 * Classic position spin: one option per position that still has an empty slot, in team-sheet
 * order. `allowedSlots` narrows it (e.g. an armed 90+ boost only spins positions it can fill).
 */
export function getPositionSpinOptions(
  squad: SquadSlot[],
  allowedSlots?: readonly number[] | null
): PositionSpinOption[] {
  const options: PositionSpinOption[] = [];
  for (const slotIndex of RECRUIT_SLOT_ORDER) {
    const slot = squad.find((s) => s.slotIndex === slotIndex);
    if (!slot || slot.player) continue;
    if (allowedSlots && !allowedSlots.includes(slotIndex)) continue;
    if (options.some((o) => o.position === slot.position)) continue;
    options.push({ position: slot.position, label: POSITION_SPIN_LABELS[slot.position], slotIndex });
  }
  return options;
}

/**
 * Classic: the position reel's result for this spin — uniform over the positions that still
 * have an empty slot. Seeded by run seed + spin index, so a resumed run spins the same.
 */
export function pickPositionSpin(
  seed: string,
  spinIndex: number,
  squad: SquadSlot[],
  allowedSlots?: readonly number[] | null
): PositionSpinOption | null {
  const options = getPositionSpinOptions(squad, allowedSlots);
  if (options.length === 0) return null;
  const rng = seedrandom(`${seed}-position-spin-${spinIndex}`);
  return options[Math.floor(rng() * options.length)]!;
}

/** Clubs (chemistry keys) of the signed players this slot links with. */
export function getChemistryNeighbourClubs(squad: SquadSlot[], slotIndex: number): Set<string> {
  const clubs = new Set<string>();
  for (const [a, b] of CHEMISTRY_PAIRS) {
    const other = a === slotIndex ? b : b === slotIndex ? a : null;
    if (other === null) continue;
    const player = squad.find((s) => s.slotIndex === other)?.player;
    const club = player ? getChemistryClub(player) : null;
    if (club) clubs.add(club);
  }
  return clubs;
}

export interface SlotClubChoiceOptions {
  /** Run seed — draws the cards and the other clubs deterministically. */
  seed?: string;
  /** The spun club's card must be a legend (falls back to anyone if none is left). */
  legendOnly?: boolean;
  /** The spun club's card must match this Quick Mode selection boost (else no offer). */
  selectionBoostId?: "qm-90-plus-player" | "qm-goat-hall-of-fame";
  /** Prefer this boosted player for the spun club's card. */
  guaranteedPlayerId?: string;
  /** Pools the other clubs are drawn from (default: Classic's 2026 squads). */
  spinVariant?: SpinPoolVariant;
}

/**
 * Classic club-choice offer: up to three cards for the slot, each from a DIFFERENT club, so
 * the player can steer towards club links (chemistry).
 *
 * The spun club-season (`primary`) gives one card — that is where a boost or legend guarantee
 * lands. If a chemistry neighbour (same line, next slot) is already signed and the spun club
 * isn't theirs, the second card comes from a neighbour's club, so a link is always on offer;
 * the rest are drawn uniformly from every club that still has someone who can play the slot.
 * One card per club, a random eligible player each (never a person already signed, never the
 * same person twice). Deterministic for the same seed, slot, spun club and squad, so reopening
 * a locked spin or resuming a run shows the same three.
 */
export function prepareSlotClubChoicePlayers(
  primary: SlotRevealTarget,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  options: SlotClubChoiceOptions = {}
): SlotTeamYearPlayer[] {
  const primaryPool = getTeamYearPoolFromTarget(primary);
  if (!primaryPool) return [];
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return [];

  const seed = options.seed ?? primary.teamYearKey;
  const rng = seedrandom(`${seed}-club-choice-${slotIndex}-${primary.teamYearKey}`);
  const pickFrom = (players: Player[]) =>
    [...players].sort((a, b) => a.id.localeCompare(b.id))[Math.floor(rng() * players.length)]!;

  const eligible = eligiblePlayersForSlot(primaryPool, usedIds, squad, slotIndex);
  if (eligible.length === 0) return [];
  let primaryPlayer: Player | undefined;
  if (options.selectionBoostId) {
    const match = (p: Player) => playerMatchesSelectionBoost(p, options.selectionBoostId!);
    const legendPool = options.legendOnly
      ? eligible.filter((p) => p.category === "legend" && match(p))
      : [];
    const boosted = legendPool.length > 0 ? legendPool : eligible.filter(match);
    if (boosted.length === 0) return [];
    primaryPlayer =
      boosted.find((p) => p.id === options.guaranteedPlayerId) ?? pickFrom(boosted);
  } else {
    const legends = options.legendOnly
      ? eligible.filter((p) => p.category === "legend")
      : [];
    primaryPlayer = pickFrom(legends.length > 0 ? legends : eligible);
  }

  const offer: SlotTeamYearPlayer[] = [
    { player: preparePlayerForTeamYear(primaryPlayer, primary), target: primary },
  ];
  const offeredKeys = new Set<string>([normalizePlayerNameKey(primaryPlayer.name)]);
  if (primaryPlayer.basePlayerId) offeredKeys.add(`base:${primaryPlayer.basePlayerId}`);
  const isOffered = (p: Player) =>
    offeredKeys.has(normalizePlayerNameKey(p.name)) ||
    (p.basePlayerId ? offeredKeys.has(`base:${p.basePlayerId}`) : false);

  const candidatesFor = (pool: TeamYearPool) =>
    eligiblePlayersForSlot(pool, usedIds, squad, slotIndex).filter((p) => !isOffered(p));
  let others = getSpinTeamYearPoolsCached(options.spinVariant ?? "current").filter(
    (pool) => pool.team !== primary.team && candidatesFor(pool).length > 0
  );
  // Chemistry: when a neighbour in this line is signed and the spun club isn't theirs, one of
  // the other cards comes from a neighbour's club, so there is always a link on the table.
  const linkClubs = getChemistryNeighbourClubs(squad, slotIndex);
  const linkClubOf = (pool: Pick<TeamYearPool, "team" | "year">) =>
    resolveEraTeamClubName(formatEraDisplayName(pool.team, pool.year)).trim().toLowerCase();
  const linkPools =
    linkClubs.size > 0 && !linkClubs.has(linkClubOf(primary))
      ? others.filter((pool) => linkClubs.has(linkClubOf(pool)))
      : [];
  let linkPending = linkPools.length > 0;
  while (offer.length < MAX_SLOT_RECRUIT_CHOICES && others.length > 0) {
    const fromLinks = linkPending;
    linkPending = false;
    const { pool } = pickClubUniformTeamYearPool(
      fromLinks ? linkPools : others,
      rng,
      (p) => candidatesFor(p).length > 0,
      options.spinVariant ?? "current"
    );
    if (!pool) {
      if (fromLinks) continue;
      break;
    }
    const player = pickFrom(candidatesFor(pool));
    const target = buildSlotRevealTarget(pool.team, pool.year);
    offer.push({ player: preparePlayerForTeamYear(player, target), target });
    offeredKeys.add(normalizePlayerNameKey(player.name));
    if (player.basePlayerId) offeredKeys.add(`base:${player.basePlayerId}`);
    others = others.filter((p) => p.team !== pool.team);
  }

  for (const entry of offer) warnTeamYearPoolLeak(entry.player, entry.target!);
  // Shuffle so the spun club (and any boosted card) isn't always on the top reel.
  return shuffleSlotRecruitEntries(offer, rng);
}

/** Find a team/year whose eligible slot pool contains a matching selection boost player. */
export function findSlotTeamYearTargetForSelectionBoost(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  boostId: "qm-90-plus-player" | "qm-goat-hall-of-fame",
  usedTeamYearKeys: ReadonlySet<string> = new Set(),
  options: SlotSpinPickOptions = {}
): SlotRevealTarget | null {
  const variant = options.spinVariant ?? "current";
  const match =
    boostId === "qm-90-plus-player"
      ? isNinetyPlusPlayer
      : isGoatOrHallOfFamePlayer;

  const validatePool = (pool: TeamYearPool) => {
    let eligible = eligiblePlayersForSlot(pool, usedIds, squad, slotIndex);
    if (options.requireLegendPlayer) {
      eligible = eligible.filter((player) => player.category === "legend");
    }
    return eligible.some(match);
  };

  const eligible = filterSpinPools(
    getSpinTeamYearPoolsCached(variant),
    validatePool
  );
  const pools = preferUnusedTeamYearPools(eligible, usedTeamYearKeys);
  if (pools.length === 0) return null;

  const rng = seedrandom(
    `${seed}-slot-boost-${boostId}-${slotIndex}-${spinIndex}`
  );
  const { pool: pick } = pickClubUniformTeamYearPool(
    pools,
    rng,
    validatePool,
    variant
  );
  if (!pick) return null;
  return buildSlotRevealTarget(pick.team, pick.year);
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

export function eligiblePlayersForSlot(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  ruleFilter?: SpinRuleFilter | null
): Player[] {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return [];
  if (!poolPassesRule(pool, ruleFilter)) return [];
  const signed = signedPersonKeys(squad);
  const playerFilter = ruleFilter?.playerFilter;

  return getRawPlayersForTeamYearPool(pool).filter(
    (player) =>
      isPlayerInTeamYearPool(player.id, pool) &&
      !usedIds.has(player.id) &&
      !signed.has(normalizePlayerNameKey(player.name)) &&
      !(player.basePlayerId && signed.has(`base:${player.basePlayerId}`)) &&
      (!playerFilter || playerFilter(player)) &&
      canPlayerFillTeamYearSlot(pool.team, pool.year, player, slot.position)
  );
}

function eligibleLegendPlayersForSlot(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  ruleFilter?: SpinRuleFilter | null
): Player[] {
  return eligiblePlayersForSlot(pool, usedIds, squad, slotIndex, ruleFilter).filter(
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
      options.spinVariant ?? "current",
      options.ruleFilter
    );
    if (legendPick) return buildSlotRevealTarget(legendPick.team, legendPick.year);
    // Every eligible legend is already in the squad (e.g. signed on another club's card):
    // fall back to a normal spin rather than locking the slot.
    options = { ...options, requireLegendPlayer: false };
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
  if (options.ruleFilter) {
    const ruled = pickTeamYearForSlotWithRule(
      seed,
      spinIndex,
      usedIds,
      squad,
      slotIndex,
      usedTeamYearKeys,
      options,
      options.ruleFilter
    );
    if (ruled) return ruled;
    // The Daily rule can't fill this slot any more: spin the normal pools rather than lock it.
  }
  return pickTeamYearForSlotWithRule(
    seed,
    spinIndex,
    usedIds,
    squad,
    slotIndex,
    usedTeamYearKeys,
    options,
    null
  );
}

function pickTeamYearForSlotWithRule(
  seed: string,
  spinIndex: number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  slotIndex: number,
  usedTeamYearKeys: ReadonlySet<string>,
  options: SlotSpinPickOptions,
  ruleFilter: SpinRuleFilter | null
): { target: SlotRevealTarget; nextSpinIndex: number } | null {
  const variant = options.spinVariant ?? "current";
  const t0 = spinTimingMark("pick-team-year-start");
  const validatePool = (pool: TeamYearPool) =>
    options.requireLegendPlayer
      ? eligibleLegendPlayersForSlot(pool, usedIds, squad, slotIndex, ruleFilter).length > 0
      : eligiblePlayersForSlot(pool, usedIds, squad, slotIndex, ruleFilter).length > 0;

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
  usedTeamYearKeys: ReadonlySet<string> = new Set(),
  spinVariant: SpinPoolVariant = "current",
  ruleFilter: SpinRuleFilter | null = null
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
      teamYearsUsed,
      { spinVariant, ruleFilter }
    );
    if (!picked) return null;

    const { target, nextSpinIndex } = picked;
    spinIndex = nextSpinIndex;
    teamYearsUsed.add(target.teamYearKey);
    const pool = getTeamYearPoolFromTarget(target);
    if (!pool) return null;

    const candidates = applyPlayerRuleWithFallback(
      eligiblePlayersForSlot(pool, usedIds, newSquad, slotIndex),
      ruleFilter
    );
    if (candidates.length === 0) return null;

    const rng = seedrandom(`${seed}-slot-autofill-pick-${slotIndex}-${spinIndex}`);
    const player = preparePlayerForTeamYear(
      candidates[Math.floor(rng() * candidates.length)]!,
      target
    );
    warnTeamYearPoolLeak(player, target);

    const slot = newSquad.find((s) => s.slotIndex === slotIndex);
    const penalty =
      slot && player
        ? getPlacementPenalty(player.position, slot.position, player)
        : 0;
    newSquad = signPlayerToSlot(newSquad, player, slotIndex, penalty);
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
