/**
 * Central Store boost definitions.
 * Prices are in Club Funds (smallest Store currency unit = £1).
 */

export type BoostCategory = "quick-mode" | "manager-mode";

export type BoostActivationStage =
  | "quick-mode-before-player-choice"
  | "manager-career"
  | "manager-squad"
  | "manager-reserves"
  | "manager-youth-generation"
  | "manager-medical"
  | "manager-end-season";

export type GameBoostId =
  | "qm-90-plus-player"
  | "qm-goat-hall-of-fame"
  | "mgr-future-star"
  | "mgr-financial-takeover"
  | "mgr-training-boost"
  | "mgr-unlocked-potential"
  | "mgr-no-sacking"
  | "mgr-heal-all";

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
    description:
      "Guarantees at least one eligible player rated 90 or above in the next player selection.",
    category: "quick-mode",
    compatibleModes: ["CLASSIC", "DRAFT"],
    price: 1_000_000,
    activationStage: "quick-mode-before-player-choice",
    stackable: false,
    maxPerGame: 2,
    consumable: true,
    usageLimitLabel: "One per player choice · max 2 per run",
  },
  {
    id: "qm-goat-hall-of-fame",
    name: "Legend Player",
    description:
      "Era Mode only. Guarantees the next eligible selection contains one Legend player.",
    category: "quick-mode",
    compatibleModes: ["CLASSIC", "DRAFT"],
    eraModeOnly: true,
    price: 2_000_000,
    activationStage: "quick-mode-before-player-choice",
    stackable: false,
    maxPerGame: 2,
    consumable: true,
    usageLimitLabel: "Era Mode · one per player choice · max 2 per run",
  },
  {
    id: "mgr-future-star",
    name: "Future Star",
    description:
      "Adds one genuine youth player with 90–95 potential to your reserve pathway (current rating stays developmental, potential 90–95).",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 2_000_000,
    activationStage: "manager-youth-generation",
    stackable: false,
    maxPerGame: 1,
    consumable: true,
    usageLimitLabel: "Max one per club season",
  },
  {
    id: "mgr-financial-takeover",
    name: "Financial Takeover",
    description:
      "One-time increase to your club’s transfer budget and operating finances. Does not affect Store currency or salary-cap rules.",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 5_000_000,
    activationStage: "manager-career",
    stackable: false,
    maxPerGame: 1,
    consumable: true,
    usageLimitLabel: "Max one per club season",
  },
  {
    id: "mgr-training-boost",
    name: "Training Boost",
    description:
      "Immediately raises one eligible first-team squad player to their existing peak potential.",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 3_000_000,
    activationStage: "manager-squad",
    stackable: false,
    maxPerGame: 1,
    consumable: true,
    usageLimitLabel: "Once per senior player",
  },
  {
    id: "mgr-unlocked-potential",
    name: "Unlocked Potential",
    description:
      "Immediately raises one eligible reserve player to their existing potential. They stay in Reserves.",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 2_000_000,
    activationStage: "manager-reserves",
    stackable: false,
    maxPerGame: 1,
    consumable: true,
    usageLimitLabel: "Once per reserve player",
  },
  {
    id: "mgr-no-sacking",
    name: "No Sacking",
    description:
      "Disables board sackings for this Manager save. Board expectations and confidence still apply.",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 4_000_000,
    activationStage: "manager-end-season",
    stackable: false,
    maxPerGame: 1,
    consumable: true,
    usageLimitLabel: "Once per Manager save",
  },
  {
    id: "mgr-heal-all",
    name: "Heal All",
    description:
      "Clears active injuries from your senior and reserve squads. Suspensions remain. Not consumed if nobody is injured.",
    category: "manager-mode",
    compatibleModes: ["MANAGER"],
    price: 500_000,
    activationStage: "manager-medical",
    stackable: true,
    maxPerGame: 99,
    consumable: true,
    usageLimitLabel: "Only when injuries exist",
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

export function getManagerModeBoosts(): GameBoost[] {
  return STORE_BOOSTS.filter((b) => b.category === "manager-mode");
}

/** Suggested Financial Takeover cash injection (club economy, not Store). */
export const FINANCIAL_TAKEOVER_AMOUNT = 7_500_000;
