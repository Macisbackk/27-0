// Slim copies of the data/*.json player files: only what normalizePlayer reads
// (npm run build:runtime-player-data; regenerated automatically before every build).
import currentSquads from "./generated/current.runtime.json";
import historicPlayers from "./generated/historic.runtime.json";
import legends from "./generated/legends.runtime.json";
import { buildPlayerRegistry } from "./registry";

/** Synchronous registry bootstrap for SSR and tooling. */
export function buildSyncPlayerRegistry() {
  return buildPlayerRegistry(
    currentSquads as Record<string, unknown>[],
    historicPlayers as Record<string, unknown>[],
    legends as Record<string, unknown>[]
  );
}

/** The raw rows behind buildSyncPlayerRegistry (for the sliced client build). */
export function getSyncRawPlayerRows(): {
  current: Record<string, unknown>[];
  historic: Record<string, unknown>[];
  legends: Record<string, unknown>[];
} {
  return {
    current: currentSquads as Record<string, unknown>[],
    historic: historicPlayers as Record<string, unknown>[],
    legends: legends as Record<string, unknown>[],
  };
}
