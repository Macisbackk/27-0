"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, SquadRole } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import {
  applyRenewal,
  evaluateRenewalOffer,
  formatWage,
  getContractStatus,
} from "@/lib/manager/managerContracts";
import { playUiClick } from "@/lib/sound";

type ContractFilter =
  | "all"
  | "expiring"
  | "highest_wage"
  | "lowest_wage"
  | "unhappy"
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
  const [roleFilter, setRoleFilter] = useState<SquadRole | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [offerRole, setOfferRole] = useState<SquadRole>("Starter");
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = career.squad
      .map((ps) => {
        const player = getPlayerById(ps.playerId);
        const contract = career.contracts[ps.playerId];
        if (!player || !contract) return null;
        const status = getContractStatus(contract);
        return {
          ps,
          player,
          contract,
          status,
          rating: player.rating ?? player.peakRating,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (filter === "expiring") {
      list = list.filter(
        (r) =>
          r.contract.yearsRemaining <= 1 || r.contract.expiresAtSeasonEnd
      );
    }
    if (filter === "unhappy") {
      list = list.filter(
        (r) => r.contract.happiness < 40 || r.status === "unhappy"
      );
    }
    if (filter === "highest_wage") {
      list.sort((a, b) => b.contract.wagePerYear - a.contract.wagePerYear);
    } else if (filter === "lowest_wage") {
      list.sort((a, b) => a.contract.wagePerYear - b.contract.wagePerYear);
    }
    if (positionFilter !== "all") {
      list = list.filter((r) =>
        getPlayerEligiblePositions(r.player).includes(positionFilter)
      );
    }
    if (roleFilter !== "all") {
      list = list.filter((r) => r.contract.squadRole === roleFilter);
    }

    return list;
  }, [career, filter, positionFilter, roleFilter]);

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
    setMessage(null);
  };

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
    if (!result.accepted) {
      setMessage(result.reason);
      return;
    }
    onUpdate(applyRenewal(career, selectedId, offer));
    setMessage("Contract renewed!");
    setSelectedId(null);
  };

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Contracts</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Wage bill {formatWage(career.wageBill)} / budget{" "}
          {formatWage(career.wageBudget)}
        </p>
      </div>

      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filters</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["expiring", "Expiring soon"],
              ["highest_wage", "Highest wage"],
              ["lowest_wage", "Lowest wage"],
              ["unhappy", "Unhappy"],
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
          {(["all", "Star", "Starter", "Rotation", "Prospect", "Depth"] as const).map(
            (role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  roleFilter === role
                    ? FILTER.chipActive
                    : "border-pitch-600 text-pitch-300"
                }`}
              >
                {role === "all" ? "All roles" : role}
              </button>
            )
          )}
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

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackSm}`}>
        {rows.map(({ player, contract, status, rating }) => {
          const urgent =
            contract.yearsRemaining <= 1 || contract.expiresAtSeasonEnd;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                playUiClick();
                openRenewal(player.id);
              }}
              className={`${CARD.inset} w-full text-left px-3 py-2 transition ${
                urgent ? "border-l-4 border-accent-gold" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{player.name}</p>
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {rating} rated · {formatWage(contract.wagePerYear)}/yr ·{" "}
                    {contract.yearsRemaining}yr left · {contract.squadRole}
                  </p>
                </div>
                <span
                  className={`${TYPO.bodySm} ${
                    status === "unhappy" ? "text-red-300" : "text-pitch-300"
                  }`}
                >
                  {STATUS_LABELS[status] ?? status}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={`${CARD.elevated} ${SPACING.cardPadding} ${SPACING.stackMd}`}>
          <h2 className={TYPO.cardTitle}>{selected.player.name}</h2>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Current: {formatWage(selected.contract.wagePerYear)}/yr ·{" "}
            {selected.contract.yearsRemaining} years · Happiness{" "}
            {selected.contract.happiness}
          </p>
          {selected.contract.renewalDemand && (
            <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
              <p className={TYPO.sectionLabel}>Player demand</p>
              <p className={`${TYPO.bodySm} text-white`}>
                {formatWage(selected.contract.renewalDemand.wagePerYear)}/yr ·{" "}
                {selected.contract.renewalDemand.yearsRequested} years ·{" "}
                {selected.contract.renewalDemand.squadRole}
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={TYPO.bodySm}>
              <span className="text-pitch-400">Wage (£/yr)</span>
              <input
                type="number"
                step={1000}
                value={offerWage}
                onChange={(e) => setOfferWage(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
              />
            </label>
            <label className={TYPO.bodySm}>
              <span className="text-pitch-400">Years</span>
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
              <span className="text-pitch-400">Role</span>
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
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              submitOffer();
            }}
          >
            Offer Contract
          </GameButton>
          <GameButton
            variant="secondary"
            onClick={() => setSelectedId(null)}
          >
            Cancel
          </GameButton>
        </div>
      )}
    </div>
  );
}
