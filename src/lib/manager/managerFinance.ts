import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { ManagerCareer, ManagerFinance, ManagerSeasonSummary } from "./types";
import { getManagerClubConfig } from "./club-config";
import { computeWageBill } from "./managerContracts";
import { getWageBudgetForClub } from "./managerContracts";
import { getUserLeaguePosition } from "./managerFixtures";

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
  return Math.round(range[0] + ((range[1] - range[0]) * t) / 1000);
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
  const floor = Math.round(config.budget * 0.85);
  const cap = Math.round(config.budget * 2.2);
  return Math.max(floor, Math.min(cap, base));
}

export function initManagerFinance(career: Partial<ManagerCareer>): ManagerFinance {
  const club = career.club ?? "Bradford Bulls";
  const seed = career.seed ?? "mgr";
  const transferBudget =
    career.managerFinance?.transferBudget ??
    computeFirstSeasonTransferBudget(club, seed);
  const wageBudget =
    career.wageBudget ?? getWageBudgetForClub(club);
  const wageBill =
    career.wageBill ??
    (career.contracts ? computeWageBill(career.contracts) : 0);
  const clubFunds =
    career.budget ?? career.managerFinance?.clubFunds ?? getManagerClubConfig(club).budget;

  return {
    transferBudget,
    wageBudget,
    wageBill,
    clubFunds,
    seasonIncome: career.managerFinance?.seasonIncome ?? 0,
    seasonSpending: career.managerFinance?.seasonSpending ?? 0,
  };
}

export function syncManagerFinance(career: ManagerCareer): ManagerCareer {
  const finance = initManagerFinance(career);
  finance.wageBill = computeWageBill(career.contracts);
  finance.wageBudget = career.wageBudget;
  finance.clubFunds = career.budget;
  return {
    ...career,
    managerFinance: finance,
    budget: finance.clubFunds,
    wageBill: finance.wageBill,
  };
}

export function deductTransferFee(
  career: ManagerCareer,
  amount: number
): ManagerCareer {
  const finance = initManagerFinance(career);
  finance.clubFunds -= amount;
  finance.transferBudget = Math.max(0, finance.transferBudget - amount);
  finance.seasonSpending += amount;
  return {
    ...career,
    budget: finance.clubFunds,
    managerFinance: finance,
  };
}

export function addTransferIncome(
  career: ManagerCareer,
  amount: number
): ManagerCareer {
  const finance = initManagerFinance(career);
  finance.clubFunds += amount;
  finance.transferBudget += amount;
  finance.seasonIncome += amount;
  return {
    ...career,
    budget: finance.clubFunds,
    managerFinance: finance,
  };
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
