import { getPlayerById } from "../players";
import { getPlayerAge } from "../players/player-age";
import { getManagerClubTeamRating } from "./managerRating";
import type {
  ContractStatus,
  ManagerCareer,
  PlayerContract,
  RenewalDemand,
  SquadRole,
} from "./types";

export function formatWage(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(amount / 1000)}k`;
}

export function inferSquadRole(
  rating: number,
  inStartingXiii: boolean,
  age?: number
): SquadRole {
  if (rating >= 86) return "Star";
  if (rating >= 82 && inStartingXiii) return "Starter";
  if (rating >= 78 && inStartingXiii) return "Starter";
  if (rating >= 74) return "Rotation";
  if (age !== undefined && age <= 22) return "Prospect";
  return "Depth";
}

export function calculateWageForPlayer(
  playerId: string,
  role: SquadRole,
  clubReputation: number
): number {
  const player = getPlayerById(playerId);
  if (!player) return 25_000;
  const rating = player.rating ?? player.peakRating;
  const age = getPlayerAge(player);

  let base: number;
  if (rating >= 88) base = 180_000 + (rating - 88) * 25_000;
  else if (rating >= 85) base = 120_000 + (rating - 85) * 20_000;
  else if (rating >= 80) base = 80_000 + (rating - 80) * 8_000;
  else if (rating >= 74) base = 45_000 + (rating - 74) * 5_000;
  else if (age !== undefined && age <= 22) base = 20_000 + rating * 400;
  else base = 15_000 + rating * 350;

  const roleMult: Record<SquadRole, number> = {
    Star: 1.25,
    Starter: 1.1,
    Rotation: 1.0,
    Prospect: 0.85,
    Depth: 0.75,
  };

  const repBonus = (clubReputation - 70) * 500;
  return Math.round(Math.max(15_000, base * roleMult[role] + repBonus));
}

export function generateInitialContract(
  playerId: string,
  inStartingXiii: boolean,
  clubReputation: number
): PlayerContract {
  const player = getPlayerById(playerId);
  const rating = player?.rating ?? player?.peakRating ?? 70;
  const age = player ? getPlayerAge(player) : undefined;
  const role = inferSquadRole(rating, inStartingXiii, age);
  const wage = calculateWageForPlayer(playerId, role, clubReputation);
  const yearsRemaining = rating >= 85 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);

  return {
    wagePerYear: wage,
    yearsRemaining,
    expiresAtSeasonEnd: yearsRemaining <= 1,
    squadRole: role,
    happiness: 55 + Math.floor(Math.random() * 30),
  };
}

export function generateRenewalDemand(
  playerId: string,
  contract: PlayerContract,
  career: ManagerCareer
): RenewalDemand {
  const player = getPlayerById(playerId);
  const rating = player?.rating ?? player?.peakRating ?? 70;
  const ps = career.squad.find((p) => p.playerId === playerId);
  const happiness = contract.happiness;
  const appearances = ps?.seasonAppearances ?? 0;

  let wageBump = 1.05;
  if (happiness >= 70) wageBump += 0.05;
  if (appearances >= 10) wageBump += 0.04;
  if (career.boardConfidence >= 70) wageBump += 0.03;
  if (rating >= 85) wageBump += 0.08;

  const yearsRequested = rating >= 85 ? 2 : 1 + Math.floor(Math.random() * 2);
  const role =
    appearances >= 8 && rating >= 80
      ? "Starter"
      : contract.squadRole;

  return {
    wagePerYear: Math.round(contract.wagePerYear * wageBump),
    yearsRequested,
    squadRole: role,
  };
}

export function getContractStatus(
  contract: PlayerContract
): ContractStatus {
  if (contract.status === "renewed") return "renewed";
  if (contract.status === "leaving") return "leaving";
  if (contract.happiness < 35) return "unhappy";
  if (contract.renewalDemand) return "wants_renewal";
  if (contract.yearsRemaining <= 0 || contract.expiresAtSeasonEnd) {
    return "expires_this_season";
  }
  if (contract.yearsRemaining === 1) return "one_year_left";
  return "long_term";
}

export function computeWageBill(
  contracts: Record<string, PlayerContract>
): number {
  return Object.values(contracts).reduce((sum, c) => sum + c.wagePerYear, 0);
}

export function getWageBudgetForClub(club: string): number {
  const rating = getManagerClubTeamRating(club);
  return Math.round(1_200_000 + rating * 12_000);
}

export function evaluateRenewalOffer(
  playerId: string,
  contract: PlayerContract,
  offer: RenewalDemand,
  career: ManagerCareer
): { accepted: boolean; reason: string } {
  const demand = contract.renewalDemand ?? generateRenewalDemand(playerId, contract, career);
  const player = getPlayerById(playerId);
  const rating = player?.rating ?? player?.peakRating ?? 70;
  const ps = career.squad.find((p) => p.playerId === playerId);
  const happiness = contract.happiness;
  const appearances = ps?.seasonAppearances ?? 0;
  const form = ps?.form ?? 50;
  const position = career.leagueTable.find((r) => r.isUserTeam)?.position ?? 10;

  if (offer.wagePerYear < demand.wagePerYear * 0.9) {
    return {
      accepted: false,
      reason: "Declined — wage offer too low.",
    };
  }
  if (offer.yearsRequested < demand.yearsRequested && rating >= 82) {
    return {
      accepted: false,
      reason: "Declined — wants a longer deal.",
    };
  }
  const roleRank: Record<SquadRole, number> = {
    Star: 5,
    Starter: 4,
    Rotation: 3,
    Prospect: 2,
    Depth: 1,
  };
  if (roleRank[offer.squadRole] < roleRank[demand.squadRole]) {
    return {
      accepted: false,
      reason: "Declined — wants a bigger squad role.",
    };
  }
  if (appearances < 5 && rating >= 78) {
    return {
      accepted: false,
      reason: "Declined — unhappy with game time.",
    };
  }
  if (position >= 10 && happiness < 45) {
    return {
      accepted: false,
      reason: "Declined — club performance is below expectations.",
    };
  }
  if (happiness < 30 && career.boardConfidence < 40) {
    return {
      accepted: false,
      reason: "Declined — wants to leave the club.",
    };
  }
  if (
    career.wageBill - contract.wagePerYear + offer.wagePerYear >
    career.wageBudget * 1.05
  ) {
    return {
      accepted: false,
      reason: "Declined — club cannot afford this deal.",
    };
  }

  if (offer.wagePerYear >= demand.wagePerYear && roleRank[offer.squadRole] >= roleRank[demand.squadRole]) {
    if (appearances >= 10 && form >= 60) {
      return {
        accepted: true,
        reason: "Accepted — wanted to stay after a strong season.",
      };
    }
    return {
      accepted: true,
      reason: "Accepted — happy with wage and squad role.",
    };
  }

  if (offer.wagePerYear >= demand.wagePerYear * 0.95 && happiness >= 50) {
    return {
      accepted: true,
      reason: "Accepted — happy with wage and squad role.",
    };
  }

  return {
    accepted: false,
    reason: "Declined — player rejected the offer.",
  };
}

export function applyRenewal(
  career: ManagerCareer,
  playerId: string,
  offer: RenewalDemand
): ManagerCareer {
  const contract = career.contracts[playerId];
  if (!contract) return career;

  const nextContracts = { ...career.contracts };
  nextContracts[playerId] = {
    ...contract,
    wagePerYear: offer.wagePerYear,
    yearsRemaining: offer.yearsRequested,
    expiresAtSeasonEnd: offer.yearsRequested <= 1,
    squadRole: offer.squadRole,
    happiness: Math.min(99, contract.happiness + 15),
    renewalDemand: undefined,
    status: "renewed",
  };

  const wageBill = computeWageBill(nextContracts);
  return {
    ...career,
    contracts: nextContracts,
    wageBill,
    updatedAt: new Date().toISOString(),
  };
}

export function tickContractsForNewSeason(
  career: ManagerCareer
): { career: ManagerCareer; leaving: string[] } {
  const leaving: string[] = [];
  const nextContracts: Record<string, PlayerContract> = {};
  const nextSquad = [...career.squad];

  for (const ps of career.squad) {
    const c = career.contracts[ps.playerId];
    if (!c) continue;

    if (c.yearsRemaining <= 0 || (c.expiresAtSeasonEnd && c.status !== "renewed")) {
      leaving.push(ps.playerId);
      continue;
    }

    const yearsRemaining = c.yearsRemaining - 1;
    nextContracts[ps.playerId] = {
      ...c,
      yearsRemaining,
      expiresAtSeasonEnd: yearsRemaining <= 1,
      status: undefined,
      renewalDemand:
        yearsRemaining <= 1
          ? generateRenewalDemand(ps.playerId, c, career)
          : undefined,
    };
  }

  const squad = nextSquad.filter((p) => !leaving.includes(p.playerId));
  const wageBill = computeWageBill(nextContracts);

  return {
    leaving,
    career: {
      ...career,
      squad,
      contracts: nextContracts,
      wageBill,
      matchdayXiii: career.matchdayXiii.filter((id) => !leaving.includes(id)),
      matchdayInterchange: career.matchdayInterchange.filter(
        (id) => !leaving.includes(id)
      ),
    },
  };
}

export function countExpiringContracts(
  contracts: Record<string, PlayerContract>
): number {
  return Object.values(contracts).filter(
    (c) => c.yearsRemaining <= 1 || c.expiresAtSeasonEnd
  ).length;
}

export function ensureRenewalDemands(career: ManagerCareer): ManagerCareer {
  const contracts = { ...career.contracts };
  let changed = false;
  for (const [id, c] of Object.entries(contracts)) {
    if ((c.yearsRemaining <= 1 || c.expiresAtSeasonEnd) && !c.renewalDemand) {
      contracts[id] = {
        ...c,
        renewalDemand: generateRenewalDemand(id, c, career),
      };
      changed = true;
    }
  }
  return changed ? { ...career, contracts } : career;
}

export function previewPlayersLeaving(
  career: ManagerCareer
): string[] {
  const leaving: string[] = [];
  for (const ps of career.squad) {
    const c = career.contracts[ps.playerId];
    if (!c) continue;
    if (
      c.yearsRemaining <= 0 ||
      (c.expiresAtSeasonEnd && c.status !== "renewed")
    ) {
      leaving.push(ps.playerId);
    }
  }
  return leaving;
}

export function buildContractsForSquad(
  playerIds: string[],
  startingIds: Set<string>,
  club: string
): Record<string, PlayerContract> {
  const rep = getManagerClubTeamRating(club);
  const contracts: Record<string, PlayerContract> = {};
  for (const id of playerIds) {
    contracts[id] = generateInitialContract(id, startingIds.has(id), rep);
  }
  return contracts;
}
