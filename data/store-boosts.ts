/**
 * Central Store boost definitions.
 * Prices are in Club Funds (smallest Store currency unit = £1).
 */

export type BoostCategory = "quick-mode";

export type BoostActivationStage = "quick-mode-before-player-choice";

export type GameBoostId = "qm-90-plus-player" | "qm-goat-hall-of-fame";

export interface GameBoost {
  id: GameBoostId;
  name: string;
  description: string;
  category: BoostCategory;
  compatibleModes: string[];
  /** When true, Quick Mode boost only appears/arms in Era Mode (not Current). */
  eraModeOnly?: boolean;
  price: number;
  activationStage: BoostActivationStage;
  stackable: boolean;
  maxPerGame: number;
  consumable: true;
  /** Human-readable usage limit for Store cards. */
  usageLimitLabel: string;
}

export const STORE_BOOSTS: readonly GameBoost[] = [
  {
    id: "qm-90-plus-player",
    name: "90+ Rated Player",
    description: "Next pick includes a 90+ player.",
    category: "quick-mode",
    compatibleModes: ["CLASSIC", "DRAFT"],
    price: 1_000_000,
    activationStage: "quick-mode-before-player-choice",
    stackable: false,
    maxPerGame: 2,
    consumable: true,
    usageLimitLabel: "Max 2 per run",
  },
  {
    id: "qm-goat-hall-of-fame",
    name: "Legend Player",
    description: "Era only. Next pick includes a Legend.",
    category: "quick-mode",
    compatibleModes: ["CLASSIC", "DRAFT"],
    eraModeOnly: true,
    price: 2_000_000,
    activationStage: "quick-mode-before-player-choice",
    stackable: false,
    maxPerGame: 2,
    consumable: true,
    usageLimitLabel: "Era · max 2 per run",
  },
] as const;

export const BOOST_BY_ID: Record<GameBoostId, GameBoost> = Object.fromEntries(
  STORE_BOOSTS.map((b) => [b.id, b])
) as Record<GameBoostId, GameBoost>;

export function getBoostDefinition(id: string): GameBoost | undefined {
  return BOOST_BY_ID[id as GameBoostId];
}

export function getQuickModeBoosts(): GameBoost[] {
  return STORE_BOOSTS.filter((b) => b.category === "quick-mode");
}
