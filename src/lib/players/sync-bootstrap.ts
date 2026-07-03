import currentSquads from "../../../data/current-squads.json";
import historicPlayers from "../../../data/historic-players.json";
import legends from "../../../data/legends.json";
import { buildPlayerRegistry } from "./registry";

/** Synchronous registry bootstrap for SSR and tooling. */
export function buildSyncPlayerRegistry() {
  return buildPlayerRegistry(
    currentSquads as Record<string, unknown>[],
    historicPlayers as Record<string, unknown>[],
    legends as Record<string, unknown>[]
  );
}
