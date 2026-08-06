/**
 * Quick Mode pre-game boost selection — armed before any spin begins.
 */
import type { GameBoostId } from "@/lib/boosts/boostDefinitions";

export const QUICK_MODE_PRE_GAME_BOOST_VERSION = 1;

/** BoostedSpinPlan schema version used with QM selection boosts. */
export const boostedSpinPlanVersion = 2;

export type QuickModePreGameBoostStatus =
  | "unselected"
  | "armed"
  | "applied"
  | "consumed"
  | "failed"
  | "skipped";

export type QuickModePreGameBoostState = {
  selectedBoostId: GameBoostId | null;
  status: QuickModePreGameBoostStatus;
  runId: string;
  version: number;
};

export const QM_SELECTION_BOOST_IDS = [
  "qm-90-plus-player",
  "qm-goat-hall-of-fame",
] as const satisfies readonly GameBoostId[];

export type QmSelectionBoostId = (typeof QM_SELECTION_BOOST_IDS)[number];

export function isQmSelectionBoostId(
  id: string
): id is QmSelectionBoostId {
  return (QM_SELECTION_BOOST_IDS as readonly string[]).includes(id);
}

export function createUnselectedPreGameBoost(
  runId: string
): QuickModePreGameBoostState {
  return {
    selectedBoostId: null,
    status: "unselected",
    runId,
    version: QUICK_MODE_PRE_GAME_BOOST_VERSION,
  };
}

export function armPreGameBoost(
  runId: string,
  boostId: GameBoostId | null
): QuickModePreGameBoostState {
  if (!boostId) {
    return {
      selectedBoostId: null,
      status: "skipped",
      runId,
      version: QUICK_MODE_PRE_GAME_BOOST_VERSION,
    };
  }
  return {
    selectedBoostId: boostId,
    status: "armed",
    runId,
    version: QUICK_MODE_PRE_GAME_BOOST_VERSION,
  };
}

export function isPreGameBoostReady(
  state: QuickModePreGameBoostState | null
): boolean {
  if (!state) return false;
  return (
    state.status === "armed" ||
    state.status === "skipped" ||
    state.status === "applied" ||
    state.status === "consumed" ||
    state.status === "failed"
  );
}
