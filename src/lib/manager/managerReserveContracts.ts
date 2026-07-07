import seedrandom from "seedrandom";
import { POSITION_SHORT, SQUAD_STRUCTURE } from "../positions";
import type { Position } from "../types";
import type {
  ManagerCareer,
  ManagerReservePlayer,
  PlayerContract,
  RenewalDemand,
} from "./types";
import {
  computeWageBill,
  formatWage,
  getContractStatus,
} from "./managerContracts";
import {
  addReserveContractRenewalInboxMessage,
  addYouthIntakeInboxMessage,
  pushInboxMessage,
} from "./managerInbox";
import {
  createYouthProspect,
  reconcileLeagueClubReserveCounts,
} from "./managerReserves";
import { getClubFacilities, getYouthIntakeBonus } from "./managerFacilities";

/** Cheap youth/reserve wages — well below first-team deals. */
export function generateReserveYouthContract(
  reserve: ManagerReservePlayer
): PlayerContract {
  const wage = Math.min(
    22_000,
    Math.max(6_000, Math.round(5_500 + reserve.rating * 120))
  );
  const yearsRemaining = reserve.age <= 18 ? 2 : 1;

  return {
    wagePerYear: wage,
    yearsRemaining,
    expiresAtSeasonEnd: yearsRemaining <= 1,
    squadRole: "Prospect",
    happiness: 60 + Math.floor(Math.random() * 25),
    purchaseFee: 0,
  };
}

export function generateReserveRenewalDemand(
  reserve: ManagerReservePlayer,
  contract: PlayerContract
): RenewalDemand {
  const bump = reserve.potentialRating >= 80 ? 1.1 : 1.05;
  const wagePerYear = Math.min(
    28_000,
    Math.max(
      contract.wagePerYear,
      Math.round(contract.wagePerYear * bump + reserve.rating * 50)
    )
  );
  return {
    wagePerYear,
    yearsRequested: reserve.age <= 19 ? 2 : 1,
    squadRole: "Prospect",
  };
}

export function buildReserveContractsForReserves(
  reserves: ManagerReservePlayer[]
): Record<string, PlayerContract> {
  const out: Record<string, PlayerContract> = {};
  for (const r of reserves) {
    out[r.id] = generateReserveYouthContract(r);
  }
  return out;
}

export function computeCareerWageBill(career: ManagerCareer): number {
  return (
    computeWageBill(career.contracts) +
    computeWageBill(career.reserveContracts ?? {})
  );
}

export function ensureReserveRenewalDemands(
  career: ManagerCareer
): ManagerCareer {
  const reserveContracts = { ...(career.reserveContracts ?? {}) };
  let changed = false;

  for (const reserve of career.reserves) {
    const c = reserveContracts[reserve.id];
    if (!c) continue;
    if ((c.yearsRemaining <= 1 || c.expiresAtSeasonEnd) && !c.renewalDemand) {
      reserveContracts[reserve.id] = {
        ...c,
        renewalDemand: generateReserveRenewalDemand(reserve, c),
      };
      changed = true;
    }
  }

  return changed ? { ...career, reserveContracts } : career;
}

export function evaluateReserveRenewalOffer(
  contract: PlayerContract,
  offer: RenewalDemand
): { accepted: boolean; reason: string } {
  const demand =
    contract.renewalDemand ??
    ({
      wagePerYear: contract.wagePerYear,
      yearsRequested: 1,
      squadRole: "Prospect" as const,
    } satisfies RenewalDemand);

  if (offer.wagePerYear < demand.wagePerYear * 0.85) {
    return { accepted: false, reason: "Declined — wage offer too low." };
  }
  return { accepted: true, reason: "Youth contract renewed." };
}

export function applyReserveRenewal(
  career: ManagerCareer,
  reserveId: string,
  offer: RenewalDemand
): ManagerCareer {
  const contract = career.reserveContracts?.[reserveId];
  if (!contract) return career;

  const nextContracts = {
    ...career.reserveContracts,
    [reserveId]: {
      ...contract,
      wagePerYear: offer.wagePerYear,
      yearsRemaining: offer.yearsRequested,
      expiresAtSeasonEnd: offer.yearsRequested <= 1,
      squadRole: offer.squadRole,
      happiness: Math.min(100, contract.happiness + 8),
      renewalDemand: undefined,
      status: "renewed" as const,
    },
  };

  return {
    ...career,
    reserveContracts: nextContracts,
    wageBill: computeCareerWageBill({
      ...career,
      reserveContracts: nextContracts,
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function renewReserveContract(
  career: ManagerCareer,
  reserveId: string,
  offer: RenewalDemand
): ManagerCareer {
  const reserve = career.reserves.find((r) => r.id === reserveId);
  if (!reserve) return career;
  const next = applyReserveRenewal(career, reserveId, offer);
  return addReserveContractRenewalInboxMessage(
    next,
    reserveId,
    reserve.name,
    offer.wagePerYear,
    offer.yearsRequested
  );
}

export function tickReserveContractsForNewSeason(career: ManagerCareer): {
  career: ManagerCareer;
  leaving: string[];
} {
  const leaving: string[] = [];
  const nextContracts = { ...(career.reserveContracts ?? {}) };
  let reserves = [...career.reserves];

  for (const reserve of career.reserves) {
    const c = nextContracts[reserve.id];
    if (!c) continue;

    if (
      c.yearsRemaining <= 0 ||
      (c.expiresAtSeasonEnd && c.status !== "renewed")
    ) {
      leaving.push(reserve.id);
      delete nextContracts[reserve.id];
      continue;
    }

    const yearsRemaining = c.yearsRemaining - 1;
    nextContracts[reserve.id] = {
      ...c,
      yearsRemaining,
      expiresAtSeasonEnd: yearsRemaining <= 1,
      status: undefined,
      renewalDemand:
        yearsRemaining <= 1
          ? generateReserveRenewalDemand(reserve, c)
          : undefined,
    };
  }

  if (leaving.length > 0) {
    const leaveSet = new Set(leaving);
    reserves = reserves.filter((r) => !leaveSet.has(r.id));
  }

  const nextCareer: ManagerCareer = {
    ...career,
    reserves,
    reserveContracts: nextContracts,
    calledUpReserveIds: career.calledUpReserveIds.filter(
      (id) => !leaving.includes(id)
    ),
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => !leaving.includes(id)
    ),
    wageBill: computeCareerWageBill({
      ...career,
      reserves,
      reserveContracts: nextContracts,
    }),
  };

  return { career: nextCareer, leaving };
}

export function rollYouthIntakeCount(
  seed: string,
  seasonYear: number,
  youthLevel = 0
): number {
  const rng = seedrandom(`${seed}-youth-intake-s${seasonYear}`);
  const base = 3 + Math.floor(rng() * 4);
  return Math.min(8, base + getYouthIntakeBonus(youthLevel));
}

export function generateYearlyYouthProspects(
  career: ManagerCareer
): ManagerReservePlayer[] {
  const youthLevel = getClubFacilities(career).youth;
  const count = rollYouthIntakeCount(career.seed, career.seasonYear, youthLevel);
  const positions: Position[] = [];
  for (const { position, count: c } of SQUAD_STRUCTURE) {
    for (let i = 0; i < c; i++) positions.push(position);
  }
  const rng = seedrandom(`${career.seed}-youth-pos-s${career.seasonYear}`);
  const shuffled = [...positions].sort(() => rng() - 0.5);

  const prospects: ManagerReservePlayer[] = [];
  for (let i = 0; i < count; i++) {
    const pos = shuffled[i % shuffled.length] ?? "CENTRE";
    prospects.push(
      createYouthProspect(
        career.seed,
        career.seasonYear,
        i,
        pos,
        career.club,
        youthLevel
      )
    );
  }
  return prospects;
}

export function signYouthProspect(
  career: ManagerCareer,
  prospectId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const prospect = career.youthProspects?.find((p) => p.id === prospectId);
  if (!prospect) return { ok: false, error: "Prospect not found" };
  if (career.reserves.length >= 30) {
    return { ok: false, error: "Reserve squad is full (30)" };
  }

  const contract = generateReserveYouthContract(prospect);
  const reserveContracts = {
    ...(career.reserveContracts ?? {}),
    [prospect.id]: contract,
  };

  return {
    ok: true,
    career: reconcileLeagueClubReserveCounts({
      ...career,
      reserves: [...career.reserves, prospect],
      reserveContracts,
      youthProspects: (career.youthProspects ?? []).filter(
        (p) => p.id !== prospectId
      ),
      wageBill: computeCareerWageBill({ ...career, reserveContracts }),
      updatedAt: new Date().toISOString(),
    }),
  };
}

export function declineYouthProspect(
  career: ManagerCareer,
  prospectId: string
): ManagerCareer {
  return {
    ...career,
    youthProspects: (career.youthProspects ?? []).filter(
      (p) => p.id !== prospectId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function bulkRenewExpiringReserveContracts(career: ManagerCareer): {
  career: ManagerCareer;
  renewed: number;
  declined: number;
} {
  let working = ensureReserveRenewalDemands(career);
  let renewed = 0;
  let declined = 0;

  for (const reserve of working.reserves) {
    const contract = working.reserveContracts?.[reserve.id];
    if (!contract) continue;
    const status = getContractStatus(contract);
    if (status !== "expires_this_season" && status !== "wants_renewal") {
      continue;
    }

    const demand =
      contract.renewalDemand ??
      generateReserveRenewalDemand(reserve, contract);
    const result = evaluateReserveRenewalOffer(contract, demand);
    if (result.accepted) {
      working = renewReserveContract(working, reserve.id, demand);
      renewed++;
    } else {
      declined++;
    }
  }

  return { career: working, renewed, declined };
}

export function applyYearlyYouthIntake(career: ManagerCareer): ManagerCareer {
  const prospects = generateYearlyYouthProspects(career);
  if (prospects.length === 0) return career;

  const names = prospects
    .map((p) => `${p.name} (${POSITION_SHORT[p.position]}, POT ${p.potentialRating})`)
    .join("; ");

  let next: ManagerCareer = {
    ...career,
    youthProspects: prospects,
    updatedAt: new Date().toISOString(),
  };

  next = addYouthIntakeInboxMessage(next, prospects.length, names);
  return next;
}

export function syncReserveContractExpiryInbox(
  career: ManagerCareer
): ManagerCareer {
  let next = career;
  for (const reserve of career.reserves) {
    const contract = career.reserveContracts?.[reserve.id];
    if (!contract) continue;
    const status = getContractStatus(contract);
    if (status !== "expires_this_season" && status !== "one_year_left") {
      continue;
    }

    const msgId = `reserve-contract-${reserve.id}-s${career.seasonYear}`;
    if (next.inboxMessages.some((m) => m.id === msgId)) continue;

    next = pushInboxMessage(next, {
      id: msgId,
      type: "contract",
      title: "Reserve Contract Expiring",
      body: `${reserve.name}'s youth contract expires ${status === "expires_this_season" ? "this season" : "next season"} (${formatWage(contract.wagePerYear)}/yr). Renew on the Reserves screen.`,
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      resolved: false,
      playerId: reserve.id,
      playerName: reserve.name,
    });
  }
  return next;
}
