import { POSITION_SHORT } from "../positions";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import { assignPlayerToMatchday, type MatchdaySlotTarget } from "./managerMatchdaySquad";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
  isCalledUpReserve,
} from "./managerPlayers";
import { callUpReserveForNextMatch } from "./managerReserves";
import { isPlayerUnavailable } from "./managerSquad";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";

function ensureReserveCalledUp(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  if (!career.reserves.some((r) => r.id === reserveId)) return career;
  if (isCalledUpReserve(career, reserveId)) return career;
  return callUpReserveForNextMatch(career, reserveId);
}

function assignWithAutoCallUp(
  career: ManagerCareer,
  target: MatchdaySlotTarget,
  playerId: string,
  isReserve: boolean
): ManagerCareer {
  const ready = isReserve ? ensureReserveCalledUp(career, playerId) : career;
  return assignPlayerToMatchday(ready, target, playerId);
}

function rankedSquadForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): string[] {
  return career.squad
    .filter((ps) => !exclude.has(ps.playerId) && !isPlayerUnavailable(ps))
    .map((ps) => {
      const player = getManagerPlayer(career, ps.playerId);
      if (
        !player ||
        !getManagerPlayerEligiblePositions(career, ps.playerId).includes(position)
      ) {
        return null;
      }
      return { id: ps.playerId, rating: player.peakRating };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rating - a.rating)
    .map((c) => c.id);
}

function rankedReservesForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): string[] {
  return career.reserves
    .filter((r) => !exclude.has(r.id))
    .map((r) => {
      const player = getManagerPlayer(career, r.id);
      if (!player) return null;
      if (!getManagerPlayerEligiblePositions(career, r.id).includes(position)) {
        return null;
      }
      return { id: r.id, rating: player.peakRating };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rating - a.rating)
    .map((c) => c.id);
}

function rankedAnyAvailable(
  career: ManagerCareer,
  exclude: Set<string>
): { id: string; isReserve: boolean; rating: number }[] {
  const seniors = career.squad
    .filter((ps) => !exclude.has(ps.playerId) && !isPlayerUnavailable(ps))
    .map((ps) => {
      const player = getManagerPlayer(career, ps.playerId);
      if (!player) return null;
      return { id: ps.playerId, isReserve: false, rating: player.peakRating };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const reserves = career.reserves
    .filter((r) => !exclude.has(r.id))
    .map((r) => {
      const player = getManagerPlayer(career, r.id);
      if (!player) return null;
      return { id: r.id, isReserve: true, rating: player.peakRating };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return [...seniors, ...reserves].sort((a, b) => b.rating - a.rating);
}

function createEmptyMatchdayState(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    calledUpReserveIds: [],
    matchdayXiii: career.xiiiSlotPositions.map(() => ""),
    matchdayInterchange: Array(ERA_BENCH_FROM_STARTING_17).fill(""),
    reserves: career.reserves.map((r) => ({
      ...r,
      calledUpForNextMatch: false,
    })),
  };
}

function buildOptimalMatchdaySquad(career: ManagerCareer): {
  ok: boolean;
  career: ManagerCareer;
  actions: string[];
  error?: string;
} {
  let working = createEmptyMatchdayState(career);
  const used = new Set<string>();
  const actions: string[] = [];

  // 1) Fill XIII — seniors first, then position-matched reserves (auto call-up).
  for (let i = 0; i < working.matchdayXiii.length; i++) {
    const pos = working.xiiiSlotPositions[i];
    if (!pos) continue;

    const senior = rankedSquadForPosition(working, pos, used)[0];
    if (senior) {
      working = assignWithAutoCallUp(
        working,
        { kind: "xiii", index: i },
        senior,
        false
      );
      used.add(senior);
      const name = getManagerPlayer(working, senior)?.name ?? "Player";
      actions.push(`${name} (${POSITION_SHORT[pos]})`);
      continue;
    }

    const reserve = rankedReservesForPosition(working, pos, used)[0];
    if (reserve) {
      working = assignWithAutoCallUp(
        working,
        { kind: "xiii", index: i },
        reserve,
        true
      );
      used.add(reserve);
      const name = getManagerPlayer(working, reserve)?.name ?? "Player";
      actions.push(`${name} (${POSITION_SHORT[pos]})`);
      continue;
    }

    return {
      ok: false,
      career: working,
      actions,
      error: `Could not fill ${POSITION_SHORT[pos]} — call up or recruit a ${POSITION_SHORT[pos]}.`,
    };
  }

  // 2) Fill bench — any remaining senior or reserve (auto call-up).
  for (let i = 0; i < ERA_BENCH_FROM_STARTING_17; i++) {
    const pick = rankedAnyAvailable(working, used)[0];
    if (!pick) break;

    working = assignWithAutoCallUp(
      working,
      { kind: "bench", index: i },
      pick.id,
      pick.isReserve
    );
    used.add(pick.id);
    const name = getManagerPlayer(working, pick.id)?.name ?? "Player";
    actions.push(`${name} (INT)`);
  }

  const finalCheck = validateFitMatchdaySquad(working);
  if (!finalCheck.valid) {
    return {
      ok: false,
      career: working,
      actions,
      error: finalCheck.missing.join(", "),
    };
  }

  return { ok: true, career: working, actions };
}

export function autoFixMatchdaySquad(career: ManagerCareer): {
  ok: boolean;
  career: ManagerCareer;
  message: string;
} {
  const initial = validateFitMatchdaySquad(career);
  if (initial.valid && !hasUnavailablePlayersInLineup(career)) {
    return { ok: true, career, message: "Squad already valid." };
  }

  const result = buildOptimalMatchdaySquad(career);
  if (!result.ok) {
    return {
      ok: false,
      career: result.career,
      message: result.error
        ? `Auto Fix could not complete the squad: ${result.error}`
        : "Auto Fix could not complete the squad.",
    };
  }

  const message =
    result.actions.length > 0
      ? `Auto Fix complete: ${result.actions.slice(0, 5).join(", ")}${result.actions.length > 5 ? "…" : ""}.`
      : "Auto Fix complete.";

  return { ok: true, career: result.career, message };
}

/** Pick the strongest available XI + bench regardless of current lineup. */
export function autoSortMatchdaySquad(career: ManagerCareer): {
  ok: boolean;
  career: ManagerCareer;
  message: string;
} {
  const result = buildOptimalMatchdaySquad(career);
  if (!result.ok) {
    return {
      ok: false,
      career: result.career,
      message: result.error
        ? `Auto Sort incomplete: ${result.error}`
        : "Auto Sort could not complete the squad.",
    };
  }

  return {
    ok: true,
    career: result.career,
    message:
      result.actions.length > 0
        ? `Best XI selected: ${result.actions.slice(0, 5).join(", ")}${result.actions.length > 5 ? "…" : ""}.`
        : "Lineup sorted.",
  };
}

/** Best available matchday lineup for simulation (auto-replaces injured/unavailable). */
export function resolveCareerForMatchSimulation(
  career: ManagerCareer
): ManagerCareer {
  const result = autoFixMatchdaySquad(career);
  return result.ok ? result.career : career;
}

export function hasUnavailablePlayersInLineup(career: ManagerCareer): boolean {
  for (const id of [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]) {
    if (!id) continue;
    const ps = career.squad.find((p) => p.playerId === id);
    if (ps && isPlayerUnavailable(ps)) return true;
  }
  return false;
}
