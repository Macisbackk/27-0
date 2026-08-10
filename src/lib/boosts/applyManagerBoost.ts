import seedrandom from "seedrandom";
import {
  FINANCIAL_TAKEOVER_AMOUNT,
  type GameBoostId,
} from "./boostDefinitions";
import { getPlayersByCategory } from "../players";
import { SQUAD_STRUCTURE } from "../positions";
import type { Position } from "../types";
import { applyClubRevenue } from "../manager/managerFinance";
import { pushInboxMessage } from "../manager/managerInbox";
import { getPlayerPotential } from "../manager/managerPlayerDevelopment";
import { getManagerPlayer } from "../manager/managerPlayers";
import { managerClubSeasonKey } from "../manager/managerClubChange";
import { invalidateBoardSeasonEvaluation } from "../manager/boardSeasonEvaluation";
import { generateReserveYouthContract } from "../manager/managerReserveContracts";
import { createYouthProspect } from "../manager/managerReserves";
import type {
  ManagerCareer,
  ManagerBoostUsage,
  ManagerInjury,
  ManagerReservePlayer,
} from "../manager/types";

export interface ApplyManagerBoostResult {
  success: boolean;
  career?: ManagerCareer;
  reason?: string;
  healedPlayerIds?: string[];
  /** Populated when Future Star creates a new reserve pathway player. */
  futureStarPlayer?: ManagerReservePlayer;
}

function ensureBoostUsage(career: ManagerCareer): ManagerBoostUsage {
  return career.boostUsage ?? {};
}

function uniquePlayerNames(career: ManagerCareer): Set<string> {
  const names = new Set<string>();
  for (const p of getPlayersByCategory("current")) {
    names.add(p.name.toLowerCase());
  }
  for (const p of getPlayersByCategory("historic")) {
    names.add(p.name.toLowerCase());
  }
  for (const r of career.reserves ?? []) {
    names.add(r.name.toLowerCase());
  }
  for (const p of Object.values(career.playerRegistry ?? {})) {
    names.add(p.name.toLowerCase());
  }
  return names;
}

function pickFutureStarPosition(seed: string): Position {
  const positions: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) positions.push(position);
  }
  const rng = seedrandom(`${seed}-future-star-pos`);
  return positions[Math.floor(rng() * positions.length)]!;
}

function createFutureStarReserve(
  career: ManagerCareer,
  usageId: string
): ManagerReservePlayer {
  const rng = seedrandom(`${career.seed}-boost-future-star-${usageId}`);
  const takenNames = uniquePlayerNames(career);
  const position = pickFutureStarPosition(`${career.seed}-${usageId}`);
  const index = Math.abs(
    usageId.split("").reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)
  );

  const base = createYouthProspect(
    `${career.seed}-boost-future-star`,
    career.seasonYear,
    index,
    position,
    career.club,
    2
  );

  const potentialRating = 90 + Math.floor(rng() * 6);
  const rating = 80 + Math.floor(rng() * 5);

  let name = base.name;
  if (takenNames.has(name.toLowerCase())) {
    const suffix = Math.floor(rng() * 900 + 100);
    name = `${base.name.split(" ")[0]} ${base.name.split(" ").slice(1).join(" ") || "Star"} ${suffix}`;
    if (takenNames.has(name.toLowerCase())) {
      name = `Academy Star ${suffix}`;
    }
  }

  return {
    ...base,
    id: `mgr-boost-star-${career.id}-${usageId}`,
    name,
    age: 17 + Math.floor(rng() * 3),
    rating,
    baseRating: rating,
    signedRating: rating,
    signedSeasonYear: career.seasonYear,
    yearsAtClub: 0,
    potentialRating,
    developmentRate: 1.2 + rng() * 0.4,
    form: 55 + Math.floor(rng() * 20),
    reserveAppearances: 0,
    reserveTries: 0,
    calledUpForNextMatch: false,
  };
}

function applyFutureStar(
  career: ManagerCareer,
  usageId: string
): ApplyManagerBoostResult {
  const usage = ensureBoostUsage(career);
  const seasonKey = managerClubSeasonKey(career);
  if (usage.futureStarBySeason?.[seasonKey]) {
    return { success: false, reason: "Future Star already used this club season." };
  }

  const reserve = createFutureStarReserve(career, usageId);
  const contract = generateReserveYouthContract(reserve);
  const reserves = [...(career.reserves ?? []), reserve];
  const reserveContracts = {
    ...(career.reserveContracts ?? {}),
    [reserve.id]: contract,
  };

  let next: ManagerCareer = {
    ...career,
    reserves,
    reserveContracts,
    boostUsage: {
      ...usage,
      futureStarBySeason: { ...(usage.futureStarBySeason ?? {}), [seasonKey]: true },
    },
    pendingFutureStarRevealPlayerId: reserve.id,
    updatedAt: new Date().toISOString(),
  };

  next = pushInboxMessage(next, {
    id: `boost-future-star-${usageId}`,
    type: "youth_intake",
    title: "Highly rated youngster joins the club pathway",
    body: `${reserve.name} (${reserve.rating} OVR, ${reserve.potentialRating} potential) has joined your reserve listing.`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    playerId: reserve.id,
    playerName: reserve.name,
  });

  return { success: true, career: next, futureStarPlayer: reserve };
}

function applyFinancialTakeover(
  career: ManagerCareer,
  usageId: string
): ApplyManagerBoostResult {
  const usage = ensureBoostUsage(career);
  const seasonKey = managerClubSeasonKey(career);
  if (usage.financialTakeoverBySeason?.[seasonKey]) {
    return {
      success: false,
      reason: "Financial Takeover already used this club season.",
    };
  }

  let next = applyClubRevenue(career, FINANCIAL_TAKEOVER_AMOUNT, "board_grant");
  next = {
    ...next,
    boostUsage: {
      ...usage,
      financialTakeoverBySeason: {
        ...(usage.financialTakeoverBySeason ?? {}),
        [seasonKey]: true,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  next = pushInboxMessage(next, {
    id: `boost-financial-${usageId}`,
    type: "board",
    title: "Financial Takeover complete",
    body: `The board have released £${FINANCIAL_TAKEOVER_AMOUNT.toLocaleString()} into club finances (transfer budget and operating balance).`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    sender: "Board",
  });

  return { success: true, career: next };
}

function applyTrainingBoost(
  career: ManagerCareer,
  playerId: string,
  usageId: string
): ApplyManagerBoostResult {
  const usage = ensureBoostUsage(career);
  if (usage.trainingBoostPlayerIds?.includes(playerId)) {
    return { success: false, reason: "Training Boost already used on this player." };
  }

  const squadMember = career.squad.find((p) => p.playerId === playerId);
  if (!squadMember) {
    return { success: false, reason: "Player not in your senior squad." };
  }

  const potential = getPlayerPotential(career, playerId);
  if (potential == null) {
    return { success: false, reason: "Could not resolve player potential." };
  }

  const dev = career.playerDevelopment?.[playerId];
  const current = dev?.rating ?? getManagerPlayer(career, playerId)?.peakRating ?? 0;
  if (current >= potential) {
    return {
      success: false,
      reason: "Player is already at their potential rating.",
    };
  }

  const playerDevelopment = {
    ...(career.playerDevelopment ?? {}),
    [playerId]: {
      rating: potential,
      peakRating: Math.max(dev?.peakRating ?? current, potential),
      potential,
      developmentRate: dev?.developmentRate,
      seasonStartRating: dev?.seasonStartRating ?? current,
      promotedSeasonYear: dev?.promotedSeasonYear,
    },
  };

  const player = getManagerPlayer(career, playerId);
  const playerRegistry = { ...(career.playerRegistry ?? {}) };
  if (player) {
    playerRegistry[playerId] = { ...player, peakRating: potential };
  }

  let next: ManagerCareer = {
    ...career,
    playerDevelopment,
    playerRegistry,
    boostUsage: {
      ...usage,
      trainingBoostPlayerIds: [...(usage.trainingBoostPlayerIds ?? []), playerId],
    },
    updatedAt: new Date().toISOString(),
  };

  next = pushInboxMessage(next, {
    id: `boost-training-${usageId}`,
    type: "general",
    title: "Training Boost applied",
    body: `${player?.name ?? "Squad player"} has reached their potential (${potential} OVR).`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    playerId,
    playerName: player?.name,
  });

  return { success: true, career: next };
}

function applyUnlockedPotential(
  career: ManagerCareer,
  reserveId: string,
  usageId: string
): ApplyManagerBoostResult {
  const usage = ensureBoostUsage(career);
  if (usage.unlockedPotentialPlayerIds?.includes(reserveId)) {
    return {
      success: false,
      reason: "Unlocked Potential already used on this reserve.",
    };
  }

  const reserve = career.reserves?.find((r) => r.id === reserveId);
  if (!reserve) {
    return { success: false, reason: "Reserve player not found." };
  }
  if (reserve.rating >= reserve.potentialRating) {
    return {
      success: false,
      reason: "Reserve is already at their potential rating.",
    };
  }

  const reserves = career.reserves!.map((r) =>
    r.id === reserveId
      ? {
          ...r,
          rating: reserve.potentialRating,
          baseRating: reserve.potentialRating,
        }
      : r
  );

  let next: ManagerCareer = {
    ...career,
    reserves,
    boostUsage: {
      ...usage,
      unlockedPotentialPlayerIds: [
        ...(usage.unlockedPotentialPlayerIds ?? []),
        reserveId,
      ],
    },
    updatedAt: new Date().toISOString(),
  };

  next = pushInboxMessage(next, {
    id: `boost-unlock-${usageId}`,
    type: "reserve_report",
    title: "Potential unlocked",
    body: `${reserve.name} has reached ${reserve.potentialRating} OVR in the reserve pathway.`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    playerId: reserveId,
    playerName: reserve.name,
  });

  return { success: true, career: next };
}

function applyNoSacking(
  career: ManagerCareer,
  boostId: GameBoostId,
  usageId: string
): ApplyManagerBoostResult {
  if (career.managerProtection?.noSacking) {
    return { success: false, reason: "No Sacking is already active on this save." };
  }

  let next: ManagerCareer = {
    ...career,
    managerProtection: {
      noSacking: true,
      activatedByBoostId: boostId,
      activatedAtSeason: career.seasonYear,
    },
    updatedAt: new Date().toISOString(),
  };

  // Drop stale sack eval so season review re-runs with protection.
  next = invalidateBoardSeasonEvaluation(next);

  next = pushInboxMessage(next, {
    id: `boost-no-sacking-${usageId}`,
    type: "board",
    title: "Sacking protection activated",
    body: "The board cannot dismiss you for the remainder of this Manager save. Expectations and confidence still apply.",
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    sender: "Board",
  });

  return { success: true, career: next };
}

function applyHealAll(career: ManagerCareer): ApplyManagerBoostResult {
  const healedPlayerIds: string[] = [];

  const squad = career.squad.map((p) => {
    if (p.injury && p.injury.type !== "suspension") {
      healedPlayerIds.push(p.playerId);
      return { ...p, injury: null };
    }
    return p;
  });

  type ReserveWithInjury = ManagerReservePlayer & {
    injury?: ManagerInjury | null;
  };

  const reserves = (career.reserves ?? []).map((r) => {
    const reserve = r as ReserveWithInjury;
    if (reserve.injury && reserve.injury.type !== "suspension") {
      healedPlayerIds.push(r.id);
      return { ...reserve, injury: null };
    }
    return r;
  });

  if (healedPlayerIds.length === 0) {
    return {
      success: false,
      reason: "No healable injuries in your senior or reserve squads.",
    };
  }

  return {
    success: true,
    career: {
      ...career,
      squad,
      reserves,
      updatedAt: new Date().toISOString(),
    },
    healedPlayerIds,
  };
}

export function applyManagerBoost(input: {
  boostId: GameBoostId;
  career: ManagerCareer;
  usageId: string;
  playerId?: string;
  reserveId?: string;
}): ApplyManagerBoostResult {
  const { boostId, career, usageId, playerId, reserveId } = input;

  switch (boostId) {
    case "mgr-future-star":
      return applyFutureStar(career, usageId);
    case "mgr-financial-takeover":
      return applyFinancialTakeover(career, usageId);
    case "mgr-training-boost":
      if (!playerId) {
        return { success: false, reason: "Select a senior squad player." };
      }
      return applyTrainingBoost(career, playerId, usageId);
    case "mgr-unlocked-potential":
      if (!reserveId) {
        return { success: false, reason: "Select a reserve player." };
      }
      return applyUnlockedPotential(career, reserveId, usageId);
    case "mgr-no-sacking":
      return applyNoSacking(career, boostId, usageId);
    case "mgr-heal-all":
      return applyHealAll(career);
    default:
      return { success: false, reason: "This boost is not available in Manager Mode." };
  }
}

export function listEligibleTrainingBoostPlayers(
  career: ManagerCareer
): { playerId: string; name: string; rating: number; potential: number }[] {
  const usage = ensureBoostUsage(career);
  const used = new Set(usage.trainingBoostPlayerIds ?? []);
  const out: { playerId: string; name: string; rating: number; potential: number }[] = [];

  for (const ps of career.squad) {
    if (used.has(ps.playerId)) continue;
    const potential = getPlayerPotential(career, ps.playerId);
    const player = getManagerPlayer(career, ps.playerId);
    if (!player || potential == null) continue;
    const dev = career.playerDevelopment?.[ps.playerId];
    const rating = dev?.rating ?? player.peakRating;
    if (rating < potential) {
      out.push({
        playerId: ps.playerId,
        name: player.name,
        rating,
        potential,
      });
    }
  }

  return out.sort((a, b) => b.potential - a.potential);
}

export function listEligibleUnlockedPotentialReserves(
  career: ManagerCareer
): { reserveId: string; name: string; rating: number; potential: number }[] {
  const usage = ensureBoostUsage(career);
  const used = new Set(usage.unlockedPotentialPlayerIds ?? []);
  return (career.reserves ?? [])
    .filter((r) => !used.has(r.id) && r.rating < r.potentialRating)
    .map((r) => ({
      reserveId: r.id,
      name: r.name,
      rating: r.rating,
      potential: r.potentialRating,
    }))
    .sort((a, b) => b.potential - a.potential);
}

export function canApplyManagerBoost(
  boostId: GameBoostId,
  career: ManagerCareer
): { ok: boolean; reason?: string } {
  const usage = ensureBoostUsage(career);
  const seasonKey = managerClubSeasonKey(career);

  switch (boostId) {
    case "mgr-future-star":
      if (usage.futureStarBySeason?.[seasonKey]) {
        return { ok: false, reason: "Already used this club season." };
      }
      return { ok: true };
    case "mgr-financial-takeover":
      if (usage.financialTakeoverBySeason?.[seasonKey]) {
        return { ok: false, reason: "Already used this club season." };
      }
      return { ok: true };
    case "mgr-training-boost":
      if (listEligibleTrainingBoostPlayers(career).length === 0) {
        return { ok: false, reason: "No eligible senior players below potential." };
      }
      return { ok: true };
    case "mgr-unlocked-potential":
      if (listEligibleUnlockedPotentialReserves(career).length === 0) {
        return { ok: false, reason: "No eligible reserves below potential." };
      }
      return { ok: true };
    case "mgr-no-sacking":
      if (career.managerProtection?.noSacking) {
        return { ok: false, reason: "Already active on this save." };
      }
      return { ok: true };
    case "mgr-heal-all": {
      const seniorInjured = career.squad.some(
        (p) => p.injury && p.injury.type !== "suspension"
      );
      const reserveInjured = (career.reserves ?? []).some((r) => {
        const reserve = r as typeof r & { injury?: { type: string } | null };
        return reserve.injury && reserve.injury.type !== "suspension";
      });
      if (!seniorInjured && !reserveInjured) {
        return { ok: false, reason: "No healable injuries." };
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: "Not a Manager Mode boost." };
  }
}
