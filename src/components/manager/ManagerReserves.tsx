"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { GameTableRow } from "@/components/ui/GameTableRow";
import { FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerReservePlayer } from "@/lib/manager/types";
import { POSITION_SHORT, getFullPositionName, getFullPositionNames } from "@/lib/positions";
import type { Position } from "@/lib/types";
import {
  callUpReserveForNextMatch,
  fillReserveSquadMinimum,
  formatReserveGrowthDelta,
  getPotentialTier,
  getReserveOpponent,
  getReserveSignedGrowthDelta,
  getReserveSignedRating,
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
import { ManagerPage, ManagerSection, ManagerStat } from "@/components/manager/manager-ui";
import { ManagerReserveReleaseModal } from "@/components/manager/ManagerReserveReleaseModal";

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

  const totalReserveWages = useMemo(
    () =>
      Object.values(career.reserveContracts ?? {}).reduce(
        (s, c) => s + c.wagePerYear,
        0
      ),
    [career.reserveContracts]
  );

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
    <ManagerPage>
      <ManagerSection>
      <GameSectionHeader
        label="Academy"
        title="Reserves"
        subtitle={`Youth & reserve squad · ${career.club}`}
      />

      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      <GamePanel padded label="Reserve squad summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ManagerStat
            label="Squad size"
            value={`${career.reserves.length} / ${RESERVE_SQUAD_MIN}`}
            tone={reserveShortfall > 0 ? "red" : "default"}
            large
          />
          <ManagerStat
            label="Reserve wages"
            value={`${formatWage(totalReserveWages)}/yr`}
            tone="gold"
            large
          />
          {expiringReserveCount > 0 && (
            <ManagerStat
              label="Renewals due"
              value={String(expiringReserveCount)}
              tone="amber"
              large
            />
          )}
        </div>
        {reserveShortfall > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
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
        {expiringReserveCount > 0 && (
          <div className="mt-4 border-t border-pitch-700/40 pt-3">
            <p className={`${TYPO.bodySm} text-accent-gold`}>
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
      </GamePanel>

      {youthProspects.length > 0 && (
        <GamePanel padded label={`Youth intake · ${career.seasonYear}`}>
          <p className={`${TYPO.bodySm} text-pitch-300`}>
            {youthProspects.length} academy prospect
            {youthProspects.length === 1 ? "" : "s"} available to sign on cheap
            youth terms.
          </p>
          <div className={`mt-3 divide-y divide-pitch-700/40 ${SPACING.stackSm}`}>
            {youthProspects.map((p) => {
              const previewWage = generateReserveYouthContract(p).wagePerYear;
              return (
                <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-medium text-white">{p.name}</p>
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {getFullPositionName(p.position)} · Age {p.age} · {p.nationality}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-theme-primary">
                      Rating {p.rating}
                    </span>
                    <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-accent-gold">
                      POT {p.potentialRating}
                    </span>
                    <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] text-pitch-300">
                      {getPotentialTier(p.potentialRating)} · ~{formatWage(previewWage)}/yr
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
        </GamePanel>
      )}

      {(career.lastReserveResult || upcomingOpp) && (
        <GamePanel padded label="Reserve fixtures">
          {career.lastReserveResult && (
            <div>
              <p className={TYPO.sectionLabel}>Latest result</p>
              {career.lastReserveResult.walkover ? (
                <>
                  <p className="mt-1 font-medium text-white">
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
                  <p className="mt-1 font-medium text-white">
                    {career.club} Reserves {career.lastReserveResult.userScore} -{" "}
                    {career.lastReserveResult.oppScore}{" "}
                    {career.lastReserveResult.opponent}
                  </p>
                  {career.lastReserveResult.topPerformer && (
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      Top performer: {career.lastReserveResult.topPerformer}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {upcomingOpp && !career.isSeasonComplete && (
            <div className={career.lastReserveResult ? "mt-4 border-t border-pitch-700/40 pt-4" : ""}>
              <p className={TYPO.sectionLabel}>Upcoming</p>
              <p className={`mt-1 ${TYPO.bodySm} text-white`}>
                {career.club} Reserves vs {upcomingOpp} Reserves
                {nextFixture && ` · Round ${nextFixture.round}`}
              </p>
            </div>
          )}
        </GamePanel>
      )}

      <GamePanel padded label="Filters">
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
              className={`rounded-sm border px-2 py-1 text-xs ${
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
            className={`rounded-sm border px-2 py-1 text-xs ${
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
              className={`rounded-sm border px-2 py-1 text-xs ${
                positionFilter === pos
                  ? FILTER.chipActive
                  : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </GamePanel>

      <GamePanel padded label={`Reserve players (${rows.length})`}>
        <div className="divide-y divide-pitch-700/40">
          {rows.map((r) => {
            const contract = career.reserveContracts?.[r.id];
            const status = contract ? getContractStatus(contract) : null;
            const needsRenew =
              status === "expires_this_season" || status === "wants_renewal";
            const signedRating = getReserveSignedRating(r);
            const growthDelta = getReserveSignedGrowthDelta(r);
            const positionLabel = getFullPositionNames(
              (r.eligiblePositions?.length
                ? r.eligiblePositions
                : [r.position]
              ) as Position[]
            );

            return (
              <GameTableRow
                key={r.id}
                variant="ledger"
                className={`border-0 bg-transparent px-0 py-4 shadow-none first:pt-0 last:pb-0 ${
                  needsRenew ? "rounded-lg ring-1 ring-accent-gold/30 !px-3" : ""
                }`}
              >
                <div className="reserve-player-card">
                  <div className="reserve-player-card__header">
                    <h3>{r.name}</h3>
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      {positionLabel || getFullPositionName(r.position)} · Age{" "}
                      {r.age} · {r.nationality}
                    </p>
                    {contract ? (
                      <p className={`${TYPO.bodySm} text-accent-gold`}>
                        {formatWage(contract.wagePerYear)} wage ·{" "}
                        {contract.yearsRemaining} year
                        {contract.yearsRemaining === 1 ? "" : "s"} left
                      </p>
                    ) : null}
                    {needsRenew && status ? (
                      <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
                        {STATUS_LABELS[status] ?? status}
                      </p>
                    ) : null}
                    {r.calledUpForNextMatch ? (
                      <p className={`mt-1 ${TYPO.bodySm} text-theme-primary`}>
                        Called up for next match
                      </p>
                    ) : null}
                  </div>

                  <div className="reserve-player-card__ratings">
                    <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-pitch-300">
                      Signed {signedRating}
                    </span>
                    <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-theme-primary">
                      Current {r.rating}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        growthDelta > 0
                          ? "border-theme-primary/40 bg-theme-primary/10 text-theme-primary"
                          : growthDelta < 0
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-pitch-600/60 bg-pitch-900/40 text-pitch-400"
                      }`}
                    >
                      Growth {formatReserveGrowthDelta(growthDelta)}
                    </span>
                  </div>

                  <div className="reserve-player-card__actions">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth={false}
                      className="w-full min-w-0 sm:w-auto sm:min-w-[7.5rem]"
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
                      {r.calledUpForNextMatch ? "Called up" : "Call up"}
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      className="w-full min-w-0 sm:w-auto sm:min-w-[7.5rem]"
                      onClick={() => {
                        playUiClick();
                        handlePromote(r.id);
                      }}
                    >
                      Offer Full-Time
                    </GameButton>
                    {needsRenew && contract && (
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth={false}
                        className="w-full min-w-0 sm:w-auto sm:min-w-[7.5rem]"
                        onClick={() => {
                          playUiClick();
                          handleRenewReserve(r.id);
                        }}
                      >
                        Renew (
                        {formatWage(
                          (contract.renewalDemand ??
                            generateReserveRenewalDemand(r, contract)
                          ).wagePerYear
                        )}
                        /yr)
                      </GameButton>
                    )}
                    <GameButton
                      variant="danger"
                      size="sm"
                      fullWidth={false}
                      className="w-full min-w-0 sm:w-auto sm:min-w-[7.5rem]"
                      onClick={() => handleReleaseClick(r)}
                    >
                      Release
                    </GameButton>
                  </div>
                </div>
              </GameTableRow>
            );
          })}
        </div>

        {rows.length === 0 && (
          <p className={`${TYPO.bodySm} text-center text-pitch-500`}>
            No reserve players match your filters.
          </p>
        )}
      </GamePanel>

      {releaseTarget && (
        <ManagerReserveReleaseModal
          reserve={releaseTarget}
          contract={career.reserveContracts?.[releaseTarget.id] ?? null}
          onCancel={handleReleaseModalClose}
          onConfirm={handleReleaseConfirm}
        />
      )}
      </ManagerSection>
    </ManagerPage>
  );
}
