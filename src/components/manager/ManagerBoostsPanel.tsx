"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
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
import { playBoostSuccess, playBoostFailed, playUiClick } from "@/lib/sound";

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
      playBoostFailed();
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
      playBoostFailed();
      setError(consumed.reason ?? "Could not consume boost from inventory.");
      return;
    }

    playBoostSuccess();
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
        subtitle="Apply owned boosts from the Store. Effects are permanent for this career."
        variant="elevated"
        accent={career.managerProtection?.noSacking ? "gold" : "primary"}
        className={compact ? "mt-3" : undefined}
      >
        {career.managerProtection?.noSacking && (
          <p className="mb-3 rounded-lg border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-sm text-accent-gold">
            Sacking Protection Active — the board cannot dismiss you this save.
          </p>
        )}

        {ownedBoosts.length === 0 ? (
          <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={`${TYPO.bodySm}`}>No owned boosts for this screen.</p>
            <p className={`mt-1 ${TYPO.meta}`}>
              Buy Career boosts in the Store, then use them here.
            </p>
          </div>
        ) : (
          <ul className={SPACING.stackSm} role="list">
            {ownedBoosts.map((boost: GameBoost) => {
              const qty = getBoostQuantity(boost.id);
              const eligibility = canApplyManagerBoost(boost.id, career);
              return (
                <li
                  key={boost.id}
                  className={`${CARD.inset} flex flex-col gap-3 ${SPACING.cardPaddingSm} sm:flex-row sm:items-center sm:justify-between`}
                >
                  <div className="min-w-0 text-left">
                    <p className={TYPO.cardTitle}>{boost.name}</p>
                    <p className={`mt-1 ${TYPO.bodySm}`}>{boost.description}</p>
                    <p className={`mt-1.5 ${TYPO.meta}`}>
                      Owned ×{qty} · {boost.usageLimitLabel}
                      {!eligibility.ok && eligibility.reason
                        ? ` · ${eligibility.reason}`
                        : ""}
                    </p>
                  </div>
                  <GameButton
                    variant="theme"
                    size="sm"
                    fullWidth={false}
                    className="shrink-0 sm:min-w-[5.5rem]"
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
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </ManagerSectionCard>

      {pendingBoost === "mgr-training-boost" && (
        <ManagerSectionCard
          title="Select player"
          subtitle="Training Boost raises current rating toward potential."
          variant="elevated"
          className="mt-3"
        >
          <ul className={SPACING.stackSm} role="list">
            {trainingOptions.map((p) => {
              const selected = selectedPlayerId === p.playerId;
              return (
                <li key={p.playerId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`${CARD.base} ${CARD.interactive} w-full ${SPACING.listItem} text-left text-sm ${
                      selected ? CARD.selected : ""
                    }`}
                    onClick={() => {
                      playUiClick();
                      setSelectedPlayerId(p.playerId);
                    }}
                  >
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className={`mt-0.5 block ${TYPO.meta}`}>
                      {p.rating} → {p.potential} OVR
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={`mt-3 flex flex-col gap-2 sm:flex-row`}>
            <GameButton
              variant="theme"
              disabled={!selectedPlayerId || busy}
              onClick={() => handleApply("mgr-training-boost")}
            >
              Apply Training Boost
            </GameButton>
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setPendingBoost(null);
              }}
            >
              Cancel
            </GameButton>
          </div>
        </ManagerSectionCard>
      )}

      {pendingBoost === "mgr-unlocked-potential" && (
        <ManagerSectionCard
          title="Select reserve"
          subtitle="Unlocked Potential raises a reserve’s ceiling."
          variant="elevated"
          className="mt-3"
        >
          <ul className={SPACING.stackSm} role="list">
            {reserveOptions.map((r) => {
              const selected = selectedReserveId === r.reserveId;
              return (
                <li key={r.reserveId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`${CARD.base} ${CARD.interactive} w-full ${SPACING.listItem} text-left text-sm ${
                      selected ? CARD.selected : ""
                    }`}
                    onClick={() => {
                      playUiClick();
                      setSelectedReserveId(r.reserveId);
                    }}
                  >
                    <span className="font-semibold text-white">{r.name}</span>
                    <span className={`mt-0.5 block ${TYPO.meta}`}>
                      {r.rating} → {r.potential} OVR
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={`mt-3 flex flex-col gap-2 sm:flex-row`}>
            <GameButton
              variant="theme"
              disabled={!selectedReserveId || busy}
              onClick={() => handleApply("mgr-unlocked-potential")}
            >
              Apply Unlocked Potential
            </GameButton>
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setPendingBoost(null);
              }}
            >
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
