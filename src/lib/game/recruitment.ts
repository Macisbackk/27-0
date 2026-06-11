import seedrandom from "seedrandom";
import {
  CURRENT_PLAYERS,
  HISTORIC_PLAYERS,
  LEGEND_PLAYERS,
  getPlayerById,
  getPlayersByClub,
  isAvailableInGame,
} from "../players";
import type { Player, PlayerCategory, Position, SquadSlot } from "../types";
import { SQUAD_STRUCTURE, TOTAL_SLOTS, createEmptySquad } from "../positions";
import {
  getRemainingPositionCounts,
  getDraftBalanceGroup,
  getDraftCandidatePositions,
  isHalfbackPosition,
  positionsInSameDraftGroup,
} from "./draft-positions";

export interface RecruitmentOptions {
  hardMode?: boolean;
  /** Challenge Cup — only offer players from this club. */
  clubFilter?: string;
}

const CURRENT_RATIO = 0.8;
const LEGEND_WITHIN_HISTORIC = 0.35;
const MIN_HISTORIC_OFFERS = 2;
const MIN_LEGEND_OFFERS = 1;
const MIN_ELITE_RATING_OFFERS = 1;
const ELITE_RATING_THRESHOLD = 90;
const TYPICAL_PAIR_RATING_GAP = 6;
const EXTREME_PAIR_RATING_GAP = 10;
const EXTREME_PAIR_CHANCE = 0.06;
const DRAFT_SAME_POSITION_MAX_CHANCE = 0.12;
const DRAFT_RECENT_POSITION_DECAY = 0.4;
const DRAFT_NEED_MULTIPLIER = 3;
const DRAFT_CENTRE_RECENT_DECAY = 0.5;

type RatingBand = "b75_79" | "b80_84" | "b85_89" | "b90_94" | "b95_99";

const NORMAL_BAND_WEIGHTS: Record<RatingBand, number> = {
  b75_79: 0.15,
  b80_84: 0.35,
  b85_89: 0.3,
  b90_94: 0.15,
  b95_99: 0.05,
};

const CUP_BAND_WEIGHTS: Record<RatingBand, number> = {
  b75_79: 0.08,
  b80_84: 0.22,
  b85_89: 0.35,
  b90_94: 0.25,
  b95_99: 0.1,
};

const CUP_CURRENT_RATIO = 0.28;
const CUP_HISTORIC_RATIO = 0.42;
const CUP_LEGEND_RATIO = 0.3;

function getRatingBand(rating: number): RatingBand {
  if (rating >= 95) return "b95_99";
  if (rating >= 90) return "b90_94";
  if (rating >= 85) return "b85_89";
  if (rating >= 80) return "b80_84";
  return "b75_79";
}

function rollBand(
  rng: () => number,
  weights: Record<RatingBand, number>
): RatingBand {
  const roll = rng();
  let cumulative = 0;
  for (const band of Object.keys(weights) as RatingBand[]) {
    cumulative += weights[band];
    if (roll < cumulative) return band;
  }
  return "b80_84";
}

function playersInBand(players: Player[], band: RatingBand): Player[] {
  return players.filter((p) => getRatingBand(p.peakRating) === band);
}

function pickFromBandWithFallback(
  candidates: Player[],
  band: RatingBand,
  rng: () => number
): Player | null {
  if (candidates.length === 0) return null;

  const fallbackOrder: RatingBand[] = [
    band,
    "b80_84",
    "b85_89",
    "b75_79",
    "b90_94",
    "b95_99",
  ];
  const seen = new Set<RatingBand>();

  for (const b of fallbackOrder) {
    if (seen.has(b)) continue;
    seen.add(b);
    const inBand = playersInBand(candidates, b);
    if (inBand.length > 0) {
      return inBand[Math.floor(rng() * inBand.length)];
    }
  }

  return candidates[Math.floor(rng() * candidates.length)];
}

export interface RecruitmentRound {
  roundIndex: number;
  slotIndex: number;
  position: Position;
  slotLabel: string;
  optionA: string;
  optionB: string;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function recruitable(players: Player[]): Player[] {
  return players.filter(isAvailableInGame);
}

function basePlayerPool(options?: RecruitmentOptions): Player[] {
  if (options?.clubFilter) {
    return recruitable(getPlayersByClub(options.clubFilter));
  }
  return recruitable([
    ...CURRENT_PLAYERS,
    ...HISTORIC_PLAYERS,
    ...LEGEND_PLAYERS,
  ]);
}

function selectCategoryPool(rng: () => number, options?: RecruitmentOptions): Player[] {
  if (options?.clubFilter) {
    const clubPlayers = getPlayersByClub(options.clubFilter);
    const legends = clubPlayers.filter((p) => p.category === "legend");
    const historic = clubPlayers.filter((p) => p.category === "historic");
    const current = clubPlayers.filter((p) => p.category === "current");
    const roll = rng();
    if (roll < CUP_CURRENT_RATIO && current.length > 0) return current;
    if (roll < CUP_CURRENT_RATIO + CUP_HISTORIC_RATIO && historic.length > 0) {
      return historic;
    }
    if (legends.length > 0) return legends;
    if (historic.length > 0) return historic;
    if (current.length > 0) return current;
    return clubPlayers;
  }
  const current = recruitable(CURRENT_PLAYERS);
  const historic = recruitable(HISTORIC_PLAYERS);
  const legends = recruitable(LEGEND_PLAYERS);
  if (rng() < CURRENT_RATIO && current.length > 0) return current;
  if (rng() < LEGEND_WITHIN_HISTORIC && legends.length > 0) {
    return legends;
  }
  return historic;
}

function playersForCategory(
  category: PlayerCategory,
  options?: RecruitmentOptions
): Player[] {
  const pool = basePlayerPool(options);
  return pool.filter((p) => p.category === category);
}

function pickBalancedPair(
  candidates: Player[],
  rng: () => number,
  options?: RecruitmentOptions
): [Player, Player] | null {
  if (candidates.length < 2) return null;

  const allowExtreme = rng() < EXTREME_PAIR_CHANCE;
  const maxGap = allowExtreme ? EXTREME_PAIR_RATING_GAP : TYPICAL_PAIR_RATING_GAP;
  const weights = options?.clubFilter ? CUP_BAND_WEIGHTS : NORMAL_BAND_WEIGHTS;
  const targetBand = rollBand(rng, weights);
  const anchor = pickFromBandWithFallback(candidates, targetBand, rng);
  if (!anchor) return null;

  let partners = candidates.filter(
    (p) =>
      p.id !== anchor.id &&
      Math.abs(p.peakRating - anchor.peakRating) <= maxGap
  );

  if (!allowExtreme && anchor.peakRating >= ELITE_RATING_THRESHOLD) {
    partners = partners.filter(
      (p) => p.peakRating >= anchor.peakRating - 8
    );
  }

  if (partners.length === 0) {
    partners = candidates.filter((p) => p.id !== anchor.id);
    partners.sort(
      (a, b) =>
        Math.abs(a.peakRating - anchor.peakRating) -
        Math.abs(b.peakRating - anchor.peakRating)
    );
    partners = partners.slice(0, Math.min(6, partners.length));
  }

  if (partners.length === 0) return null;

  const partner = partners[Math.floor(rng() * partners.length)];
  return [anchor, partner];
}

function sortCandidatesExactFirst(
  candidates: Player[],
  slotPosition: Position
): void {
  candidates.sort((a, b) => {
    const aExact = a.position === slotPosition ? 0 : 1;
    const bExact = b.position === slotPosition ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return b.peakRating - a.peakRating;
  });
}

function playersMatchingSlotPosition(
  position: Position,
  usedIds: Set<string>,
  options?: RecruitmentOptions
): Player[] {
  const targetPositions = getDraftCandidatePositions(position);
  return basePlayerPool(options).filter(
    (player) =>
      targetPositions.includes(player.position) && !usedIds.has(player.id)
  );
}

function pickPairForPosition(
  position: Position,
  rng: () => number,
  usedIds: Set<string>,
  categoryFilter?: PlayerCategory,
  options?: RecruitmentOptions
): [string, string] | null {
  const targetPositions = getDraftCandidatePositions(position);
  const allForPosition = playersMatchingSlotPosition(
    position,
    usedIds,
    options
  );

  if (allForPosition.length < 2) return null;

  let primaryPool = allForPosition;
  if (categoryFilter) {
    const filtered = playersForCategory(categoryFilter, options).filter(
      (player) =>
        targetPositions.includes(player.position) && !usedIds.has(player.id)
    );
    if (filtered.length >= 2) {
      primaryPool = filtered;
    } else if (filtered.length === 1) {
      sortCandidatesExactFirst(allForPosition, position);
      const partner = allForPosition.find((p) => p.id !== filtered[0].id);
      if (partner) return [filtered[0].id, partner.id];
      return null;
    } else {
      return null;
    }
  } else {
    const categoryPool = selectCategoryPool(rng, options).filter(
      (player) =>
        targetPositions.includes(player.position) && !usedIds.has(player.id)
    );
    if (categoryPool.length >= 2) primaryPool = categoryPool;
  }

  if (isHalfbackPosition(position)) {
    sortCandidatesExactFirst(primaryPool, position);
  } else {
    const exact = primaryPool.filter((player) => player.position === position);
    if (exact.length >= 2) primaryPool = exact;
  }

  const pair = pickBalancedPair(primaryPool, rng, options);
  if (!pair) return null;
  return [pair[0].id, pair[1].id];
}

function roundHasCategory(
  round: RecruitmentRound,
  category: PlayerCategory
): boolean {
  const a = getPlayerById(round.optionA);
  const b = getPlayerById(round.optionB);
  return a?.category === category || b?.category === category;
}

function countRoundsWithCategory(
  offers: Map<number, RecruitmentRound>,
  category: PlayerCategory
): number {
  let count = 0;
  for (const round of offers.values()) {
    if (roundHasCategory(round, category)) count++;
  }
  return count;
}

function roundHasEliteRating(
  round: RecruitmentRound,
  minRating: number
): boolean {
  const a = getPlayerById(round.optionA);
  const b = getPlayerById(round.optionB);
  return (
    (a?.peakRating ?? 0) >= minRating || (b?.peakRating ?? 0) >= minRating
  );
}

function countEliteRatingOffers(
  offers: Map<number, RecruitmentRound>,
  minRating: number
): number {
  let count = 0;
  for (const round of offers.values()) {
    if (roundHasEliteRating(round, minRating)) count++;
  }
  return count;
}

function pickPairWithEliteRating(
  position: Position,
  rng: () => number,
  usedIds: Set<string>,
  minRating: number,
  options?: RecruitmentOptions
): [string, string] | null {
  const allForPosition = playersMatchingSlotPosition(
    position,
    usedIds,
    options
  );

  const elite = allForPosition.filter((p) => p.peakRating >= minRating);
  sortCandidatesExactFirst(elite, position);
  if (elite.length === 0 || allForPosition.length < 2) return null;

  const star = elite[Math.floor(rng() * elite.length)];
  let partners = allForPosition.filter(
    (p) =>
      p.id !== star.id &&
      Math.abs(p.peakRating - star.peakRating) <= TYPICAL_PAIR_RATING_GAP &&
      p.peakRating >= star.peakRating - 8
  );
  if (partners.length === 0) {
    partners = allForPosition.filter((p) => p.id !== star.id);
    partners.sort(
      (a, b) =>
        Math.abs(a.peakRating - star.peakRating) -
        Math.abs(b.peakRating - star.peakRating)
    );
    partners = partners.slice(0, Math.min(5, partners.length));
  }
  if (partners.length === 0) return null;

  const partner = partners[Math.floor(rng() * partners.length)];
  return [star.id, partner.id];
}

function applyCategoryGuarantees(
  offers: Map<number, RecruitmentRound>,
  rng: () => number,
  lockedPlayerIds: Set<string>,
  options?: RecruitmentOptions
): void {
  const slots = shuffle(Array.from(offers.keys()), rng);

  const ensureMinimum = (
    category: PlayerCategory,
    minimum: number,
    slotPool: number[]
  ) => {
    let count = countRoundsWithCategory(offers, category);
    for (const slotIndex of slotPool) {
      if (count >= minimum) break;
      const round = offers.get(slotIndex);
      if (!round || roundHasCategory(round, category)) continue;

      const usedIds = new Set<string>(lockedPlayerIds);
      for (const [idx, offer] of offers) {
        if (idx === slotIndex) continue;
        usedIds.add(offer.optionA);
        usedIds.add(offer.optionB);
      }

      const pair = pickPairForPosition(
        round.position,
        rng,
        usedIds,
        category,
        options
      );
      if (pair) {
        offers.set(slotIndex, { ...round, optionA: pair[0], optionB: pair[1] });
        count++;
      }
    }
  };

  ensureMinimum("historic", MIN_HISTORIC_OFFERS, slots);
  ensureMinimum("legend", MIN_LEGEND_OFFERS, slots);

  let eliteCount = countEliteRatingOffers(offers, ELITE_RATING_THRESHOLD);
  for (const slotIndex of slots) {
    if (eliteCount >= MIN_ELITE_RATING_OFFERS) break;
    const round = offers.get(slotIndex);
    if (!round || roundHasEliteRating(round, ELITE_RATING_THRESHOLD)) continue;

    const usedIds = new Set<string>(lockedPlayerIds);
    for (const [idx, offer] of offers) {
      if (idx === slotIndex) continue;
      usedIds.add(offer.optionA);
      usedIds.add(offer.optionB);
    }

    const pair = pickPairWithEliteRating(
      round.position,
      rng,
      usedIds,
      ELITE_RATING_THRESHOLD,
      options
    );
    if (pair) {
      offers.set(slotIndex, { ...round, optionA: pair[0], optionB: pair[1] });
      eliteCount++;
    }
  }
}

export function generateSlotOffers(
  seed: string,
  skipSlots: number[] = [],
  lockedPlayerIds: string[] = [],
  options?: RecruitmentOptions
): Map<number, RecruitmentRound> {
  const rng = seedrandom(`${seed}-offers`);
  const squad = createEmptySquad();
  const offers = new Map<number, RecruitmentRound>();
  const locked = new Set(lockedPlayerIds);

  for (const slot of squad) {
    if (skipSlots.includes(slot.slotIndex)) continue;

    const usedIds = new Set(locked);
    for (const offer of offers.values()) {
      usedIds.add(offer.optionA);
      usedIds.add(offer.optionB);
    }

    const pair = pickPairForPosition(
      slot.position,
      rng,
      usedIds,
      undefined,
      options
    );
    if (!pair) continue;

    offers.set(slot.slotIndex, {
      roundIndex: offers.size,
      slotIndex: slot.slotIndex,
      position: slot.position,
      slotLabel: slot.label,
      optionA: pair[0],
      optionB: pair[1],
    });
  }

  if (!options?.clubFilter) {
    applyCategoryGuarantees(offers, rng, locked, options);
  }

  return offers;
}

export function getOfferForSlot(
  offers: Map<number, RecruitmentRound>,
  slotIndex: number
): RecruitmentRound | null {
  return offers.get(slotIndex) ?? null;
}

export function collectUsedPlayerIds(
  offers: Map<number, RecruitmentRound>,
  signedIds: string[],
  excludeSlot?: number
): Set<string> {
  const used = new Set(signedIds);
  for (const [idx, offer] of offers) {
    if (idx === excludeSlot) continue;
    used.add(offer.optionA);
    used.add(offer.optionB);
  }
  return used;
}

export function rerollSlotOffer(
  seed: string,
  slotIndex: number,
  currentRound: RecruitmentRound,
  usedIds: Set<string>,
  discardedIds: Set<string>,
  options?: RecruitmentOptions
): RecruitmentRound | null {
  const rng = seedrandom(`${seed}-reroll-${slotIndex}-${discardedIds.size}`);
  const blocked = new Set([...usedIds, ...discardedIds]);

  const pair = pickPairForPosition(
    currentRound.position,
    rng,
    blocked,
    undefined,
    options
  );
  if (!pair) return null;

  return {
    ...currentRound,
    optionA: pair[0],
    optionB: pair[1],
  };
}

function draftCandidatePositions(position: Position): Position[] {
  return getDraftCandidatePositions(position);
}

function positionHasAvailablePlayers(
  position: Position,
  usedIds: Set<string>,
  options?: RecruitmentOptions
): boolean {
  const targets = draftCandidatePositions(position);
  return basePlayerPool(options).some(
    (player) =>
      targets.includes(player.position) && !usedIds.has(player.id)
  );
}

function pickWeightedDraftPosition(
  rng: () => number,
  remaining: Map<Position, number>,
  recentPositions: Position[],
  usedIds: Set<string>,
  options?: RecruitmentOptions,
  exclude?: Position
): Position | null {
  const excludeGroup = exclude ? getDraftBalanceGroup(exclude) : null;

  let candidates = Array.from(remaining.entries()).filter(
    ([position, count]) =>
      count > 0 &&
      position !== exclude &&
      (excludeGroup === null ||
        getDraftBalanceGroup(position) !== excludeGroup) &&
      positionHasAvailablePlayers(position, usedIds, options)
  );

  if (candidates.length === 0) {
    candidates = SQUAD_STRUCTURE.map(
      ({ position }) => [position, 1] as [Position, number]
    ).filter(
      ([position]) =>
        position !== exclude &&
        (excludeGroup === null ||
          getDraftBalanceGroup(position) !== excludeGroup) &&
        positionHasAvailablePlayers(position, usedIds, options)
    );
  }

  if (candidates.length === 0) return null;

  candidates = shuffle(candidates, rng);

  const groupNeeds = new Map<string, number>();
  for (const [position, count] of candidates) {
    const group = getDraftBalanceGroup(position);
    groupNeeds.set(group, (groupNeeds.get(group) ?? 0) + count);
  }

  const recentGroupCounts = new Map<string, number>();
  for (const position of recentPositions) {
    const group = getDraftBalanceGroup(position);
    recentGroupCounts.set(group, (recentGroupCounts.get(group) ?? 0) + 1);
  }

  const weights = candidates.map(([position, need]) => {
    const group = getDraftBalanceGroup(position);
    const groupNeed = groupNeeds.get(group) ?? need;
    const positionsInGroup = candidates.filter(
      ([candidate]) => getDraftBalanceGroup(candidate) === group
    ).length;
    const distributedNeed = groupNeed / Math.max(positionsInGroup, 1);
    const recent = recentGroupCounts.get(group) ?? 0;
    const centrePenalty = position === "CENTRE" ? DRAFT_CENTRE_RECENT_DECAY : 1;
    return (
      Math.max(distributedNeed, 1) *
      DRAFT_NEED_MULTIPLIER *
      centrePenalty *
      Math.pow(DRAFT_RECENT_POSITION_DECAY, recent)
    );
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;

  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i][0];
  }

  return candidates[candidates.length - 1][0];
}

function pickSinglePlayerForPosition(
  position: Position,
  rng: () => number,
  usedIds: Set<string>,
  anchorRating?: number,
  options?: RecruitmentOptions
): Player | null {
  let pool = basePlayerPool(options).filter(
    (player) => player.position === position && !usedIds.has(player.id)
  );
  if (pool.length === 0) return null;

  const categoryPool = selectCategoryPool(rng, options).filter(
    (player) => player.position === position && !usedIds.has(player.id)
  );
  if (categoryPool.length > 0) pool = categoryPool;

  if (anchorRating !== undefined) {
    const close = pool.filter(
      (player) =>
        Math.abs(player.peakRating - anchorRating) <= TYPICAL_PAIR_RATING_GAP
    );
    if (close.length > 0) pool = close;
  }

  const weights = options?.clubFilter ? CUP_BAND_WEIGHTS : NORMAL_BAND_WEIGHTS;
  const band = rollBand(rng, weights);
  return pickFromBandWithFallback(pool, band, rng);
}

function pickFromDraftPool(
  candidates: Player[],
  slotPosition: Position,
  rng: () => number,
  usedIds: Set<string>,
  anchorRating: number | undefined,
  options?: RecruitmentOptions
): Player | null {
  if (candidates.length === 0) return null;

  let pool = candidates;
  const targetPositions = draftCandidatePositions(slotPosition);
  const categoryPool = selectCategoryPool(rng, options).filter(
    (player) =>
      targetPositions.includes(player.position) &&
      !usedIds.has(player.id) &&
      candidates.some((candidate) => candidate.id === player.id)
  );
  if (categoryPool.length > 0) pool = categoryPool;

  if (anchorRating !== undefined) {
    const close = pool.filter(
      (player) =>
        Math.abs(player.peakRating - anchorRating) <= TYPICAL_PAIR_RATING_GAP
    );
    if (close.length > 0) pool = close;
  }

  pool.sort((a, b) => {
    const aExact = a.position === slotPosition ? 0 : 1;
    const bExact = b.position === slotPosition ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return b.peakRating - a.peakRating;
  });

  const weights = options?.clubFilter ? CUP_BAND_WEIGHTS : NORMAL_BAND_WEIGHTS;
  const band = rollBand(rng, weights);
  return pickFromBandWithFallback(pool, band, rng);
}

/** Draft pick — halfbacks share one candidate pool (SO + SH). */
function pickSinglePlayerForDraftPosition(
  slotPosition: Position,
  rng: () => number,
  usedIds: Set<string>,
  anchorRating?: number,
  options?: RecruitmentOptions
): Player | null {
  const targetPositions = draftCandidatePositions(slotPosition);
  const pool = basePlayerPool(options).filter(
    (player) =>
      targetPositions.includes(player.position) && !usedIds.has(player.id)
  );
  if (pool.length === 0) return null;

  if (isHalfbackPosition(slotPosition)) {
    return pickFromDraftPool(
      pool,
      slotPosition,
      rng,
      usedIds,
      anchorRating,
      options
    );
  }

  const exact = pool.filter((player) => player.position === slotPosition);
  const compatible = pool.filter((player) => player.position !== slotPosition);

  return (
    pickFromDraftPool(exact, slotPosition, rng, usedIds, anchorRating, options) ??
    pickFromDraftPool(
      compatible,
      slotPosition,
      rng,
      usedIds,
      anchorRating,
      options
    )
  );
}

function pickDraftBalancedPair(
  rng: () => number,
  usedIds: Set<string>,
  squad: SquadSlot[],
  recentPositions: Position[],
  options?: RecruitmentOptions
): [string, string] | null {
  let remaining = getRemainingPositionCounts(squad);
  if (remaining.size === 0) {
    remaining = new Map(
      SQUAD_STRUCTURE.map(({ position, count }) => [position, count])
    );
  }

  const posA = pickWeightedDraftPosition(
    rng,
    remaining,
    recentPositions,
    usedIds,
    options
  );
  if (!posA) return pickPairAny(rng, usedIds, options);

  const allowSamePosition = rng() < DRAFT_SAME_POSITION_MAX_CHANCE;
  const posB = allowSamePosition
    ? pickWeightedDraftPosition(
        rng,
        remaining,
        recentPositions,
        usedIds,
        options
      )
    : pickWeightedDraftPosition(
        rng,
        remaining,
        recentPositions,
        usedIds,
        options,
        posA
      ) ??
      pickWeightedDraftPosition(
        rng,
        remaining,
        recentPositions,
        usedIds,
        options
      );

  const playerA = pickSinglePlayerForDraftPosition(
    posA,
    rng,
    usedIds,
    undefined,
    options
  );
  if (!playerA) return pickPairAny(rng, usedIds, options);

  const usedWithA = new Set(usedIds);
  usedWithA.add(playerA.id);

  let playerB =
    posB !== null
      ? pickSinglePlayerForDraftPosition(
          posB,
          rng,
          usedWithA,
          playerA.peakRating,
          options
        )
      : null;

  if (!playerB) {
    const fallbackPositions = shuffle(
      Array.from(remaining.keys()).filter(
        (position) =>
          position !== posA &&
          !positionsInSameDraftGroup(position, posA) &&
          positionHasAvailablePlayers(position, usedWithA, options)
      ),
      rng
    );
    for (const position of fallbackPositions) {
      playerB = pickSinglePlayerForDraftPosition(
        position,
        rng,
        usedWithA,
        playerA.peakRating,
        options
      );
      if (playerB) break;
    }
  }

  if (!playerB) {
    playerB = pickSinglePlayerForDraftPosition(
      posA,
      rng,
      usedWithA,
      playerA.peakRating,
      options
    );
  }

  if (!playerB || playerA.id === playerB.id) {
    return pickPairAny(rng, usedIds, options);
  }

  return rng() < 0.5
    ? [playerA.id, playerB.id]
    : [playerB.id, playerA.id];
}

function pickPairAny(
  rng: () => number,
  usedIds: Set<string>,
  options?: RecruitmentOptions
): [string, string] | null {
  const pool = basePlayerPool(options).filter((p) => !usedIds.has(p.id));
  if (pool.length < 2) return null;

  let primaryPool = pool;
  const categoryPool = selectCategoryPool(rng, options).filter(
    (p) => !usedIds.has(p.id)
  );
  if (categoryPool.length >= 2) primaryPool = categoryPool;

  const pair = pickBalancedPair(primaryPool, rng, options);
  if (!pair) return null;
  return [pair[0].id, pair[1].id];
}

function pickPairForCategory(
  rng: () => number,
  usedIds: Set<string>,
  category: PlayerCategory,
  options?: RecruitmentOptions
): [string, string] | null {
  const filtered = playersForCategory(category, options).filter(
    (p) => !usedIds.has(p.id)
  );
  if (filtered.length < 2) return null;
  const pair = pickBalancedPair(filtered, rng, options);
  if (!pair) return null;
  return [pair[0].id, pair[1].id];
}

function applyDraftGuarantees(
  offers: Map<number, RecruitmentRound>,
  rng: () => number,
  lockedPlayerIds: Set<string>,
  options?: RecruitmentOptions
): void {
  const picks = shuffle(Array.from(offers.keys()), rng);

  const ensureMinimum = (
    category: PlayerCategory,
    minimum: number,
    pickPool: number[]
  ) => {
    let count = countRoundsWithCategory(offers, category);
    for (const pickIndex of pickPool) {
      if (count >= minimum) break;
      const round = offers.get(pickIndex);
      if (!round || roundHasCategory(round, category)) continue;

      const usedIds = new Set<string>(lockedPlayerIds);
      for (const [idx, offer] of offers) {
        if (idx === pickIndex) continue;
        usedIds.add(offer.optionA);
        usedIds.add(offer.optionB);
      }

      const pair = pickPairForCategory(rng, usedIds, category, options);
      if (pair) {
        offers.set(pickIndex, { ...round, optionA: pair[0], optionB: pair[1] });
        count++;
      }
    }
  };

  ensureMinimum("historic", MIN_HISTORIC_OFFERS, picks);
  ensureMinimum("legend", MIN_LEGEND_OFFERS, picks);

  let eliteCount = countEliteRatingOffers(offers, ELITE_RATING_THRESHOLD);
  for (const pickIndex of picks) {
    if (eliteCount >= MIN_ELITE_RATING_OFFERS) break;
    const round = offers.get(pickIndex);
    if (!round || roundHasEliteRating(round, ELITE_RATING_THRESHOLD)) continue;

    const usedIds = new Set<string>(lockedPlayerIds);
    for (const [idx, offer] of offers) {
      if (idx === pickIndex) continue;
      usedIds.add(offer.optionA);
      usedIds.add(offer.optionB);
    }

    const pool = basePlayerPool(options).filter(
      (p) => !usedIds.has(p.id) && p.peakRating >= ELITE_RATING_THRESHOLD
    );
    if (pool.length === 0) continue;
    const star = pool[Math.floor(rng() * pool.length)];
    const partners = basePlayerPool(options).filter(
      (p) =>
        !usedIds.has(p.id) &&
        p.id !== star.id &&
        Math.abs(p.peakRating - star.peakRating) <= TYPICAL_PAIR_RATING_GAP
    );
    if (partners.length === 0) continue;
    const partner = partners[Math.floor(rng() * partners.length)];
    offers.set(pickIndex, {
      ...round,
      optionA: star.id,
      optionB: partner.id,
    });
    eliteCount++;
  }
}

export function collectRecentDraftPositions(
  offers: Map<number, RecruitmentRound>,
  beforePickIndex: number,
  limit = 6
): Position[] {
  const recent: Position[] = [];
  for (
    let pickIndex = beforePickIndex - 1;
    pickIndex >= 0 && recent.length < limit * 2;
    pickIndex--
  ) {
    const round = offers.get(pickIndex);
    if (!round) continue;
    const playerA = getPlayerById(round.optionA);
    const playerB = getPlayerById(round.optionB);
    if (playerA) recent.push(playerA.position);
    if (playerB) recent.push(playerB.position);
  }
  return recent.slice(0, limit);
}

/** Draft offer for a specific empty slot — halfbacks share one candidate pool. */
export function generateDraftOfferForSlot(
  seed: string,
  slotIndex: number,
  squad: SquadSlot[],
  signedPlayerIds: string[],
  lockedPlayerIds: string[] = [],
  options?: RecruitmentOptions
): RecruitmentRound | null {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot || slot.player) return null;

  const rng = seedrandom(
    `${seed}-draft-slot-${slotIndex}-${signedPlayerIds.length}`
  );
  const usedIds = new Set([...signedPlayerIds, ...lockedPlayerIds]);

  const playerA = pickSinglePlayerForDraftPosition(
    slot.position,
    rng,
    usedIds,
    undefined,
    options
  );
  if (!playerA) return null;

  const usedWithA = new Set(usedIds);
  usedWithA.add(playerA.id);

  const playerB = pickSinglePlayerForDraftPosition(
    slot.position,
    rng,
    usedWithA,
    playerA.peakRating,
    options
  );
  if (!playerB || playerA.id === playerB.id) return null;

  const [optionA, optionB] =
    rng() < 0.5
      ? [playerA.id, playerB.id]
      : [playerB.id, playerA.id];

  return {
    roundIndex: slotIndex,
    slotIndex,
    position: slot.position,
    slotLabel: slot.label,
    optionA,
    optionB,
  };
}

/** Balanced draft offer for a single pick using current squad needs. */
export function generateDraftOfferForPick(
  seed: string,
  pickIndex: number,
  squad: SquadSlot[],
  signedPlayerIds: string[],
  lockedPlayerIds: string[] = [],
  recentPositions: Position[] = [],
  options?: RecruitmentOptions
): RecruitmentRound | null {
  const rng = seedrandom(`${seed}-draft-offer-${pickIndex}`);
  const usedIds = new Set([...signedPlayerIds, ...lockedPlayerIds]);
  const pair =
    pickDraftBalancedPair(
      rng,
      usedIds,
      squad,
      recentPositions,
      options
    ) ?? pickPairAny(rng, usedIds, options);
  if (!pair) return null;

  const playerA = getPlayerById(pair[0]);
  return {
    roundIndex: pickIndex,
    slotIndex: -1,
    position: playerA?.position ?? "CENTRE",
    slotLabel: `Pick ${pickIndex + 1}`,
    optionA: pair[0],
    optionB: pair[1],
  };
}

export function rerollDraftOfferForSlot(
  seed: string,
  slotIndex: number,
  currentRound: RecruitmentRound,
  squad: SquadSlot[],
  usedIds: Set<string>,
  discardedIds: Set<string>,
  options?: RecruitmentOptions
): RecruitmentRound | null {
  const rng = seedrandom(
    `${seed}-draft-slot-reroll-${slotIndex}-${discardedIds.size}`
  );
  const blocked = new Set([...usedIds, ...discardedIds]);
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot) return null;

  const playerA = pickSinglePlayerForDraftPosition(
    slot.position,
    rng,
    blocked,
    undefined,
    options
  );
  if (!playerA) return null;

  const blockedWithA = new Set(blocked);
  blockedWithA.add(playerA.id);

  const playerB = pickSinglePlayerForDraftPosition(
    slot.position,
    rng,
    blockedWithA,
    playerA.peakRating,
    options
  );
  if (!playerB || playerA.id === playerB.id) return null;

  const [optionA, optionB] =
    rng() < 0.5
      ? [playerA.id, playerB.id]
      : [playerB.id, playerA.id];

  return {
    ...currentRound,
    optionA,
    optionB,
  };
}

export function rerollDraftOffer(
  seed: string,
  pickIndex: number,
  currentRound: RecruitmentRound,
  squad: SquadSlot[],
  usedIds: Set<string>,
  discardedIds: Set<string>,
  recentPositions: Position[],
  options?: RecruitmentOptions
): RecruitmentRound | null {
  const rng = seedrandom(
    `${seed}-draft-reroll-${pickIndex}-${discardedIds.size}`
  );
  const blocked = new Set([...usedIds, ...discardedIds]);
  const pair = pickDraftBalancedPair(
    rng,
    blocked,
    squad,
    recentPositions,
    options
  );
  if (!pair) return null;

  const playerA = getPlayerById(pair[0]);
  return {
    ...currentRound,
    position: playerA?.position ?? currentRound.position,
    optionA: pair[0],
    optionB: pair[1],
  };
}

/** @deprecated Draft offers are generated lazily per pick — returns an empty map. */
export function generateDraftOffers(
  _seed: string,
  _pickCount: number,
  _lockedPlayerIds: string[] = [],
  _options?: RecruitmentOptions
): Map<number, RecruitmentRound> {
  return new Map();
}

export function getOfferForPick(
  offers: Map<number, RecruitmentRound>,
  pickIndex: number
): RecruitmentRound | null {
  return offers.get(pickIndex) ?? null;
}

export function getRoundPlayers(round: RecruitmentRound): [Player, Player] {
  const a = getPlayerById(round.optionA);
  const b = getPlayerById(round.optionB);
  if (!a || !b) throw new Error("Invalid recruitment round");
  return [a, b];
}

export function autofillFromOffers(
  seed: string,
  offers: Map<number, RecruitmentRound>,
  skipSlots: number[] = []
): Map<number, string> {
  const rng = seedrandom(`${seed}-autofill`);
  const choices = new Map<number, string>();
  const used = new Set<string>();

  const slots = shuffle(Array.from(offers.keys()), rng).filter(
    (s) => !skipSlots.includes(s)
  );

  for (const slotIndex of slots) {
    const offer = offers.get(slotIndex);
    if (!offer) continue;
    const pick =
      !used.has(offer.optionA) && used.has(offer.optionB)
        ? offer.optionA
        : !used.has(offer.optionB) && used.has(offer.optionA)
          ? offer.optionB
          : rng() < 0.5
            ? offer.optionA
            : offer.optionB;

    if (!used.has(pick)) {
      choices.set(slotIndex, pick);
      used.add(pick);
    } else if (!used.has(offer.optionA)) {
      choices.set(slotIndex, offer.optionA);
      used.add(offer.optionA);
    } else if (!used.has(offer.optionB)) {
      choices.set(slotIndex, offer.optionB);
      used.add(offer.optionB);
    }
  }

  return choices;
}
