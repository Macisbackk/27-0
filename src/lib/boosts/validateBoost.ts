import type { GameBoostId } from "./boostDefinitions";
import { getBoostDefinition } from "./boostDefinitions";
import {
  getArmedBoostsForGame,
  getBoostQuantity,
  type ActiveGameBoost,
} from "./boostInventory";

export interface BoostValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateBoostOwned(boostId: GameBoostId): BoostValidationResult {
  if (!getBoostDefinition(boostId)) {
    return { ok: false, reason: "Unknown boost." };
  }
  if (getBoostQuantity(boostId) < 1) {
    return { ok: false, reason: "You do not own this boost." };
  }
  return { ok: true };
}

export function validateBoostCategory(
  boostId: GameBoostId,
  expected: "quick-mode" | "manager-mode"
): BoostValidationResult {
  const def = getBoostDefinition(boostId);
  if (!def) return { ok: false, reason: "Unknown boost." };
  const owned = validateBoostOwned(boostId);
  if (!owned.ok) return owned;
  if (def.category !== expected) {
    return {
      ok: false,
      reason:
        expected === "quick-mode"
          ? "Manager Mode boosts cannot be used in Quick Modes."
          : "Quick Mode boosts cannot be used in Manager Mode.",
    };
  }
  return { ok: true };
}

export function validateQuickModeSelectionBoost(
  boostId: GameBoostId,
  gameSaveId: string,
  selectionBoostsUsedThisRun: number
): BoostValidationResult {
  const base = validateBoostCategory(boostId, "quick-mode");
  if (!base.ok) return base;
  const def = getBoostDefinition(boostId)!;
  if (def.activationStage !== "quick-mode-before-player-choice") {
    return { ok: false, reason: "This boost is not a selection boost." };
  }
  if (selectionBoostsUsedThisRun >= 2) {
    return {
      ok: false,
      reason: "Maximum two Quick Mode selection boosts per run.",
    };
  }
  const alreadyArmed = getArmedBoostsForGame(gameSaveId).some((a) => {
    const d = getBoostDefinition(a.boostId);
    return (
      a.status === "armed" &&
      d?.activationStage === "quick-mode-before-player-choice"
    );
  });
  if (alreadyArmed) {
    return {
      ok: false,
      reason: "A selection boost is already armed for this choice.",
    };
  }
  return { ok: true };
}

export function getArmedSelectionBoost(
  gameSaveId: string
): ActiveGameBoost | undefined {
  return getArmedBoostsForGame(gameSaveId).find((a) => {
    const d = getBoostDefinition(a.boostId);
    return (
      a.status === "armed" &&
      d?.activationStage === "quick-mode-before-player-choice"
    );
  });
}
