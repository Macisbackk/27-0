"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer, SquadRole } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerAge,
  getManagerPlayerEligiblePositions,
} from "@/lib/manager/managerPlayers";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import {
  evaluateRenewalOffer,
  formatWage,
  getContractStatus,
} from "@/lib/manager/managerContracts";
import { bulkRenewExpiringContractsWithInbox, renewManagerContract } from "@/lib/manager/managerInbox";
import { releasePlayerWithCost } from "@/lib/manager/managerTransferLeague";
import { getWageBillPercent, isWageOverBudget } from "@/lib/manager/managerFinance";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { ManagerPage } from "@/components/manager/manager-ui";
import {
  managerCalloutClass,
  managerSectionAccentClass,
} from "@/lib/manager/managerSurfaces";
import { markOnboardingStepComplete } from "@/lib/manager/managerOnboarding";

type ContractFilter =
  | "all"
  | "expiring"
  | "highest_wage"
  | "lowest_wage"
  | "position"
  | "role";

const STATUS_LABELS: Record<string, string> = {
  expires_this_season: "Expires this season",
  one_year_left: "1 year left",
  long_term: "Long-term deal",
  wants_renewal: "Wants renewal",
  unhappy: "Unhappy",
  renewed: "Renewed",
  leaving: "Leaving",
};

interface ManagerContractsProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerContracts({
  career,
  onUpdate,
}: ManagerContractsProps) {
  const [filter, setFilter] = useState<ContractFilter>("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [offerRole, setOfferRole] = useState<SquadRole>("Starter");
  const [lastResponse, setLastResponse] = useState<{
    accepted: boolean;
    reason: string;
  } | null>(null);

  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null);

  useEffect(() => {
    markOnboardingStepComplete("finances");
  }, []);

  const expiringCount = useMemo(
    () =>
      career.squad.filter((ps) => {
        const c = career.contracts[ps.playerId];
        if (!c) return false;
        const s = getContractStatus(c);
        return s === "expires_this_season" || s === "wants_renewal";
      }).length,
    [career]
  );

  const handleBulkRenew = () => {
    const { career: next, renewed, declined } =
      bulkRenewExpiringContractsWithInbox(career);
    onUpdate(next);
    setBulkResult(
      renewed > 0
        ? `Renewed ${renewed} player${renewed === 1 ? "" : "s"}${declined > 0 ? ` · ${declined} declined` : ""}.`
        : declined > 0
          ? `No renewals accepted (${declined} declined).`
          : "No expiring contracts to renew."
    );
  };

  const rows = useMemo(() => {
    let list = career.squad
      .map((ps) => {
        const player = getManagerPlayer(career, ps.playerId);
        const contract = career.contracts[ps.playerId];
        if (!player || !contract) return null;
        const status = getContractStatus(contract);
        return {
          ps,
          player,
          contract,
          status,
          rating: player.peakRating,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (filter === "expiring") {
      list = list.filter(
        (r) =>
          r.contract.yearsRemaining <= 1 || r.contract.expiresAtSeasonEnd
      );
    }
    if (filter === "highest_wage") {
      list.sort((a, b) => b.contract.wagePerYear - a.contract.wagePerYear);
    } else if (filter === "lowest_wage") {
      list.sort((a, b) => a.contract.wagePerYear - b.contract.wagePerYear);
    }
    if (positionFilter !== "all") {
      list = list.filter((r) =>
        getManagerPlayerEligiblePositions(career, r.player.id).includes(
          positionFilter
        )
      );
    }
    return list;
  }, [career, filter, positionFilter]);

  const selected = selectedId
    ? rows.find((r) => r.player.id === selectedId)
    : null;

  const openRenewal = (playerId: string) => {
    const contract = career.contracts[playerId];
    const demand = contract?.renewalDemand;
    setSelectedId(playerId);
    setOfferWage(demand?.wagePerYear ?? contract?.wagePerYear ?? 50_000);
    setOfferYears(demand?.yearsRequested ?? 2);
    setOfferRole(demand?.squadRole ?? contract?.squadRole ?? "Starter");
    setLastResponse(null);
  };

  const closeModal = useCallback(() => {
    playPanelClose();
    setSelectedId(null);
    setLastResponse(null);
  }, []);

  const contractPanelRef = useModalA11y(selectedId !== null, closeModal);

  const submitOffer = () => {
    if (!selectedId) return;
    const contract = career.contracts[selectedId];
    if (!contract) return;

    const offer = {
      wagePerYear: offerWage,
      yearsRequested: offerYears,
      squadRole: offerRole,
    };
    const result = evaluateRenewalOffer(selectedId, contract, offer, career);
    setLastResponse(result);
    if (result.accepted) {
      onUpdate(renewManagerContract(career, selectedId, offer));
    }
  };

  const handleRelease = () => {
    if (!selectedId) return;
    setReleaseConfirmId(selectedId);
  };

  const confirmRelease = () => {
    if (!releaseConfirmId) return;
    const result = releasePlayerWithCost(career, releaseConfirmId);
    setReleaseConfirmId(null);
    if (!result.ok || !result.career) return;
    onUpdate(result.career);
    closeModal();
  };

  const selectedPositions = selected
    ? getManagerPlayerEligiblePositions(career, selected.player.id)
    : [];
  const primaryPosition = selectedPositions[0];
  const selectedAge = selected
    ? getManagerPlayerAge(career, selected.player.id)
    : null;

  const wagePct = getWageBillPercent(career);
  const overBudget = isWageOverBudget(career);

  return (
    <ManagerPage>
      <div className={`${CARD.elevated} ${CARD.featured} ${SPACING.cardPaddingMobile}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={TYPO.viewTitle}>Contracts</h1>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Manage wages, renewals, and squad roles
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-pitch-500">
              Wage bill
            </p>
            <p
              className={`text-xl font-bold ${
                overBudget ? "text-amber-300" : "text-white"
              }`}
            >
              {formatWage(career.wageBill)}
            </p>
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              of {formatWage(career.wageBudget)} budget
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-pitch-400">
            <span>Budget used</span>
            <span>{wagePct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-pitch-800">
            <div
              className={`h-full transition-all ${
                overBudget ? "bg-amber-400" : "bg-theme-primary"
              }`}
              style={{ width: `${Math.min(100, wagePct)}%` }}
            />
          </div>
        </div>
        {expiringCount > 0 && (
          <div className={`mt-4 flex flex-wrap items-center gap-2 ${managerCalloutClass("gold")}`}>
            <p className={`flex-1 ${TYPO.bodySm} text-accent-gold`}>
              {expiringCount} contract{expiringCount === 1 ? "" : "s"} expiring
              soon
            </p>
            <GameButton
              variant="secondary"
              fullWidth={false}
              size="sm"
              onClick={handleBulkRenew}
            >
              Renew all
            </GameButton>
          </div>
        )}
        {bulkResult && (
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>{bulkResult}</p>
        )}
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filters</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["expiring", "Expiring soon"],
              ["highest_wage", "Highest wage"],
              ["lowest_wage", "Lowest wage"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                filter === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`rounded-lg border px-2 py-1 text-xs ${
              positionFilter === "all"
                ? FILTER.chipActive
                : "border-pitch-600 text-pitch-300"
            }`}
          >
            All positions
          </button>
          {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                positionFilter === pos
                  ? FILTER.chipActive
                  : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Squad Contracts</p>
        <div className={`${SPACING.stackSm}`}>
        {rows.map(({ player, contract, status, rating }) => {
          const urgent =
            contract.yearsRemaining <= 1 ||
            contract.expiresAtSeasonEnd ||
            contract.retiringAtSeasonEnd ||
            contract.retireAfterContract;
          const statusColor =
            contract.retireAfterContract
              ? "text-stone-200 bg-stone-500/15 border-stone-400/35"
              : contract.retiringAtSeasonEnd
              ? "text-stone-200 bg-stone-500/15 border-stone-400/35"
              : status === "unhappy"
              ? "text-red-300 bg-red-500/10 border-red-500/30"
              : status === "expires_this_season" || status === "wants_renewal"
                ? "text-accent-gold bg-accent-gold/10 border-accent-gold/30"
                : status === "renewed"
                  ? "text-theme-primary bg-theme-primary/10 border-theme-primary/30"
                  : "text-pitch-300 bg-pitch-800/50 border-pitch-600/40";
          const statusLabel = contract.retireAfterContract
            ? "Final year — retiring after"
            : contract.retiringAtSeasonEnd
            ? "Retiring end of season"
            : STATUS_LABELS[status] ?? status;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                playUiClick();
                openRenewal(player.id);
              }}
              className={`${CARD.inset} w-full text-left ${SPACING.listItem} transition hover:border-theme-primary/40 ${
                urgent ? managerSectionAccentClass("gold") : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme-primary/15 text-sm font-bold text-theme-primary">
                    {rating}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {player.name}
                    </p>
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      {formatWage(contract.wagePerYear)}/yr ·{" "}
                      {contract.yearsRemaining}yr · {contract.squadRole}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusColor}`}
                >
                  {statusLabel}
                </span>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {selected && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
          role="dialog"
          aria-modal="true"
          aria-label={`Contract renewal for ${selected.player.name}`}
          onClick={closeModal}
        >
          <div
            ref={contractPanelRef}
            tabIndex={-1}
            className={`card-glass max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto outline-none ${SPACING.cardPadding} animate-fade-up`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={TYPO.cardTitle}>{selected.player.name}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-pitch-500 text-xs">Position</p>
                <p className="text-white">
                  {primaryPosition ? POSITION_SHORT[primaryPosition] : "—"}
                </p>
              </div>
              <div>
                <p className="text-pitch-500 text-xs">Rating</p>
                <p className="text-theme-primary">{selected.rating}</p>
              </div>
              {selectedAge && (
                <div>
                  <p className="text-pitch-500 text-xs">Age</p>
                  <p>{selectedAge}</p>
                </div>
              )}
              <div>
                <p className="text-pitch-500 text-xs">Current wage</p>
                <p>{formatWage(selected.contract.wagePerYear)}/yr</p>
              </div>
              <div>
                <p className="text-pitch-500 text-xs">Years remaining</p>
                <p>{selected.contract.yearsRemaining}</p>
              </div>
              <div>
                <p className="text-pitch-500 text-xs">Squad role</p>
                <p>{selected.contract.squadRole}</p>
              </div>
              <div>
                <p className="text-pitch-500 text-xs">Contract status</p>
                <p>{STATUS_LABELS[selected.status] ?? selected.status}</p>
              </div>
              <div>
                <p className="text-pitch-500 text-xs">Happiness</p>
                <p>{selected.contract.happiness}%</p>
              </div>
            </div>

            {selected.contract.renewalDemand && (
              <div className={`mt-4 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionLabel}>Current demand</p>
                <p className={`${TYPO.bodySm} text-white`}>
                  {formatWage(selected.contract.renewalDemand.wagePerYear)}/yr ·{" "}
                  {selected.contract.renewalDemand.yearsRequested} years ·{" "}
                  {selected.contract.renewalDemand.squadRole}
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className={TYPO.bodySm}>
                <span className="text-pitch-400">Offer wage (£/yr)</span>
                <input
                  type="number"
                  step={1000}
                  value={offerWage}
                  onChange={(e) => setOfferWage(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
                />
              </label>
              <label className={TYPO.bodySm}>
                <span className="text-pitch-400">Offer years</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={offerYears}
                  onChange={(e) => setOfferYears(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
                />
              </label>
              <label className={TYPO.bodySm}>
                <span className="text-pitch-400">Offer squad role</span>
                <select
                  value={offerRole}
                  onChange={(e) => setOfferRole(e.target.value as SquadRole)}
                  className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
                >
                  {(["Star", "Starter", "Rotation", "Prospect", "Depth"] as const).map(
                    (r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            {lastResponse && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 ${
                  lastResponse.accepted
                    ? "border-theme-primary/40 bg-theme-primary/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                <p
                  className={`font-semibold ${
                    lastResponse.accepted ? "text-theme-primary" : "text-red-300"
                  }`}
                >
                  {lastResponse.accepted ? "Accepted" : "Declined"} —{" "}
                  {lastResponse.reason}
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <GameButton
                variant="theme"
                onClick={() => {
                  playUiClick();
                  submitOffer();
                }}
              >
                Offer Contract
              </GameButton>
              <GameButton variant="secondary" onClick={closeModal}>
                Close
              </GameButton>
              <GameButton
                variant="secondary"
                className="sm:col-span-2"
                onClick={() => {
                  playUiClick();
                  handleRelease();
                }}
              >
                Release Player
              </GameButton>
            </div>
          </div>
        </div>
      )}

      <ManagerDialog
        open={releaseConfirmId !== null}
        variant="confirm"
        destructive
        title="Release player"
        message="Release this player from the squad?"
        confirmLabel="Release"
        cancelLabel="Keep"
        onConfirm={confirmRelease}
        onCancel={() => setReleaseConfirmId(null)}
      />
    </ManagerPage>
  );
}
