import { getPlayerById } from "../players";
import { getPlayerAge } from "../players/player-age";
import { getManagerClubTeamRating } from "./managerRating";
import { getManagerPlayer } from "./managerPlayers";
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

export function getPlayerSeasonAppearances(
  career: ManagerCareer,
  playerId: string
): number {
  const fromStats = career.playerSeasonStats[playerId]?.appearances;
  if (fromStats !== undefined && fromStats > 0) return fromStats;
  const ps = career.squad.find((p) => p.playerId === playerId);
  return ps?.seasonAppearances ?? 0;
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

const MAX_DEMAND_BY_ROLE: Record<SquadRole, number> = {
  Star: 350_000,
  Starter: 180_000,
  Rotation: 90_000,
  Prospect: 60_000,
  Depth: 45_000,
};

function baseWageFromRating(rating: number, age?: number): number {
  if (rating >= 90) return 250_000 + (rating - 90) * 20_000;
  if (rating >= 86) return 180_000 + (rating - 86) * 15_000;
  if (rating >= 82) return 120_000 + (rating - 82) * 12_000;
  if (rating >= 78) return 80_000 + (rating - 78) * 8_000;
  if (rating >= 74) return 45_000 + (rating - 74) * 5_000;
  if (age !== undefined && age <= 22) return 20_000 + rating * 350;
  return 15_000 + rating * 300;
}

export function calculateWageForPlayer(
  playerId: string,
  role: SquadRole,
  _clubReputation: number
): number {
  const player = getPlayerById(playerId);
  if (!player) return 25_000;
  const rating = player.rating ?? player.peakRating;
  const age = getPlayerAge(player);
  const base = baseWageFromRating(rating, age);

  const roleMult: Record<SquadRole, number> = {
    Star: 1.08,
    Starter: 1.04,
    Rotation: 1.0,
    Prospect: 0.9,
    Depth: 0.82,
  };

  const wage = Math.round(base * roleMult[role]);
  return Math.min(MAX_DEMAND_BY_ROLE[role], Math.max(15_000, wage));
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
  const player = getManagerPlayer(career, playerId);
  const rating = player?.rating ?? player?.peakRating ?? 70;
  const age = player ? getPlayerAge(player) : undefined;
  const appearances = getPlayerSeasonAppearances(career, playerId);
  const happiness = contract.happiness;

  let wageBump = 1.03;
  if (happiness >= 70) wageBump += 0.03;
  if (appearances >= 10) wageBump += 0.03;
  if (career.boardConfidence >= 70) wageBump += 0.02;
  if (rating >= 85) wageBump += 0.04;

  const yearsRequested =
    rating >= 85 && (age === undefined || age <= 30) ? 2 : 1;
  const role =
    appearances >= 8 && rating >= 80
      ? "Starter"
      : contract.squadRole;

  const rawDemand = Math.round(contract.wagePerYear * wageBump);
  const cap = MAX_DEMAND_BY_ROLE[role];
  const fairBase = calculateWageForPlayer(
    playerId,
    role,
    getManagerClubTeamRating(career.club)
  );

  return {
    wagePerYear: Math.min(cap, Math.max(fairBase, rawDemand)),
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
  return Math.round(3_200_000 + rating * 15_000);
}

function roleRank(role: SquadRole): number {
  const ranks: Record<SquadRole, number> = {
    Star: 5,
    Starter: 4,
    Rotation: 3,
    Prospect: 2,
    Depth: 1,
  };
  return ranks[role];
}

function caresAboutGameTime(role: SquadRole): boolean {
  return role === "Star" || role === "Starter";
}

export function evaluateRenewalOffer(
  playerId: string,
  contract: PlayerContract,
  offer: RenewalDemand,
  career: ManagerCareer
): { accepted: boolean; reason: string } {
  const demand = contract.renewalDemand ?? generateRenewalDemand(playerId, contract, career);
  const player = getManagerPlayer(career, playerId);
  const rating = player?.rating ?? player?.peakRating ?? 70;
  const happiness = contract.happiness;
  const appearances = getPlayerSeasonAppearances(career, playerId);
  const form = career.squad.find((p) => p.playerId === playerId)?.form ?? 50;
  const position = career.leagueTable.find((r) => r.isUserTeam)?.position ?? 10;
  const totalMatchesPlayed = career.teamSeasonStats.played;
  const appearanceRate =
    totalMatchesPlayed > 0 ? appearances / totalMatchesPlayed : null;
  const hasReliableGameTimeData =
    appearanceRate !== null && Number.isFinite(appearanceRate);

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
  if (roleRank(offer.squadRole) < roleRank(demand.squadRole)) {
    return {
      accepted: false,
      reason: "Declined — wants a bigger squad role.",
    };
  }

  if (
    hasReliableGameTimeData &&
    totalMatchesPlayed >= 5 &&
    caresAboutGameTime(contract.squadRole) &&
    appearanceRate! < 0.35 &&
    rating >= 80
  ) {
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

  if (offer.wagePerYear >= demand.wagePerYear && roleRank(offer.squadRole) >= roleRank(demand.squadRole)) {
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
