"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, MANAGER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerReservePlayer } from "@/lib/manager/types";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import {
  callUpReserveForNextMatch,
  fillReserveSquadMinimum,
  getPotentialTier,
  getReserveOpponent,
  promoteReserveToSquad,
  releaseReserve,
  RESERVE_EMERGENCY_RECRUITMENT_EXCUSE,
  RESERVE_EMERGENCY_RECRUITMENT_TITLE,
  RESERVE_RECRUITMENT_FEE,
  RESERVE_SQUAD_MIN,
} from "@/lib/manager/managerReserves";
import {
  bulkRenewExpiringReserveContracts,
  declineYouthProspect,
  generateReserveRenewalDemand,
  generateReserveYouthContract,
  renewReserveContract,
  signYouthProspect,
} from "@/lib/manager/managerReserveContracts";
import {
  formatWage,
  getContractStatus,
} from "@/lib/manager/managerContracts";
import { getNextManagerFixture } from "@/lib/manager/managerSimulation";
import { playUiClick } from "@/lib/sound";
import {
  ManagerPage,
} from "@/components/manager/manager-ui";
import { ManagerReserveReleaseModal } from "@/components/manager/ManagerReserveReleaseModal";
import { ManagerReserveGrowthPanel } from "@/components/manager/ManagerReserveGrowthPanel";

type ReserveFilter = "all" | "position" | "potential" | "rating" | "age";

const STATUS_LABELS: Record<string, string> = {
  expires_this_season: "Expires this season",
  one_year_left: "1 year left",
  long_term: "Long-term",
  wants_renewal: "Renewal due",
  renewed: "Renewed",
};

interface ManagerReservesProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerReserves({ career, onUpdate }: ManagerReservesProps) {
  const [filter, setFilter] = useState<ReserveFilter>("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ManagerReservePlayer | null>(
    null
  );

  const nextFixture = getNextManagerFixture(career);
  const upcomingOpp = nextFixture
    ? getReserveOpponent(career.club, nextFixture.round, career.seed)
    : null;

  const youthProspects = career.youthProspects ?? [];

  const expiringReserveCount = useMemo(
    () =>
      career.reserves.filter((r) => {
        const c = career.reserveContracts?.[r.id];
        if (!c) return false;
        const s = getContractStatus(c);
        return s === "expires_this_season" || s === "wants_renewal";
      }).length,
    [career]
  );

  const rows = useMemo(() => {
    let list = [...career.reserves];
    if (positionFilter !== "all") {
      list = list.filter((r) => r.eligiblePositions.includes(positionFilter));
    }
    if (filter === "potential") {
      list.sort((a, b) => b.potentialRating - a.potentialRating);
    } else if (filter === "age") {
      list.sort((a, b) => a.age - b.age);
    } else {
      list.sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [career.reserves, filter, positionFilter]);

  const handlePromote = (id: string) => {
    const result = promoteReserveToSquad(career, id);
    if (!result.ok || !result.career) {
      setMessage(result.error ?? "Could not promote player");
      return;
    }
    onUpdate(result.career);
    setMessage("Player signed to first-team squad");
  };

  const handleReleaseClick = (reserve: ManagerReservePlayer) => {
    playUiClick();
    setReleaseTarget(reserve);
  };

  const handleReleaseConfirm = () => {
    if (!releaseTarget) return;
    onUpdate(releaseReserve(career, releaseTarget.id));
    setMessage(`${releaseTarget.name} released`);
  };

  const handleReleaseModalClose = () => {
    setReleaseTarget(null);
  };

  const handleSignProspect = (id: string) => {
    const result = signYouthProspect(career, id);
    if (!result.ok || !result.career) {
      setMessage(result.error ?? "Could not sign prospect");
      return;
    }
    onUpdate(result.career);
    setMessage("Youth contract signed");
  };

  const handleDeclineProspect = (id: string, name: string) => {
    onUpdate(declineYouthProspect(career, id));
    setMessage(`${name} will look elsewhere`);
  };

  const handleRenewReserve = (id: string) => {
    const reserve = career.reserves.find((r) => r.id === id);
    const contract = career.reserveContracts?.[id];
    if (!reserve || !contract) return;
    const demand =
      contract.renewalDemand ??
      generateReserveRenewalDemand(reserve, contract);
    onUpdate(renewReserveContract(career, id, demand));
    setMessage(`${reserve.name} renewed at ${formatWage(demand.wagePerYear)}/yr`);
  };

  const reserveShortfall = Math.max(0, RESERVE_SQUAD_MIN - career.reserves.length);
  const transferBudget =
    career.managerFinance?.transferBudget ?? career.budget;
  const canAffordRecruitment = transferBudget >= RESERVE_RECRUITMENT_FEE;

  const handleEmergencyRecruitment = () => {
    playUiClick();
    const shortfall = RESERVE_SQUAD_MIN - career.reserves.length;
    const result = fillReserveSquadMinimum(career);
    if (!result.ok || !result.career) {
      setMessage(result.error ?? "Could not register emergency reserves");
      return;
    }
    onUpdate(result.career);
    setMessage(
      `${shortfall} performance-unit graduate${shortfall === 1 ? "" : "s"} registered on reserve listing`
    );
  };

  const handleBulkRenewReserves = () => {
    const { career: next, renewed, declined } =
      bulkRenewExpiringReserveContracts(career);
    onUpdate(next);
    setMessage(
      renewed > 0
        ? `Renewed ${renewed} reserve contract${renewed === 1 ? "" : "s"}`
        : declined > 0
          ? "No reserve renewals accepted"
          : "No expiring reserve contracts"
    );
  };

  return (
    <ManagerPage wide>
      <div>
        <h1 className={TYPO.viewTitle}>Reserves</h1>
        <p className={`${TYPO.managerBody}`}>
          Youth & reserve squad · {career.reserves.length} players · Reserve
          wages from {formatWage(
            Object.values(career.reserveContracts ?? {}).reduce(
              (s, c) => s + c.wagePerYear,
              0
            )
          )}
          /yr
        </p>
      </div>

      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      {reserveShortfall > 0 && (
        <div className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4 border-red-500/70`}>
          <p className={TYPO.sectionLabel}>
            Reserve listing short — {career.reserves.length}/{RESERVE_SQUAD_MIN}{" "}
            registered
          </p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            {RESERVE_EMERGENCY_RECRUITMENT_EXCUSE}
          </p>
          <p className={`mt-2 ${TYPO.bodySm} text-accent-gold`}>
            Without {RESERVE_SQUAD_MIN} registered players, reserve fixtures are
            awarded as an 18-0 walkover defeat.
          </p>
          <GameButton
            variant="theme"
            size="sm"
            className="mt-3"
            disabled={!canAffordRecruitment}
            onClick={handleEmergencyRecruitment}
          >
            {RESERVE_EMERGENCY_RECRUITMENT_TITLE} — £
            {(RESERVE_RECRUITMENT_FEE / 1000).toFixed(0)}k
            {reserveShortfall > 0
              ? ` · register ${reserveShortfall} player${reserveShortfall === 1 ? "" : "s"}`
              : ""}
          </GameButton>
          {!canAffordRecruitment && (
            <p className={`mt-2 ${TYPO.bodySm} text-red-400`}>
              Transfer budget £{(transferBudget / 1000).toFixed(0)}k — need £
              {(RESERVE_RECRUITMENT_FEE / 1000).toFixed(0)}k
            </p>
          )}
        </div>
      )}

      {youthProspects.length > 0 && (
        <div className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4 border-theme-primary`}>
          <p className={TYPO.sectionLabel}>Youth intake · {career.seasonYear}</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            {youthProspects.length} academy prospect
            {youthProspects.length === 1 ? "" : "s"} available to sign on cheap
            youth terms.
          </p>
          <div className={`mt-3 ${SPACING.stackSm}`}>
            {youthProspects.map((p) => {
              const previewWage = generateReserveYouthContract(p).wagePerYear;
              return (
                <div
                  key={p.id}
                  className={`${CARD.inset} ${SPACING.cardPaddingSm}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{p.name}</p>
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        {POSITION_SHORT[p.position]} · Age {p.age} ·{" "}
                        {p.nationality}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-theme-primary">
                        {p.rating}
                      </p>
                      <p className="text-xs text-pitch-500">
                        POT {p.potentialRating}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-pitch-400">
                    {getPotentialTier(p.potentialRating)} · Youth wage ~{" "}
                    {formatWage(previewWage)}/yr
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        handleSignProspect(p.id);
                      }}
                    >
                      Sign youth contract
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        handleDeclineProspect(p.id, p.name);
                      }}
                    >
                      Pass
                    </GameButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expiringReserveCount > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Reserve contracts</p>
          <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
            {expiringReserveCount} youth contract
            {expiringReserveCount === 1 ? "" : "s"} need renewal
          </p>
          <GameButton
            variant="theme"
            size="sm"
            className="mt-2"
            onClick={() => {
              playUiClick();
              handleBulkRenewReserves();
            }}
          >
            Renew all expiring reserves
          </GameButton>
        </div>
      )}

      {(career.lastReserveResult || upcomingOpp) && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          {career.lastReserveResult && (
            <div>
              <p className={TYPO.sectionLabel}>Latest Reserve Result</p>
              {career.lastReserveResult.walkover ? (
                <>
                  <p className={`mt-1 font-medium text-white`}>
                    {career.lastReserveResult.walkoverReason}
                  </p>
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {career.club} Reserves {career.lastReserveResult.userScore} -{" "}
                    {career.lastReserveResult.oppScore}{" "}
                    {career.lastReserveResult.opponent}
                  </p>
                </>
              ) : (
                <>
                  <p className={`mt-1 font-medium text-white`}>
                    {career.club} Reserves {career.lastReserveResult.userScore} -{" "}
                    {career.lastReserveResult.oppScore}{" "}
                    {career.lastReserveResult.opponent}
                  </p>
                  {career.lastReserveResult.topPerformer && (
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      Top Performer: {career.lastReserveResult.topPerformer}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {upcomingOpp && !career.isSeasonComplete && (
            <div className={career.lastReserveResult ? "mt-3" : ""}>
              <p className={TYPO.sectionLabel}>Upcoming Reserve Fixture</p>
              <p className={`mt-1 ${TYPO.bodySm} text-white`}>
                {career.club} Reserves vs {upcomingOpp} Reserves
                {nextFixture && ` · Round ${nextFixture.round}`}
              </p>
            </div>
          )}
        </div>
      )}

      <div className={MANAGER.splitLayout}>
        <div className={SPACING.stackLg}>
      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filters</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["potential", "Potential"],
              ["rating", "Rating"],
              ["age", "Age"],
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

      <div className={SPACING.stackSm}>
        {rows.map((r) => {
          const contract = career.reserveContracts?.[r.id];
          const status = contract ? getContractStatus(contract) : null;
          const needsRenew =
            status === "expires_this_season" || status === "wants_renewal";

          return (
            <div
              key={r.id}
              className={`${CARD.base} ${SPACING.cardPaddingSm} ${
                needsRenew ? "border-accent-gold/40" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {POSITION_SHORT[r.position]} · Age {r.age} · {r.nationality}
                  </p>
                  {contract && (
                    <p className={`mt-0.5 text-[11px] text-pitch-500`}>
                      {formatWage(contract.wagePerYear)}/yr ·{" "}
                      {contract.yearsRemaining}yr left ·{" "}
                      {status ? STATUS_LABELS[status] ?? status : "—"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-theme-primary">
                    {r.rating}
                  </p>
                  <p className={`${TYPO.bodySm} text-pitch-500`}>
                    POT {r.potentialRating}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-pitch-300 sm:grid-cols-4">
                <span>{getPotentialTier(r.potentialRating)}</span>
                <span>Form {r.form}</span>
                <span>
                  {r.reserveAppearances} apps · {r.reserveTries} tries
                </span>
                {r.calledUpForNextMatch && (
                  <span className="font-semibold text-theme-primary">Called up</span>
                )}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <GameButton
                  variant="theme"
                  size="sm"
                  disabled={r.calledUpForNextMatch}
                  onClick={() => {
                    playUiClick();
                    onUpdate(callUpReserveForNextMatch(career, r.id));
                    setMessage(
                      r.calledUpForNextMatch
                        ? `${r.name} is already called up`
                        : `${r.name} called up for next match`
                    );
                  }}
                >
                  {r.calledUpForNextMatch ? "Called up" : "Call up for next match"}
                </GameButton>
                {needsRenew && contract && (
                  <GameButton
                    variant="theme"
                    size="sm"
                    onClick={() => {
                      playUiClick();
                      handleRenewReserve(r.id);
                    }}
                  >
                    Renew ({formatWage(
                      (contract.renewalDemand ??
                        generateReserveRenewalDemand(r, contract)
                      ).wagePerYear
                    )}
                    /yr)
                  </GameButton>
                )}
                <GameButton
                  variant="theme"
                  size="sm"
                  onClick={() => {
                    playUiClick();
                    handlePromote(r.id);
                  }}
                >
                  Full-time contract
                </GameButton>
                <GameButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReleaseClick(r)}
                >
                  Release
                </GameButton>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No reserve players match your filters.
        </p>
      )}
        </div>

        <ManagerReserveGrowthPanel career={career} />
      </div>

      {releaseTarget && (
        <ManagerReserveReleaseModal
          reserve={releaseTarget}
          contract={career.reserveContracts?.[releaseTarget.id] ?? null}
          onCancel={handleReleaseModalClose}
          onConfirm={handleReleaseConfirm}
        />
      )}
    </ManagerPage>
  );
}
