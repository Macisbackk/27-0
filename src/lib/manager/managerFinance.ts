import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { ManagerCareer, ManagerFinance, ManagerSeasonSummary } from "./types";
import { getManagerClubConfig } from "./club-config";
import { computeWageBill } from "./managerContracts";
import { getWageBudgetForClub } from "./managerContracts";
import { computeCareerWageBill } from "./managerReserveContracts";
import { getUserLeaguePosition } from "./managerFixtures";

/** Global scale for manager-mode wages and transfer budgets. */
export const MANAGER_ECONOMY_SCALE = 0.85;

export function scaleManagerEconomy(amount: number): number {
  return Math.round(amount * MANAGER_ECONOMY_SCALE);
}

/** First-season transfer budget ranges [min, max] by club. */
const FIRST_SEASON_TRANSFER_RANGE: Record<string, [number, number]> = {
  "Wigan Warriors": [1_800_000, 2_500_000],
  "St Helens": [1_600_000, 2_300_000],
  "Leeds Rhinos": [1_600_000, 2_300_000],
  "Warrington Wolves": [1_500_000, 2_200_000],
  "Hull KR": [1_300_000, 2_000_000],
  "Hull FC": [1_200_000, 1_800_000],
  "Catalans Dragons": [1_200_000, 1_800_000],
  "Leigh Leopards": [1_000_000, 1_600_000],
  "Bradford Bulls": [900_000, 1_400_000],
  "Wakefield Trinity": [850_000, 1_300_000],
  "Castleford Tigers": [800_000, 1_200_000],
  "Huddersfield Giants": [800_000, 1_200_000],
  "Toulouse Olympique": [750_000, 1_100_000],
  "York Knights": [700_000, 1_000_000],
};

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

/** Signing grace above strict wage budget (5%). */
export const WAGE_GRACE_MULTIPLIER = 1.05;

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
  const range = FIRST_SEASON_TRANSFER_RANGE[club] ?? [700_000, 1_000_000];
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

  if (summary?.trophies.includes("Challenge Cup")) base += 200_000;
  else if (summary?.challengeCupResult?.includes("Final")) base += 100_000;

  const config = getManagerClubConfig(club);
  const scaledClubBudget = scaleManagerEconomy(config.budget);
  const floor = Math.round(scaledClubBudget * 0.85);
  const cap = Math.round(scaledClubBudget * 2.2);
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
    career.wageBudget ?? getWageBudgetForClub(club);
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
  finance.wageBudget = career.wageBudget;
  finance.transferBudget = career.budget;
  finance.clubFunds = finance.transferBudget + finance.operatingBalance;
  return {
    ...career,
    managerFinance: finance,
    budget: finance.transferBudget,
    wageBill: finance.wageBill,
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
