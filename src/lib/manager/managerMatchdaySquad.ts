import type { Position } from "../types";
import { canPlayPosition } from "../players/player-positions";
import type { ManagerCareer } from "./types";
import { getManagerPlayer } from "./managerPlayers";
import { isPlayerUnavailable } from "./managerSquad";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";

export type MatchdaySlotTarget =
  | { kind: "xiii"; index: number }
  | { kind: "bench"; index: number };

export type ReplacementSource = "bench" | "xiii" | "available";

export interface ReplacementCandidate {
  playerId: string;
  source: ReplacementSource;
  benchIndex?: number;
  xiiiIndex?: number;
  isReserveCallUp?: boolean;
}

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
  if (reserve) {
    return canPlayPosition(player, position);
  }

  return canPlayPosition(player, position);
}

function normalizeBench(career: ManagerCareer): string[] {
  const bench = [...career.matchdayInterchange];
  while (bench.length < ERA_BENCH_FROM_STARTING_17) bench.push("");
  return bench.slice(0, ERA_BENCH_FROM_STARTING_17);
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
  const bench = normalizeBench(career);

  const fromBenchIdx = bench.findIndex((id) => id === playerId);
  const fromXiiiIdx = xiii.findIndex((id) => id === playerId);

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
      if (fromBenchIdx >= 0) {
        bench[fromBenchIdx] = displaced;
      } else {
        const emptyBench = bench.findIndex((id) => !id);
        if (emptyBench >= 0) bench[emptyBench] = displaced;
      }
    }
  } else {
    const displaced = bench[target.index] ?? "";
    bench[target.index] = playerId;

    if (fromXiiiIdx >= 0) {
      if (displaced && displaced !== playerId) {
        xiii[fromXiiiIdx] = displaced;
      } else {
        xiii[fromXiiiIdx] = "";
      }
    }
  }

  return {
    ...career,
    matchdayXiii: xiii,
    matchdayInterchange: bench,
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
    if (r.calledUpForNextMatch || career.calledUpReserveIds.includes(r.id)) {
      list.push({ playerId: r.id, isReserveCallUp: true });
    }
  }

  return list;
}

/** All squad players not in the starting 17 or interchange. */
export function getSquadPoolPlayers(career: ManagerCareer): {
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
    if (
      !r.calledUpForNextMatch &&
      !career.calledUpReserveIds.includes(r.id)
    ) {
      continue;
    }
    list.push({ playerId: r.id, isReserveCallUp: true });
  }

  return list.sort((a, b) => {
    const ra = getManagerPlayer(career, a.playerId)?.rating ?? 0;
    const rb = getManagerPlayer(career, b.playerId)?.rating ?? 0;
    return rb - ra;
  });
}

/** Players eligible to replace a selected slot (includes interchange ↔ starter swaps). */
export function getReplacementCandidates(
  career: ManagerCareer,
  target: MatchdaySlotTarget
): ReplacementCandidate[] {
  const inTarget = new Set<string>();
  const candidates: ReplacementCandidate[] = [];
  const seen = new Set<string>();

  const add = (c: ReplacementCandidate) => {
    if (seen.has(c.playerId)) return;
    seen.add(c.playerId);
    candidates.push(c);
  };

  if (target.kind === "xiii") {
    career.matchdayInterchange.forEach((id, benchIndex) => {
      if (!id) return;
      add({ playerId: id, source: "bench", benchIndex });
    });
  } else {
    career.matchdayXiii.forEach((id, xiiiIndex) => {
      if (!id) return;
      add({ playerId: id, source: "xiii", xiiiIndex });
    });
  }

  for (const { playerId, isReserveCallUp } of getSquadPoolPlayers(career)) {
    add({ playerId, source: "available", isReserveCallUp });
  }

  return candidates.filter((c) => {
    if (target.kind === "xiii") {
      return canAssignPlayerToXiiiSlot(career, target.index, c.playerId);
    }
    return true;
  });
}

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

export function findPlayerMatchdaySlot(
  career: ManagerCareer,
  playerId: string
): MatchdaySlotTarget | null {
  const xiiiIdx = career.matchdayXiii.findIndex((id) => id === playerId);
  if (xiiiIdx >= 0) return { kind: "xiii", index: xiiiIdx };
  const benchIdx = career.matchdayInterchange.findIndex((id) => id === playerId);
  if (benchIdx >= 0) return { kind: "bench", index: benchIdx };
  return null;
}
