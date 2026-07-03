import { canPlayPosition } from "../players/player-positions";
import { POSITION_SHORT } from "../positions";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import { assignPlayerToMatchday } from "./managerMatchdaySquad";
import { getManagerPlayer, isCalledUpReserve } from "./managerPlayers";
import { isPlayerUnavailable } from "./managerSquad";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";

function bestSquadPlayerForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): string | null {
  const candidates = career.squad
    .filter((ps) => !exclude.has(ps.playerId))
    .filter((ps) => !isPlayerUnavailable(ps))
    .map((ps) => {
      const player = getManagerPlayer(career, ps.playerId);
      if (!player || !canPlayPosition(player, position)) return null;
      return {
        id: ps.playerId,
        rating: player.peakRating,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rating - a.rating);

  return candidates[0]?.id ?? null;
}

function bestReserveForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): string | null {
  const candidates = career.reserves
    .filter((r) => !exclude.has(r.id))
    .filter((r) => isCalledUpReserve(career, r.id))
    .map((r) => {
      const player = getManagerPlayer(career, r.id);
      if (!player) return null;
      if (!canPlayPosition(player, position)) return null;
      return { id: r.id, rating: r.rating };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rating - a.rating);

  return candidates[0]?.id ?? null;
}

function bestPlayerForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): { id: string; isReserve: boolean } | null {
  const squadId = bestSquadPlayerForPosition(career, position, exclude);
  if (squadId) return { id: squadId, isReserve: false };
  const reserveId = bestReserveForPosition(career, position, exclude);
  if (reserveId) return { id: reserveId, isReserve: true };
  return null;
}

function createEmptyMatchdayState(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    matchdayXiii: career.xiiiSlotPositions.map(() => ""),
    matchdayInterchange: Array(ERA_BENCH_FROM_STARTING_17).fill(""),
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

  for (let i = 0; i < working.matchdayXiii.length; i++) {
    const pos = working.xiiiSlotPositions[i];
    if (!pos) continue;

    const pick = bestPlayerForPosition(working, pos, used);
    if (!pick) {
      return {
        ok: false,
        career: working,
        actions,
        error: `Could not fill ${POSITION_SHORT[pos]}.`,
      };
    }

    working = assignPlayerToMatchday(
      working,
      { kind: "xiii", index: i },
      pick.id
    );
    used.add(pick.id);
    const name = getManagerPlayer(working, pick.id)?.name ?? "Player";
    actions.push(`${name} (${POSITION_SHORT[pos]})`);
  }

  for (let i = 0; i < ERA_BENCH_FROM_STARTING_17; i++) {
    const squadBench = [...working.squad]
      .filter((ps) => !used.has(ps.playerId))
      .filter((ps) => !isPlayerUnavailable(ps))
      .map((ps) => {
        const player = getManagerPlayer(working, ps.playerId);
        if (!player) return null;
        return {
          id: ps.playerId,
          rating: player.peakRating,
          isReserve: false,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const reserveBench = [...working.reserves]
      .filter((r) => !used.has(r.id))
      .filter((r) => isCalledUpReserve(working, r.id))
      .map((r) => ({ id: r.id, rating: r.rating, isReserve: true }));

    const pick = [...squadBench, ...reserveBench].sort(
      (a, b) => b.rating - a.rating
    )[0];

    if (!pick) break;

    working = assignPlayerToMatchday(
      working,
      { kind: "bench", index: i },
      pick.id
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
  if (initial.valid) {
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
export function resolveCareerForMatchSimulation(career: ManagerCareer): ManagerCareer {
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
