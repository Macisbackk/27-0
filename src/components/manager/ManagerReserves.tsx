"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { GameEmptyState } from "@/components/ui/GameEmptyState";
import { FILTER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerReservePlayer } from "@/lib/manager/types";
import { POSITION_SHORT, getFullPositionName } from "@/lib/positions";
import type { Position } from "@/lib/types";
import {
  fillReserveSquadMinimum,
  getPotentialTier,
  getReserveOpponent,
  promoteReserveToSquad,
  callUpReserveForNextMatch,
  cancelReserveCallUp,
  RESERVE_EMERGENCY_RECRUITMENT_EXCUSE,
  RESERVE_EMERGENCY_RECRUITMENT_TITLE,
  RESERVE_MIN_PLAYERS,
  RESERVE_RECRUITMENT_FEE,
} from "@/lib/manager/managerReserves";
import {
  buildReserveCardModel,
  type ReserveCardChip,
} from "@/lib/manager/managerReserveCard";
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
import { getReserveReportMonth } from "@/lib/manager/managerReserveReports";
import { playUiClick, playReserveCallUp, playPromotion } from "@/lib/sound";
import { ManagerPage, ManagerSection, ManagerStat } from "@/components/manager/manager-ui";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { ManagerPlayerCardGrid } from "@/components/manager/ManagerPlayerCard";
import { ManagerReservePlayerCard } from "@/components/manager/ManagerReservePlayerCard";
import { ManagerReservePlayerModal } from "@/components/manager/ManagerReservePlayerModal";
import {
  patchManagerCareerSettings,
  ReserveDevelopmentSettingsPanel,
  resolveManagerSettings,
} from "@/components/manager/ManagerSettings";
import { ManagerReserveReleaseModal } from "@/components/manager/ManagerReserveReleaseModal";
import { ManagerReserveReleaseToolsModal } from "@/components/manager/ManagerReserveReleaseToolsModal";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import {
  applyReserveReleases,
  evaluateReservePlayerReview,
  type ReserveReviewFlag,
} from "@/lib/manager/managerReserveRelease";

type ReserveFilter = "all" | "position" | "potential" | "rating" | "age";
type ReservesSubTab = "squad" | "settings";

const REVIEW_CHIP: Record<ReserveReviewFlag, ReserveCardChip> = {
  review: { label: "Review", tone: "amber" },
  promote: { label: "Promote", tone: "primary" },
  protected: { label: "Protected", tone: "sky" },
  release_candidate: { label: "Release Candidate", tone: "red" },
};

interface ManagerReservesProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerReserves({ career, onUpdate }: ManagerReservesProps) {
  const [subTab, setSubTab] = useState<ReservesSubTab>("squad");
  const [filter, setFilter] = useState<ReserveFilter>("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [promotionPopup, setPromotionPopup] = useState<{
    name: string;
    position: string;
    rating: number;
    age: number;
    oldWageLabel: string | null;
    newWageLabel: string;
    years: number;
  } | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ManagerReservePlayer | null>(
    null
  );
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseToolsOpen, setReleaseToolsOpen] = useState(false);
  const settings = resolveManagerSettings(career);

  useEffect(() => {
    const focusId = career.focusReservePlayerId;
    if (!focusId) return;
    if (!(career.reserves ?? []).some((r) => r.id === focusId)) return;
    setSubTab("squad");
    setDetailsId(focusId);
    onUpdate({
      ...career,
      focusReservePlayerId: null,
      updatedAt: new Date().toISOString(),
    });
    // Only react to the focus request itself — not every career field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [career.focusReservePlayerId]);

  const latestMonthlyReport = useMemo(
    () =>
      [...(career.inboxMessages ?? [])]
        .reverse()
        .find((m) => m.type === "reserve_report"),
    [career.inboxMessages]
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

  const detailsReserve = detailsId
    ? (career.reserves.find((r) => r.id === detailsId) ?? null)
    : null;

  const handlePromote = (id: string) => {
    const reserve = career.reserves.find((r) => r.id === id);
    if (!reserve) {
      setMessage("Reserve not found");
      return;
    }
    const oldWage = career.reserveContracts?.[id]?.wagePerYear ?? null;
    const result = promoteReserveToSquad(career, id);
    if (!result.ok || !result.career) {
      setMessage(result.error ?? "Could not promote player");
      return;
    }
    const newContract = result.career.contracts[id];
    playPromotion();
    onUpdate(result.career);
    setDetailsId(null);
    setPromotionPopup({
      name: reserve.name,
      position: getFullPositionName(reserve.position),
      rating: reserve.rating,
      age: reserve.age,
      oldWageLabel: oldWage != null ? formatWage(oldWage) : null,
      newWageLabel: formatWage(newContract?.wagePerYear ?? 0),
      years: newContract?.yearsRemaining ?? 0,
    });
  };

  const handleCallUp = (id: string) => {
    const reserve = career.reserves.find((r) => r.id === id);
    if (!reserve) return;
    onUpdate(callUpReserveForNextMatch(career, id));
    playReserveCallUp();
    setMessage(`${reserve.name} called up for the next game`);
  };

  const handleCancelCallUp = (id: string) => {
    const reserve = career.reserves.find((r) => r.id === id);
    if (!reserve) return;
    onUpdate(cancelReserveCallUp(career, id));
    setMessage(`${reserve.name} call-up cancelled`);
  };

  const handleReleaseClick = (id: string) => {
    const reserve = career.reserves.find((r) => r.id === id);
    if (!reserve) return;
    playUiClick();
    setDetailsId(null);
    setReleaseTarget(reserve);
  };

  const handleToggleProtectFromMassRelease = (id: string) => {
    playUiClick();
    const protectedIds = new Set(
      settings.reserveDevelopmentSettings?.protectedFromMassReleaseIds ?? []
    );
    if (protectedIds.has(id)) protectedIds.delete(id);
    else protectedIds.add(id);
    const nextDev = {
      ...settings.reserveDevelopmentSettings,
      protectedFromMassReleaseIds: [...protectedIds],
      reserveManagementSettingsVersion: 2,
    };
    patchManagerCareerSettings(career, onUpdate, settings, {
      reserveDevelopmentSettings: nextDev,
      reserveReleaseSettings: nextDev,
    });
  };

  /**
   * Release always routes through applyReserveReleases so the player keeps their
   * stable id and lands in the free-agent pool. A failure is surfaced rather
   * than falling back to a delete that would lose them.
   */
  const handleReleaseConfirm = () => {
    if (!releaseTarget) return;
    const result = applyReserveReleases(
      career,
      [{ reserve: releaseTarget, reason: "Released by club" }],
      { forceBelowMinimum: true, ignoreMassReleaseProtection: true }
    );
    if (!result.ok || !result.career) {
      setReleaseTarget(null);
      setReleaseError(
        result.error ?? `${releaseTarget.name} could not be released.`
      );
      return;
    }
    onUpdate(result.career);
    setMessage(`${releaseTarget.name} released to the free-agent pool`);
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

  const getRenewalLabel = (reserve: ManagerReservePlayer): string | null => {
    const contract = career.reserveContracts?.[reserve.id];
    if (!contract) return null;
    const status = getContractStatus(contract);
    if (status !== "expires_this_season" && status !== "wants_renewal") {
      return null;
    }
    const demand =
      contract.renewalDemand ?? generateReserveRenewalDemand(reserve, contract);
    return `${formatWage(demand.wagePerYear)}/yr`;
  };

  const reserveShortfall = Math.max(0, RESERVE_MIN_PLAYERS - career.reserves.length);
  const transferBudget =
    career.managerFinance?.transferBudget ?? career.budget;
  const canAffordRecruitment = transferBudget >= RESERVE_RECRUITMENT_FEE;

  const handleEmergencyRecruitment = () => {
    playUiClick();
    const shortfall = RESERVE_MIN_PLAYERS - career.reserves.length;
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
        size="page"
        label="Academy"
        title="Reserves"
        subtitle={`Youth & reserve squad · ${career.club}`}
      />

      <ManagerSubTabBar
        ariaLabel="Reserves sections"
        active={subTab}
        onChange={setSubTab}
        tabs={[
          { id: "squad", label: "Squad" },
          { id: "settings", label: "Settings" },
        ]}
      />

      {subTab === "settings" ? (
        <ReserveDevelopmentSettingsPanel
          career={career}
          settings={settings}
          onPatch={(patch) =>
            patchManagerCareerSettings(career, onUpdate, settings, patch)
          }
          onUpdate={onUpdate}
        />
      ) : (
      <>
      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      <GamePanel padded>
        <p className={`${TYPO.sectionLabel} text-center`}>Reserve Fixtures</p>
        {!career.isSeasonComplete && upcomingOpp ? (
          <div className="mt-2 text-left">
            <p className={TYPO.sectionLabel}>Next fixture</p>
            <p className="mt-1 font-medium text-white">
              {career.club} Reserves vs {upcomingOpp} Reserves
              {nextFixture ? ` · Round ${nextFixture.round}` : ""}
            </p>
          </div>
        ) : !career.lastReserveResult ? (
          <p className={`${TYPO.bodySm} text-left text-pitch-500`}>
            No reserve fixtures scheduled or played yet.
          </p>
        ) : null}
        {career.lastReserveResult && (
          <div
            className={
              !career.isSeasonComplete && upcomingOpp
                ? "mt-4 border-t border-pitch-700/40 pt-4"
                : ""
            }
          >
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
        {career.isSeasonComplete && !career.lastReserveResult && (
          <p className={`${TYPO.bodySm} text-pitch-500`}>
            Season complete — no further reserve fixtures.
          </p>
        )}
      </GamePanel>

      <GamePanel padded>
        <p className={`${TYPO.sectionLabel} text-center`}>Reserve Squad Summary</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
          <ManagerStat
            label="Squad size"
            value={`${career.reserves.length} / ${RESERVE_MIN_PLAYERS}`}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => {
              playUiClick();
              setReleaseToolsOpen(true);
            }}
          >
            Release Tools
          </GameButton>
        </div>
        {reserveShortfall > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className={TYPO.sectionLabel}>
              Reserve listing short — {career.reserves.length}/{RESERVE_MIN_PLAYERS}{" "}
              registered
            </p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
              {RESERVE_EMERGENCY_RECRUITMENT_EXCUSE}
            </p>
            <p className={`mt-2 ${TYPO.bodySm} text-accent-gold`}>
              Without {RESERVE_MIN_PLAYERS} registered players, reserve fixtures are
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
        <GamePanel
          padded
          label={`Youth intake · ${career.seasonYear}`}
        >
          <p className={`${TYPO.bodySm} text-pitch-300`}>
            {youthProspects.length} academy prospect
            {youthProspects.length === 1 ? "" : "s"} available to sign on cheap
            youth terms.
          </p>
          <div className="mt-3 divide-y divide-pitch-700/40">
            {youthProspects.map((p) => {
              const previewWage = generateReserveYouthContract(p).wagePerYear;
              return (
                <div
                  key={p.id}
                  className="flex flex-col py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      {getFullPositionName(p.position)} · Age {p.age} ·{" "}
                      {p.nationality}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-theme-primary">
                        Rating {p.rating}
                      </span>
                      <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] font-semibold text-accent-gold">
                        POT {p.potentialRating}
                      </span>
                      <span className="rounded-md border border-pitch-600/60 bg-pitch-900/40 px-2 py-0.5 text-[10px] text-pitch-300">
                        {getPotentialTier(p.potentialRating)} · ~
                        {formatWage(previewWage)}/yr
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-0 sm:flex-row">
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

      <GamePanel padded>
        <p className={`${TYPO.sectionLabel} text-center`}>Reserve Filters</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
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
        <div className="mt-2 flex flex-wrap justify-center gap-2">
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

      <GamePanel padded>
        <p className={`${TYPO.sectionLabel} mb-2 text-left`}>
          Reserve players ({rows.length})
        </p>
        {rows.length === 0 ? (
          <GameEmptyState message="No reserve players match your filters." />
        ) : (
          <ManagerPlayerCardGrid>
            {rows.map((r) => {
              const review = evaluateReservePlayerReview(career, r);
              return (
                <ManagerReservePlayerCard
                  key={r.id}
                  model={buildReserveCardModel(career, r)}
                  club={career.club}
                  extraChips={review.flags.map((flag) => ({
                    ...REVIEW_CHIP[flag],
                    title: review.reasons.join(" · "),
                  }))}
                  protectedFromMassRelease={(
                    settings.reserveDevelopmentSettings
                      ?.protectedFromMassReleaseIds ?? []
                  ).includes(r.id)}
                  onToggleProtectFromMassRelease={
                    handleToggleProtectFromMassRelease
                  }
                  onCallUp={handleCallUp}
                  onCancelCallUp={handleCancelCallUp}
                  onPromote={handlePromote}
                  onViewDetails={setDetailsId}
                />
              );
            })}
          </ManagerPlayerCardGrid>
        )}
      </GamePanel>

      {latestMonthlyReport && (
        <GamePanel padded label="Monthly reserve report">
          <p className="font-medium text-white">{latestMonthlyReport.title}</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            Month {getReserveReportMonth(career)} · Season {career.seasonYear}
          </p>
          <div className="mt-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2.5">
            {latestMonthlyReport.body
              .split("\n")
              .filter((line) => line.trim().length > 0)
              .map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className={`${TYPO.bodySm} leading-relaxed text-indigo-100${
                    index > 0 ? " mt-2" : ""
                  }`}
                >
                  {line}
                </p>
              ))}
          </div>
        </GamePanel>
      )}

      {detailsReserve && (
        <ManagerReservePlayerModal
          model={buildReserveCardModel(career, detailsReserve)}
          renewalLabel={getRenewalLabel(detailsReserve)}
          onClose={() => setDetailsId(null)}
          onCallUp={handleCallUp}
          onRenew={handleRenewReserve}
          onRelease={handleReleaseClick}
        />
      )}

      {releaseTarget && (
        <ManagerReserveReleaseModal
          reserve={releaseTarget}
          contract={career.reserveContracts?.[releaseTarget.id] ?? null}
          onCancel={() => setReleaseTarget(null)}
          onConfirm={handleReleaseConfirm}
        />
      )}

      <ManagerDialog
        open={promotionPopup !== null}
        title="Promoted to senior squad"
        message={
          promotionPopup
            ? [
                `${promotionPopup.name} has joined the senior squad.`,
                "",
                `${promotionPopup.position} · Age ${promotionPopup.age} · Rating ${promotionPopup.rating}`,
                promotionPopup.oldWageLabel
                  ? `Wage: ${promotionPopup.oldWageLabel}/yr → ${promotionPopup.newWageLabel}/yr`
                  : `Wage: ${promotionPopup.newWageLabel}/yr`,
                `Contract: ${promotionPopup.years} year${promotionPopup.years === 1 ? "" : "s"}`,
              ].join("\n")
            : ""
        }
        confirmLabel="Continue"
        onConfirm={() => setPromotionPopup(null)}
        onCancel={() => setPromotionPopup(null)}
      />

      <ManagerDialog
        open={releaseError !== null}
        title="Release failed"
        message={releaseError ?? ""}
        onConfirm={() => setReleaseError(null)}
        onCancel={() => setReleaseError(null)}
      />

      <ManagerReserveReleaseToolsModal
        open={releaseToolsOpen}
        career={career}
        onClose={() => setReleaseToolsOpen(false)}
        onUpdate={onUpdate}
        onMessage={setMessage}
      />
      </>
      )}
      </ManagerSection>
    </ManagerPage>
  );
}
