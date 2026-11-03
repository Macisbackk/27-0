/**
 * Squad Book card rarity (not the Daily's "12% picked him" pick rarity in pick-rarity.ts).
 * Derived from the card's rating and its tier tags:
 *   Legendary  Legend cards, Hall of Fame inductees, or rated 95+
 *   Epic       Great cards, or rated 90+
 *   Rare       rated 85+
 *   Common     everything else (most current cards sit 70-84)
 * Pure. Tests: scripts/test-squad-book-collections.ts.
 */

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export const CARD_RARITIES: readonly CardRarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_THRESHOLDS = { legendary: 95, epic: 90, rare: 85 } as const;

export interface RarityInput {
  peakRating?: number | null;
  category?: string | null;
  great?: boolean | null;
  hallOfFame?: boolean | null;
}

export function cardRarity(p: RarityInput): CardRarity {
  const rating = typeof p.peakRating === "number" && Number.isFinite(p.peakRating) ? p.peakRating : 0;
  if (p.category === "legend" || p.hallOfFame || rating >= RARITY_THRESHOLDS.legendary) return "legendary";
  if (p.great || rating >= RARITY_THRESHOLDS.epic) return "epic";
  if (rating >= RARITY_THRESHOLDS.rare) return "rare";
  return "common";
}

export const RARITY_LABEL: Record<CardRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Edge colour per rarity (also used for the label chip). */
export const RARITY_COLOUR: Record<CardRarity, string> = {
  common: "#94a3b8",
  rare: "#38bdf8",
  epic: "#c084fc",
  legendary: "#fbbf24",
};

export const rarityRank = (r: CardRarity) => CARD_RARITIES.indexOf(r);
