import { canPlayPosition } from "../players/player-positions";
import { POSITION_SHORT } from "../positions";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import { assignPlayerToMatchday } from "./managerMatchdaySquad";
import { getManagerPlayer, getManagerPlayerEligiblePositions } from "./managerPlayers";
import { isPlayerUnavailable } from "./managerSquad";
import { callUpReserveForNextMatch } from "./managerReserves";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_XIII_FROM_STARTING_17,
} from "../players/era-starting-17s";

function lineupIds(career: ManagerCareer): Set<string> {
  return new Set(
    [
      ...career.matchdayXiii,
      ...career.matchdayInterchange,
    ].filter(Boolean)
  );
}

function bestReserveForPosition(
  career: ManagerCareer,
  position: Position,
  exclude: Set<string>
): string | null {
  const candidates = career.reserves
    .filter((r) => !exclude.has(r.id))
    .filter((r) => r.fitness >= 50)
    .filter((r) => !r.calledUpForNextMatch || career.calledUpReserveIds.includes(r.id))
    .map((r) => {
      const player = getManagerPlayer(career, r.id);
      if (!player) return null;
      if (!canPlayPosition(player, position)) return null;
      return { id: r.id, rating: r.rating, name: r.name };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rating - a.rating);

  return candidates[0]?.id ?? null;
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

  let working = { ...career };
  const actions: string[] = [];
  const used = lineupIds(working);

  const clearUnavailable = () => {
    let xiii = [...working.matchdayXiii];
    let bench = [...working.matchdayInterchange];
    for (let i = 0; i < xiii.length; i++) {
      const id = xiii[i];
      if (!id) continue;
      const ps = working.squad.find((p) => p.playerId === id);
      const reserve = working.reserves.find((r) => r.id === id);
      if (ps && isPlayerUnavailable(ps)) {
        xiii[i] = "";
        used.delete(id);
      }
      if (reserve && reserve.fitness < 50) {
        xiii[i] = "";
        used.delete(id);
      }
    }
    for (let i = 0; i < bench.length; i++) {
      const id = bench[i];
      if (!id) continue;
      const ps = working.squad.find((p) => p.playerId === id);
      const reserve = working.reserves.find((r) => r.id === id);
      if (ps && isPlayerUnavailable(ps)) {
        bench[i] = "";
        used.delete(id);
      }
      if (reserve && reserve.fitness < 50) {
        bench[i] = "";
        used.delete(id);
      }
    }
    working = { ...working, matchdayXiii: xiii, matchdayInterchange: bench };
  };

  clearUnavailable();

  for (let i = 0; i < working.matchdayXiii.length; i++) {
    const pos = working.xiiiSlotPositions[i];
    const id = working.matchdayXiii[i];
    if (!pos) continue;

    const needsReplace =
      !id ||
      !getManagerPlayer(working, id) ||
      !getManagerPlayerEligiblePositions(working, id).includes(pos);

    if (!needsReplace) continue;

    const reserveId = bestReserveForPosition(working, pos, used);
    if (!reserveId) {
      return {
        ok: false,
        career: working,
        message: `Auto Fix could not complete the squad. No fit reserve ${POSITION_SHORT[pos]} available.`,
      };
    }

    working = callUpReserveForNextMatch(working, reserveId);
    working = assignPlayerToMatchday(working, { kind: "xiii", index: i }, reserveId);
    used.add(reserveId);
    const name = working.reserves.find((r) => r.id === reserveId)?.name ?? "Reserve";
    actions.push(`${name} at ${POSITION_SHORT[pos]}`);
  }

  let bench = [...working.matchdayInterchange];
  while (bench.length < ERA_BENCH_FROM_STARTING_17) bench.push("");
  bench = bench.slice(0, ERA_BENCH_FROM_STARTING_17);

  for (let i = 0; i < ERA_BENCH_FROM_STARTING_17; i++) {
    if (bench[i]) continue;
    const reserve = [...working.reserves]
      .filter((r) => !used.has(r.id))
      .filter((r) => r.fitness >= 50)
      .sort((a, b) => b.rating - a.rating)[0];
    if (!reserve) {
      return {
        ok: false,
        career: working,
        message:
          "Auto Fix could not complete the squad. Not enough fit reserves for interchange.",
      };
    }
    working = callUpReserveForNextMatch(working, reserve.id);
    working = assignPlayerToMatchday(working, { kind: "bench", index: i }, reserve.id);
    used.add(reserve.id);
    actions.push(`${reserve.name} (INT)`);
  }

  working = {
    ...working,
    matchdayInterchange: bench,
  };

  const finalCheck = validateFitMatchdaySquad(working);
  if (!finalCheck.valid) {
    return {
      ok: false,
      career: working,
      message: `Auto Fix incomplete: ${finalCheck.missing.join(", ")}.`,
    };
  }

  const message =
    actions.length > 0
      ? `Auto Fix complete: called up ${actions.join(", ")}.`
      : "Auto Fix complete.";

  return { ok: true, career: working, message };
}
