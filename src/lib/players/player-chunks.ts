import type { Player } from "../types";
import { isGameplayYearCard } from "./year-card";
import { isHiddenPlayer } from "./goat";
import { isSuperLeagueEligiblePlayer } from "./super-league-eligibility";
import { isYearPinnedPlayer } from "./year-card";

type RawPlayer = Record<string, unknown>;

/** Dynamic imports — separate webpack chunks per pool. */
export async function loadHistoricPlayersRaw(): Promise<RawPlayer[]> {
  const mod = await import("../../../data/historic-players.json");
  return mod.default as RawPlayer[];
}

export async function loadLegendsRaw(): Promise<RawPlayer[]> {
  const mod = await import("../../../data/legends.json");
  return mod.default as RawPlayer[];
}

export async function loadCurrentSquadsRaw(): Promise<RawPlayer[]> {
  try {
    const { loadAllCurrentClubChunks } = await import(
      "./generated/current-chunk-imports"
    );
    return loadAllCurrentClubChunks();
  } catch {
    const mod = await import("../../../data/current-squads.json");
    return mod.default as RawPlayer[];
  }
}

export async function loadAllPlayerRawRows(): Promise<{
  current: RawPlayer[];
  historic: RawPlayer[];
  legends: RawPlayer[];
}> {
  const [current, historic, legends] = await Promise.all([
    loadCurrentSquadsRaw(),
    loadHistoricPlayersRaw(),
    loadLegendsRaw(),
  ]);
  return { current, historic, legends };
}

export function filterGameplayPool(all: Player[]): Player[] {
  return all.filter(
    (p) =>
      !isHiddenPlayer(p) &&
      p.availableInGame !== false &&
      isYearPinnedPlayer(p) &&
      isGameplayYearCard(p)
  );
}

export function filterRecruitablePool(all: Player[]): Player[] {
  return filterGameplayPool(all).filter(isSuperLeagueEligiblePlayer);
}
