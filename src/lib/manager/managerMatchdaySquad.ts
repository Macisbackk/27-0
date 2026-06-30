import type { Position } from "../types";
import { canPlayPosition } from "../players/player-positions";
import type { ManagerCareer } from "./types";
import { getManagerPlayer } from "./managerPlayers";
import { isPlayerUnavailable } from "./managerSquad";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";

export type MatchdaySlotTarget =
  | { kind: "xiii"; index: number }
  | { kind: "bench"; index: number };

export function canAssignPlayerToXiiiSlot(
  career: ManagerCareer,
  slotIndex: number,
  playerId: string
): boolean {
  const position = career.xiiiSlotPositions[slotIndex];
  const player = getManagerPlayer(career, playerId);
  if (!position || !player) return false;

  const ps = career.squad.find((p) => p.playerId === playerId);
  if (ps && isPlayerUnavailable(ps)) return false;

  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve && reserve.fitness < 50) return false;

  return canPlayPosition(player, position);
}

export function assignPlayerToMatchday(
  career: ManagerCareer,
  target: MatchdaySlotTarget,
  playerId: string
): ManagerCareer {
  if (target.kind === "xiii" && !canAssignPlayerToXiiiSlot(career, target.index, playerId)) {
    return career;
  }

  const xiii = [...career.matchdayXiii];
  const bench = [...career.matchdayInterchange];
  while (bench.length < ERA_BENCH_FROM_STARTING_17) bench.push("");

  const clearFromLineup = (id: string) => {
    for (let i = 0; i < xiii.length; i++) {
      if (xiii[i] === id) xiii[i] = "";
    }
    for (let i = 0; i < bench.length; i++) {
      if (bench[i] === id) bench[i] = "";
    }
  };

  clearFromLineup(playerId);

  if (target.kind === "xiii") {
    const displaced = xiii[target.index] ?? "";
    xiii[target.index] = playerId;
    if (displaced && displaced !== playerId) {
      const emptyBench = bench.findIndex((id) => !id);
      if (emptyBench >= 0) bench[emptyBench] = displaced;
    }
  } else {
    bench[target.index] = playerId;
  }

  return {
    ...career,
    matchdayXiii: xiii,
    matchdayInterchange: bench.slice(0, ERA_BENCH_FROM_STARTING_17),
  };
}

export function getMatchdayPlayerIds(career: ManagerCareer): Set<string> {
  return new Set(
    [
      ...career.matchdayXiii,
      ...career.matchdayInterchange,
    ].filter(Boolean)
  );
}

export function getAvailableSquadPlayers(career: ManagerCareer): {
  playerId: string;
  isReserveCallUp: boolean;
}[] {
  const inLineup = getMatchdayPlayerIds(career);
  const list: { playerId: string; isReserveCallUp: boolean }[] = [];

  for (const ps of career.squad) {
    if (inLineup.has(ps.playerId) || isPlayerUnavailable(ps)) continue;
    list.push({ playerId: ps.playerId, isReserveCallUp: false });
  }

  for (const r of career.reserves) {
    if (inLineup.has(r.id)) continue;
    if (r.fitness < 50) continue;
    if (r.calledUpForNextMatch || career.calledUpReserveIds.includes(r.id)) {
      list.push({ playerId: r.id, isReserveCallUp: true });
    }
  }

  return list;
}

/** Team sheet row layout — slot indices into matchdayXiii. */
export const TEAM_SHEET_ROWS: { slots: number[] }[] = [
  { slots: [0] },
  { slots: [1, 3, 4, 2] },
  { slots: [5, 6] },
  { slots: [7, 9, 8] },
  { slots: [10, 11] },
  { slots: [12] },
];

export function slotAbbrev(position: Position): string {
  const map: Record<Position, string> = {
    FULLBACK: "FB",
    WING: "WG",
    CENTRE: "CE",
    STAND_OFF: "SO",
    SCRUM_HALF: "SH",
    PROP: "PF",
    HOOKER: "HK",
    SECOND_ROW: "SR",
    LOOSE_FORWARD: "LF",
  };
  return map[position];
}
