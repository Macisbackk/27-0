import type { Player } from "../types";
import { normalizePlayer } from "./normalize";
import { getEligiblePositions } from "./player-positions";
import { isHiddenPlayer } from "./goat";
import { isGameplayYearCard } from "./year-card";

type RawPlayer = Record<string, unknown>;

export interface PlayerRegistry {
  all: Player[];
  current: Player[];
  historic: Player[];
  legends: Player[];
  byId: Map<string, Player>;
}

/** Year cards often store only a single primary position — inherit richer dual roles from related cards. */
function inheritPositionsFromBasePlayers(byId: Map<string, Player>): void {
  const richestByBase = new Map<string, import("../types").Position[]>();
  const richestByName = new Map<string, import("../types").Position[]>();

  for (const player of byId.values()) {
    const baseId = player.basePlayerId ?? player.id;
    const eligible = getEligiblePositions(player);
    const nameKey = player.name.toLowerCase().trim();

    const existingBase = richestByBase.get(baseId);
    if (!existingBase || eligible.length > existingBase.length) {
      richestByBase.set(baseId, eligible);
    }

    const existingName = richestByName.get(nameKey);
    if (!existingName || eligible.length > existingName.length) {
      richestByName.set(nameKey, eligible);
    }
  }

  for (const player of byId.values()) {
    const baseId = player.basePlayerId ?? player.id;
    const nameKey = player.name.toLowerCase().trim();
    const richest = richestByBase.get(baseId) ?? richestByName.get(nameKey);
    if (!richest) continue;

    const current = getEligiblePositions(player);
    if (richest.length <= current.length) continue;

    player.positions = [...new Set([...current, ...richest])];
  }
}

export function buildPlayerRegistry(
  currentSquads: RawPlayer[],
  historicPlayers: RawPlayer[],
  legends: RawPlayer[]
): PlayerRegistry {
  const legendIds = new Set(legends.map((p) => p.id as string));

  const current = currentSquads.map(normalizePlayer);
  const historicRaw = historicPlayers
    .filter((p) => !legendIds.has(p.id as string))
    .map(normalizePlayer);
  const legendPlayers = legends.map(normalizePlayer);

  const byId = new Map<string, Player>();
  const pool: Player[] = [];

  for (const p of [...current, ...historicRaw, ...legendPlayers]) {
    byId.set(p.id, p);
  }

  inheritPositionsFromBasePlayers(byId);

  for (const p of current) {
    if (!isHiddenPlayer(p) && isGameplayYearCard(p)) pool.push(p);
  }

  for (const p of [...historicRaw, ...legendPlayers]) {
    if (isHiddenPlayer(p)) continue;
    if (p.availableInGame === false) continue;
    if (!isGameplayYearCard(p)) continue;
    pool.push(p);
  }

  const all = pool;

  return {
    all,
    current: all.filter((p) => p.category === "current"),
    historic: all.filter((p) => p.category === "historic"),
    legends: all.filter((p) => p.category === "legend"),
    byId,
  };
}

export function replacePlayerArray(target: Player[], next: Player[]): void {
  target.length = 0;
  target.push(...next);
}

export function applyPlayerRegistry(
  target: {
    all: Player[];
    current: Player[];
    historic: Player[];
    legends: Player[];
    byId: Map<string, Player>;
  },
  registry: PlayerRegistry
): void {
  replacePlayerArray(target.all, registry.all);
  replacePlayerArray(target.current, registry.current);
  replacePlayerArray(target.historic, registry.historic);
  replacePlayerArray(target.legends, registry.legends);
  target.byId.clear();
  for (const [id, player] of registry.byId) {
    target.byId.set(id, player);
  }
}
