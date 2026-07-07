import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { ManagerCareer, ManagerFinance, ManagerSeasonSummary } from "./types";
import { getManagerClubStarRating } from "./club-config";
import { computeWageBill, getWageBudgetForClub, resolveWageBudgetForCareer } from "./managerContracts";
import { computeCareerWageBill } from "./managerReserveContracts";
import { getUserLeaguePosition } from "./managerFixtures";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import { getManagerPlayer } from "./managerPlayers";

/** Global scale for manager-mode wages and transfer budgets. */
export const MANAGER_ECONOMY_SCALE = 0.85;

/** Season transfer budget ranges [min, max] by club star tier (before economy scale). */
const TRANSFER_RANGE_BY_STARS: Record<number, [number, number]> = {
  5: [950_000, 1_400_000],
  4: [700_000, 1_000_000],
  3: [480_000, 720_000],
  2: [300_000, 480_000],
  1: [200_000, 340_000],
};

/** Max rating a club comfortably recruits without heavy fee / wage premiums. */
const COMFORT_RATING_BY_STARS: Record<number, number> = {
  5: 95,
  4: 88,
  3: 84,
  2: 80,
  1: 77,
};

export function scaleManagerEconomy(amount: number): number {
  return Math.round(amount * MANAGER_ECONOMY_SCALE);
}

export function getClubStarTier(club: string): number {
  return getManagerClubStarRating(club);
}

export function getComfortableSigningRating(club: string): number {
  const stars = getClubStarTier(club);
  return COMFORT_RATING_BY_STARS[stars] ?? COMFORT_RATING_BY_STARS[3]!;
}

/** Inflated transfer fee when a smaller club chases players above their tier. */
export function getTransferFeePremium(
  club: string,
  playerRating: number
): number {
  const comfortable = getComfortableSigningRating(club);
  if (playerRating <= comfortable) return 1;
  const gap = playerRating - comfortable;
  return 1 + gap * 0.14;
}

export function getBuyerAdjustedTransferFee(
  club: string,
  baseFee: number,
  playerRating: number
): number {
  return Math.round(baseFee * getTransferFeePremium(club, playerRating));
}

export interface ClubSigningAppeal {
  allowed: boolean;
  reason?: string;
  wagePremium: number;
  feePremium: number;
}

/** Whether a club can realistically attract a player — gates York/Huddersfield from elite signings. */
export function evaluateClubSigningAppeal(
  club: string,
  playerRating: number
): ClubSigningAppeal {
  const stars = getClubStarTier(club);
  const comfortable = getComfortableSigningRating(club);
  const feePremium = getTransferFeePremium(club, playerRating);

  if (playerRating <= comfortable) {
    return { allowed: true, wagePremium: 1, feePremium: 1 };
  }

  const gap = playerRating - comfortable;

  if (stars <= 1 && playerRating >= 84) {
    return {
      allowed: false,
      feePremium,
      wagePremium: 1,
      reason:
        "Players of this calibre are not interested in your club — target lower-rated squad options.",
    };
  }
  if (stars <= 2 && playerRating >= 88) {
    return {
      allowed: false,
      feePremium,
      wagePremium: 1,
      reason:
        "Elite players rarely join clubs at your level — look for squad players around 80 rating.",
    };
  }
  if (gap > 5) {
    return {
      allowed: false,
      feePremium,
      wagePremium: 1,
      reason: `This signing is above your club's reach — scout targets around ${comfortable} rating or lower.`,
    };
  }

  return {
    allowed: true,
    feePremium,
    wagePremium: 1 + gap * 0.07,
  };
}

export function getManagerPlayerListingRating(
  career: ManagerCareer,
  playerId: string
): number {
  const player = getManagerPlayer(career, playerId);
  if (!player) return 0;
  return getManagerModePlayerRating(
    playerId,
    player.name,
    player.peakRating
  );
}

export type RevenueSource =
  | "gate"
  | "match_fee"
  | "cup_prize"
  | "player_sale"
  | "board_grant";

/** Share of each income type routed to transfer vs day-to-day club running costs. */
export const REVENUE_SPLIT: Record<
  RevenueSource,
  { transfer: number; operating: number; label: string }
> = {
  gate: {
    transfer: 0.12,
    operating: 0.88,
    label: "Gate receipts",
  },
  match_fee: {
    transfer: 0.28,
    operating: 0.72,
    label: "Match fees & TV",
  },
  cup_prize: {
    transfer: 0.4,
    operating: 0.6,
    label: "Cup prize money",
  },
  player_sale: {
    transfer: 0.85,
    operating: 0.15,
    label: "Player sales",
  },
  board_grant: {
    transfer: 0.55,
    operating: 0.45,
    label: "Board allocation",
  },
};

export function splitRevenue(
  amount: number,
  source: RevenueSource
): { transfer: number; operating: number; total: number } {
  if (amount <= 0) {
    return { transfer: 0, operating: 0, total: 0 };
  }
  const share = REVENUE_SPLIT[source];
  const transfer = Math.round(amount * share.transfer);
  const operating = amount - transfer;
  return { transfer, operating, total: amount };
}

export function getTransferBudget(career: ManagerCareer): number {
  return career.managerFinance?.transferBudget ?? career.budget;
}

/** No overspend grace — wage budget is a hard ceiling. */
export const WAGE_GRACE_MULTIPLIER = 1;

export function getWageBudgetCeiling(career: ManagerCareer): number {
  return Math.round(career.wageBudget * WAGE_GRACE_MULTIPLIER);
}

export function isWageOverBudget(career: ManagerCareer): boolean {
  return career.wageBill > career.wageBudget;
}

export function isWageAboveGrace(career: ManagerCareer): boolean {
  return career.wageBill > getWageBudgetCeiling(career);
}

export function canAffordAdditionalWage(
  career: ManagerCareer,
  additionalWage: number
): boolean {
  return career.wageBill + additionalWage <= getWageBudgetCeiling(career);
}

/** Renewals use the full budget ceiling — existing players should not be blocked. */
export function canAffordRenewalWage(
  career: ManagerCareer,
  currentWage: number,
  newWage: number
): boolean {
  const delta = newWage - currentWage;
  if (delta <= 0) return true;
  return career.wageBill + delta <= getWageBudgetCeiling(career);
}

export function getWageBillPercent(career: ManagerCareer): number {
  return Math.round((career.wageBill / Math.max(1, career.wageBudget)) * 100);
}

export function getOperatingBalance(career: ManagerCareer): number {
  return career.managerFinance?.operatingBalance ?? 0;
}

function hashSeed(seed: string, club: string): number {
  let h = 0;
  const s = `${seed}-${club}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function computeFirstSeasonTransferBudget(
  club: string,
  seed: string
): number {
  const stars = getClubStarTier(club);
  const range = TRANSFER_RANGE_BY_STARS[stars] ?? TRANSFER_RANGE_BY_STARS[3]!;
  const t = hashSeed(seed, club) % 1000;
  const raw = Math.round(range[0] + ((range[1] - range[0]) * t) / 1000);
  return scaleManagerEconomy(raw);
}

export function computeSeasonTransferBudget(
  club: string,
  seed: string,
  seasonYear: number,
  summary?: ManagerSeasonSummary,
  prevFinance?: ManagerFinance
): number {
  const isFirstSeason = seasonYear <= new Date().getFullYear() && !summary;
  if (isFirstSeason && !prevFinance) {
    return computeFirstSeasonTransferBudget(club, seed);
  }

  let base =
    prevFinance?.transferBudget ??
    computeFirstSeasonTransferBudget(club, seed);
  const position = summary?.position ?? 10;
  const wins = summary?.wins ?? 0;

  if (position === 1) base = Math.round(base * 1.15);
  else if (position <= 4) base = Math.round(base * 1.08);
  else if (position <= 8) base = Math.round(base * 1.02);
  else if (position >= 12) base = Math.round(base * 0.92);

  if (wins >= 18) base += 150_000;
  else if (wins >= 12) base += 75_000;

  if (summary?.trophies.includes("Challenge Cup")) base += 120_000;
  else if (summary?.challengeCupResult?.includes("Final")) base += 60_000;

  const stars = getClubStarTier(club);
  const range = TRANSFER_RANGE_BY_STARS[stars] ?? TRANSFER_RANGE_BY_STARS[3]!;
  const floor = scaleManagerEconomy(range[0]);
  const cap = scaleManagerEconomy(Math.round(range[1] * 1.3));
  return Math.max(floor, Math.min(cap, base));
}

export function initManagerFinance(career: Partial<ManagerCareer>): ManagerFinance {
  const club = career.club ?? "Bradford Bulls";
  const seed = career.seed ?? "mgr";
  const transferBudget =
    career.budget ??
    career.managerFinance?.transferBudget ??
    computeFirstSeasonTransferBudget(club, seed);
  const operatingBalance = career.managerFinance?.operatingBalance ?? 0;
  const wageBudget =
    career.wageBudget ??
    resolveWageBudgetForCareer(career as ManagerCareer) ??
    getWageBudgetForClub(club);
  const wageBill =
    career.wageBill ??
    (career.contracts
      ? computeCareerWageBill(career as ManagerCareer)
      : 0);

  return {
    transferBudget,
    operatingBalance,
    wageBudget,
    wageBill,
    clubFunds: transferBudget + operatingBalance,
    seasonIncome: career.managerFinance?.seasonIncome ?? 0,
    seasonTransferIncome: career.managerFinance?.seasonTransferIncome ?? 0,
    seasonOperatingIncome: career.managerFinance?.seasonOperatingIncome ?? 0,
    seasonSpending: career.managerFinance?.seasonSpending ?? 0,
  };
}

export function applyClubRevenue(
  career: ManagerCareer,
  amount: number,
  source: RevenueSource
): ManagerCareer {
  if (amount <= 0) return career;

  const { transfer, operating } = splitRevenue(amount, source);
  const finance = initManagerFinance(career);
  finance.transferBudget += transfer;
  finance.operatingBalance += operating;
  finance.clubFunds = finance.transferBudget + finance.operatingBalance;
  finance.seasonIncome += amount;
  finance.seasonTransferIncome += transfer;
  finance.seasonOperatingIncome += operating;

  return {
    ...career,
    budget: finance.transferBudget,
    clubFundsEarned: career.clubFundsEarned + amount,
    managerFinance: finance,
  };
}

export function syncManagerFinance(career: ManagerCareer): ManagerCareer {
  const finance = initManagerFinance(career);
  finance.wageBill = computeCareerWageBill(career);
  finance.wageBudget = resolveWageBudgetForCareer({
    ...career,
    wageBill: finance.wageBill,
  });
  finance.transferBudget = career.budget;
  finance.clubFunds = finance.transferBudget + finance.operatingBalance;
  return {
    ...career,
    managerFinance: finance,
    budget: finance.transferBudget,
    wageBill: finance.wageBill,
    wageBudget: finance.wageBudget,
  };
}

export function deductTransferFee(
  career: ManagerCareer,
  amount: number
): ManagerCareer {
  const finance = initManagerFinance(career);
  finance.transferBudget = Math.max(0, finance.transferBudget - amount);
  finance.seasonSpending += amount;
  finance.clubFunds = finance.transferBudget + finance.operatingBalance;
  return {
    ...career,
    budget: finance.transferBudget,
    managerFinance: finance,
  };
}

export function addTransferIncome(
  career: ManagerCareer,
  amount: number
): ManagerCareer {
  return applyClubRevenue(career, amount, "player_sale");
}

export function initClubTransferBudgets(
  userClub: string,
  seed: string
): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    funds[club] = computeFirstSeasonTransferBudget(club, `${seed}-ai`);
  }
  funds[userClub] = computeFirstSeasonTransferBudget(userClub, seed);
  return funds;
}

export function refreshClubFundsForSeason(
  career: ManagerCareer,
  summary: ManagerSeasonSummary
): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    const pos =
      club === career.club
        ? summary.position
        : 8 + (hashSeed(career.seed, club) % 6);
    const pseudo: ManagerSeasonSummary = {
      ...summary,
      position: pos,
    };
    funds[club] = computeSeasonTransferBudget(
      club,
      career.seed,
      career.seasonYear + 1,
      pseudo,
      { transferBudget: career.clubFunds[club] ?? 0 } as ManagerFinance
    );
  }
  return funds;
}

export function getUserLeaguePositionForBudget(
  career: ManagerCareer
): number {
  return getUserLeaguePosition(career.leagueTable, career.club);
}

/** Hydrate legacy gate records that pre-date revenue split tracking. */
export function hydrateGateIncomeRecord(
  record: Partial<GateIncomeRecordCompat>
): {
  fixtureId: string;
  round: number;
  attendance: number;
  income: number;
  transferAllocation: number;
  operatingAllocation: number;
  competition: ManagerCareer["gateIncomeHistory"][number]["competition"];
} {
  const income = record.income ?? 0;
  const transferAllocation =
    record.transferAllocation ??
    splitRevenue(income, "gate").transfer;
  const operatingAllocation =
    record.operatingAllocation ??
    income - transferAllocation;
  return {
    fixtureId: record.fixtureId ?? "legacy",
    round: record.round ?? 0,
    attendance: record.attendance ?? 0,
    income,
    transferAllocation,
    operatingAllocation,
    competition: record.competition ?? "league",
  };
}

type GateIncomeRecordCompat = {
  fixtureId?: string;
  round?: number;
  attendance?: number;
  income?: number;
  transferAllocation?: number;
  operatingAllocation?: number;
  competition?: ManagerCareer["gateIncomeHistory"][number]["competition"];
};
