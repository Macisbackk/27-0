"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  applyManagerBoost,
  canApplyManagerBoost,
  listEligibleTrainingBoostPlayers,
  listEligibleUnlockedPotentialReserves,
} from "@/lib/boosts/applyManagerBoost";
import {
  getBoostDefinition,
  getManagerModeBoosts,
  type BoostActivationStage,
  type GameBoost,
  type GameBoostId,
} from "@/lib/boosts/boostDefinitions";
import { getBoostQuantity, tryConsumeBoostFromInventory } from "@/lib/boosts/boostInventory";
import { validateBoostOwned } from "@/lib/boosts/validateBoost";
import type { ManagerCareer } from "@/lib/manager/types";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerSectionCard } from "@/components/manager/manager-ui";
import { playUiClick } from "@/lib/sound";

const ALL_MANAGER_STAGES: BoostActivationStage[] = [
  "manager-career",
  "manager-squad",
  "manager-reserves",
  "manager-youth-generation",
  "manager-medical",
  "manager-end-season",
];

export type ManagerBoostsStageProp =
  | BoostActivationStage
  | BoostActivationStage[]
  | "all-manager";

interface ManagerBoostsPanelProps {
  career: ManagerCareer;
  stage: ManagerBoostsStageProp;
  onApplied: (career: ManagerCareer) => void;
  compact?: boolean;
  /** Override card title (defaults to Career Boosts / Boosts). */
  title?: string;
}

function stagesForView(stage: ManagerBoostsStageProp): Set<BoostActivationStage> {
  if (stage === "all-manager") {
    return new Set(ALL_MANAGER_STAGES);
  }
  const list = Array.isArray(stage) ? stage : [stage];
  const set = new Set(list);
  if (set.has("manager-career")) {
    set.add("manager-medical");
  }
  if (set.has("manager-squad")) {
    set.add("manager-medical");
  }
  if (set.has("manager-reserves")) {
    set.add("manager-medical");
    set.add("manager-youth-generation");
  }
  return set;
}

export function ManagerBoostsPanel({
  career,
  stage,
  onApplied,
  compact = false,
  title,
}: ManagerBoostsPanelProps) {
  const allowedStages = useMemo(() => stagesForView(stage), [stage]);
  const panelTitle =
    title ?? (stage === "all-manager" ? "Boosts" : "Career Boosts");

  const boosts = useMemo(
    () =>
      getManagerModeBoosts().filter((b: GameBoost) =>
        allowedStages.has(b.activationStage)
      ),
    [allowedStages]
  );

  const [pendingBoost, setPendingBoost] = useState<GameBoostId | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trainingOptions = useMemo(
    () => listEligibleTrainingBoostPlayers(career),
    [career]
  );
  const reserveOptions = useMemo(
    () => listEligibleUnlockedPotentialReserves(career),
    [career]
  );

  const ownedBoosts = boosts.filter((b: GameBoost) => getBoostQuantity(b.id) > 0);
  const alwaysShow = stage === "all-manager" || Boolean(title);

  if (
    ownedBoosts.length === 0 &&
    !career.managerProtection?.noSacking &&
    !alwaysShow
  ) {
    return null;
  }

  const handleApply = (boostId: GameBoostId) => {
    setError(null);
    const owned = validateBoostOwned(boostId);
    if (!owned.ok) {
      setError(owned.reason ?? "Boost not owned.");
      return;
    }
    const eligibility = canApplyManagerBoost(boostId, career);
    if (!eligibility.ok) {
      setError(eligibility.reason ?? "Cannot apply boost.");
      return;
    }

    if (boostId === "mgr-training-boost" && !selectedPlayerId) {
      setPendingBoost(boostId);
      return;
    }
    if (boostId === "mgr-unlocked-potential" && !selectedReserveId) {
      setPendingBoost(boostId);
      return;
    }

    setBusy(true);
    const usageId = `mgr-${boostId}-${career.worldSaveId ?? career.id}-${Date.now()}`;
    const result = applyManagerBoost({
      boostId,
      career,
      usageId,
      playerId: selectedPlayerId ?? undefined,
      reserveId: selectedReserveId ?? undefined,
    });

    if (!result.success || !result.career) {
      setBusy(false);
      setError(result.reason ?? "Boost could not be applied.");
      return;
    }

    const consumed = tryConsumeBoostFromInventory(boostId, {
      id: usageId,
      boostId,
      gameSaveId: career.worldSaveId ?? career.id,
      mode: "MANAGER",
      targetId: selectedPlayerId ?? selectedReserveId ?? undefined,
      status: "consumed",
      timestamp: new Date().toISOString(),
    });
    setBusy(false);

    if (!consumed.success) {
      setError(consumed.reason ?? "Could not consume boost from inventory.");
      return;
    }

    setPendingBoost(null);
    setSelectedPlayerId(null);
    setSelectedReserveId(null);
    onApplied(result.career);
  };

  const pendingDef = pendingBoost ? getBoostDefinition(pendingBoost) : null;

  return (
    <>
      <ManagerSectionCard
        title={panelTitle}
        accent={career.managerProtection?.noSacking ? "gold" : undefined}
        className={compact ? "mt-3" : undefined}
      >
        {career.managerProtection?.noSacking && (
          <p className={`mb-3 rounded-md border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-sm text-accent-gold`}>
            Sacking Protection Active — the board cannot dismiss you this save.
          </p>
        )}

        {ownedBoosts.length === 0 ? (
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No owned boosts for this screen.
          </p>
        ) : (
          <ul className={`${SPACING.stackSm}`}>
            {ownedBoosts.map((boost: GameBoost) => {
              const qty = getBoostQuantity(boost.id);
              const eligibility = canApplyManagerBoost(boost.id, career);
              return (
                <li
                  key={boost.id}
                  className="flex flex-col gap-2 rounded-lg border border-pitch-700/50 bg-pitch-900/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{boost.name}</p>
                    <p className={`${TYPO.bodySm} text-pitch-400`}>{boost.description}</p>
                    <p className="mt-1 text-[11px] text-pitch-500">
                      Owned ×{qty} · {boost.usageLimitLabel}
                    </p>
                  </div>
                  <GameButton
                    variant="secondary"
                    size="sm"
                    disabled={busy || !eligibility.ok}
                    onClick={() => {
                      playUiClick();
                      setError(null);
                      if (boost.id === "mgr-training-boost") {
                        setSelectedPlayerId(null);
                        setPendingBoost(boost.id);
                        return;
                      }
                      if (boost.id === "mgr-unlocked-potential") {
                        setSelectedReserveId(null);
                        setPendingBoost(boost.id);
                        return;
                      }
                      setPendingBoost(boost.id);
                    }}
                  >
                    Use
                  </GameButton>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </ManagerSectionCard>

      {pendingBoost === "mgr-training-boost" && (
        <ManagerSectionCard title="Select player" className="mt-3">
          <ul className={`${SPACING.stackSm}`}>
            {trainingOptions.map((p) => (
              <li key={p.playerId}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedPlayerId === p.playerId
                      ? "border-theme-primary bg-theme-primary/10 text-white"
                      : "border-pitch-700/50 text-pitch-200 hover:border-pitch-600"
                  }`}
                  onClick={() => setSelectedPlayerId(p.playerId)}
                >
                  {p.name} · {p.rating} → {p.potential} OVR
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <GameButton
              variant="theme"
              disabled={!selectedPlayerId || busy}
              onClick={() => handleApply("mgr-training-boost")}
            >
              Apply Training Boost
            </GameButton>
            <GameButton variant="secondary" onClick={() => setPendingBoost(null)}>
              Cancel
            </GameButton>
          </div>
        </ManagerSectionCard>
      )}

      {pendingBoost === "mgr-unlocked-potential" && (
        <ManagerSectionCard title="Select reserve" className="mt-3">
          <ul className={`${SPACING.stackSm}`}>
            {reserveOptions.map((r) => (
              <li key={r.reserveId}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedReserveId === r.reserveId
                      ? "border-theme-primary bg-theme-primary/10 text-white"
                      : "border-pitch-700/50 text-pitch-200 hover:border-pitch-600"
                  }`}
                  onClick={() => setSelectedReserveId(r.reserveId)}
                >
                  {r.name} · {r.rating} → {r.potential} OVR
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <GameButton
              variant="theme"
              disabled={!selectedReserveId || busy}
              onClick={() => handleApply("mgr-unlocked-potential")}
            >
              Apply Unlocked Potential
            </GameButton>
            <GameButton variant="secondary" onClick={() => setPendingBoost(null)}>
              Cancel
            </GameButton>
          </div>
        </ManagerSectionCard>
      )}

      {pendingBoost &&
        pendingBoost !== "mgr-training-boost" &&
        pendingBoost !== "mgr-unlocked-potential" &&
        pendingDef && (
          <ManagerDialog
            open
            variant="confirm"
            title={`Use ${pendingDef.name}?`}
            message={pendingDef.description}
            confirmLabel="Apply Boost"
            onConfirm={() => handleApply(pendingBoost)}
            onCancel={() => setPendingBoost(null)}
          />
        )}
    </>
  );
}
