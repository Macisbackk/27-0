import type { MiniGamePlayer } from "./players";

/** Current Super League cards vs historic/era cards. */
export type MiniGamePoolMode = "current" | "era";

export function isMiniGamePoolMode(value: unknown): value is MiniGamePoolMode {
  return value === "current" || value === "era";
}

export function filterPoolByMode(
  pool: readonly MiniGamePlayer[],
  mode: MiniGamePoolMode
): MiniGamePlayer[] {
  return pool.filter((player) =>
    mode === "current" ? !player.isHistoric : player.isHistoric
  );
}

export const MINI_GAME_POOL_MODE_LABEL: Record<MiniGamePoolMode, string> = {
  current: "Current",
  era: "Era",
};

export const MINI_GAME_POOL_MODE_BLURB: Record<MiniGamePoolMode, string> = {
  current: "Today's Super League players and clubs.",
  era: "Historic Super League cards and legends.",
};
