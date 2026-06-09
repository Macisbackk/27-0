import seedrandom from "seedrandom";
import {
  CURRENT_PLAYERS,
  HISTORIC_PLAYERS,
  LEGEND_PLAYERS,
  getPlayerById,
  getPlayersByClub,
} from "../players";
import type { Player, PlayerCategory, Position } from "../types";
import { TOTAL_SLOTS, createEmptySquad } from "../positions";

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
const EXTREME_PAIR_RATING_GAP = 12;
const EXTREME_PAIR_CHANCE = 0.08;

type RatingTier = "elite" | "strong" | "mid" | "lower" | "weak";

const TIER_WEIGHTS: Record<RatingTier, number> = {
  elite: 0.12,
  strong: 0.22,
  mid: 0.46,
  lower: 0.17,
  weak: 0.03,
};

function getRatingTier(rating: number): RatingTier {
  if (rating >= 90) return "elite";
  if (rating >= 85) return "strong";
  if (rating >= 78) return "mid";
  if (rating >= 70) return "lower";
  return "weak";
}

function rollTier(rng: () => number): RatingTier {
  const roll = rng();
  let cumulative = 0;
  for (const tier of Object.keys(TIER_WEIGHTS) as RatingTier[]) {
    cumulative += TIER_WEIGHTS[tier];
    if (roll < cumulative) return tier;
  }
  return "mid";
}

function playersInTier(players: Player[], tier: RatingTier): Player[] {
  return players.filter((p) => getRatingTier(p.peakRating) === tier);
}

function pickFromTierWithFallback(
  candidates: Player[],
  tier: RatingTier,
  rng: () => number
): Player | null {
  if (candidates.length === 0) return null;

  const fallbackOrder: RatingTier[] = [
    tier,
    "mid",
    "strong",
    "lower",
    "elite",
    "weak",
  ];
  const seen = new Set<RatingTier>();

  for (const t of fallbackOrder) {
    if (seen.has(t)) continue;
    seen.add(t);
    const inTier = playersInTier(candidates, t);
    if (inTier.length > 0) {
      return inTier[Math.floor(rng() * inTier.length)];
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

function basePlayerPool(options?: RecruitmentOptions): Player[] {
  if (options?.clubFilter) {
    return getPlayersByClub(options.clubFilter);
  }
  return [...CURRENT_PLAYERS, ...HISTORIC_PLAYERS, ...LEGEND_PLAYERS];
}

const CUP_CATEGORY_THIRD = 1 / 3;

function selectCategoryPool(rng: () => number, options?: RecruitmentOptions): Player[] {
  if (options?.clubFilter) {
    const clubPlayers = getPlayersByClub(options.clubFilter);
    const legends = clubPlayers.filter((p) => p.category === "legend");
    const historic = clubPlayers.filter((p) => p.category === "historic");
    const current = clubPlayers.filter((p) => p.category === "current");
    const roll = rng();
    if (roll < CUP_CATEGORY_THIRD && current.length > 0) return current;
    if (roll < CUP_CATEGORY_THIRD * 2 && historic.length > 0) return historic;
    if (legends.length > 0) return legends;
    if (historic.length > 0) return historic;
    if (current.length > 0) return current;
    return clubPlayers;
  }
  if (rng() < CURRENT_RATIO) return CURRENT_PLAYERS;
  if (rng() < LEGEND_WITHIN_HISTORIC && LEGEND_PLAYERS.length > 0) {
    return LEGEND_PLAYERS;
  }
  return HISTORIC_PLAYERS;
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
  rng: () => number
): [Player, Player] | null {
  if (candidates.length < 2) return null;

  const allowExtreme = rng() < EXTREME_PAIR_CHANCE;
  const maxGap = allowExtreme ? EXTREME_PAIR_RATING_GAP : TYPICAL_PAIR_RATING_GAP;
  const targetTier = rollTier(rng);
  const anchor = pickFromTierWithFallback(candidates, targetTier, rng);
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

function pickPairForPosition(
  position: Position,
  rng: () => number,
  usedIds: Set<string>,
  categoryFilter?: PlayerCategory,
  options?: RecruitmentOptions
): [string, string] | null {
  const allForPosition = basePlayerPool(options).filter(
    (p) => p.position === position && !usedIds.has(p.id)
  );

  if (allForPosition.length < 2) return null;

  let primaryPool = allForPosition;
  if (categoryFilter) {
    const filtered = playersForCategory(categoryFilter, options).filter(
      (p) => p.position === position && !usedIds.has(p.id)
    );
    if (filtered.length >= 2) {
      primaryPool = filtered;
    } else if (filtered.length === 1) {
      const partner = allForPosition.find((p) => p.id !== filtered[0].id);
      if (partner) return [filtered[0].id, partner.id];
      return null;
    } else {
      return null;
    }
  } else {
    const categoryPool = selectCategoryPool(rng, options).filter(
      (p) => p.position === position && !usedIds.has(p.id)
    );
    if (categoryPool.length >= 2) primaryPool = categoryPool;
  }

  const pair = pickBalancedPair(primaryPool, rng);
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
  const allForPosition = basePlayerPool(options).filter(
    (p) => p.position === position && !usedIds.has(p.id)
  );

  const elite = allForPosition.filter((p) => p.peakRating >= minRating);
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
