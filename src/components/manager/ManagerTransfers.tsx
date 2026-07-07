"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerTransferPlayerCard,
} from "@/components/manager/ManagerTransferPlayerCard";
import {
  ManagerTransferResultModal,
  type TransferResultDetails,
} from "@/components/manager/ManagerTransferResultModal";
import { ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import {
  canAffordAdditionalWage,
  evaluateClubSigningAppeal,
  getComfortableSigningRating,
  getTransferBudget,
  getWageBillPercent,
  isWageOverBudget,
} from "@/lib/manager/managerFinance";
import { isSameManagerClub } from "@/lib/clubs/super-league-display";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatWage } from "@/lib/manager/managerContracts";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { applyManagerModeRatingToPlayer } from "@/lib/manager/managerSquadRatings";
import {
  completePlayerPurchase,
  evaluateBuyOffer,
  getAllLeaguePlayers,
  getBuyerMinimumTransferFee,
  getSellerAskingPrice,
} from "@/lib/manager/managerTransferLeague";
import {
  completeFreeAgentSigning,
  evaluateFreeAgentOffer,
} from "@/lib/manager/managerFreeAgents";
import { getTransferDemand } from "@/lib/manager/managerTransfers";
import { getPlayerById } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Player, Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { playUiClick } from "@/lib/sound";

interface ManagerTransfersProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

type TransferTab = "listed" | "freeAgents" | "unlisted";

const TRANSFER_TAB_LABELS: Record<TransferTab, string> = {
  listed: "Listed",
  freeAgents: "Free agents",
  unlisted: "Unlisted",
};

const TRANSFER_TAB_SHORT_LABELS: Record<TransferTab, string> = {
  listed: "Listed",
  freeAgents: "Free",
  unlisted: "Bid",
};

function withManagerRating(player: Player): Player {
  return applyManagerModeRatingToPlayer(player);
}

export function ManagerTransfers({
  career,
  onUpdate,
}: ManagerTransfersProps) {
  const [tab, setTab] = useState<TransferTab>("listed");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [leagueSort, setLeagueSort] = useState<"rating" | "team" | "name">(
    "rating"
  );
  const [search, setSearch] = useState("");
  const [transferResult, setTransferResult] =
    useState<TransferResultDetails | null>(null);
  const [offerPlayerId, setOfferPlayerId] = useState<string | null>(null);
  const [offerFee, setOfferFee] = useState(0);
  const [listedNegotiateId, setListedNegotiateId] = useState<string | null>(null);
  const [listedOfferWage, setListedOfferWage] = useState(0);
  const [listedOfferYears, setListedOfferYears] = useState(1);
  const [freeAgentNegotiateId, setFreeAgentNegotiateId] = useState<string | null>(
    null
  );
  const [freeAgentOfferWage, setFreeAgentOfferWage] = useState(0);
  const [freeAgentOfferYears, setFreeAgentOfferYears] = useState(1);

  const wageOverBudget = isWageOverBudget(career);
  const wagePct = getWageBillPercent(career);
  const transferFund = getTransferBudget(career);

  const listedPlayerIds = useMemo(
    () => new Set(career.leagueListedPlayers.map((l) => l.playerId)),
    [career.leagueListedPlayers]
  );

  const freeAgentIds = useMemo(
    () => new Set((career.freeAgents ?? []).map((f) => f.playerId)),
    [career.freeAgents]
  );

  /** Full unlisted pool — not transfer-listed, not a free agent, not at your club. */
  const allUnlistedPlayers = useMemo(() => {
    return getAllLeaguePlayers(career)
      .map(({ playerId, club }) => {
        const raw =
          getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!raw) return null;
        return { player: withManagerRating(raw), club, playerId };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => !listedPlayerIds.has(r.playerId))
      .filter((r) => !freeAgentIds.has(r.playerId));
  }, [career, listedPlayerIds, freeAgentIds]);

  const tabCounts = useMemo(
    () => ({
      listed: career.leagueListedPlayers.filter((entry) =>
        Boolean(getPlayerById(entry.playerId))
      ).length,
      freeAgents: (career.freeAgents ?? []).filter(
        (entry) =>
          Boolean(
            getManagerPlayer(career, entry.playerId) ??
              getPlayerById(entry.playerId)
          )
      ).length,
    }),
    [career]
  );

  const comfortableTarget = getComfortableSigningRating(career.club);

  const listedPlayers = useMemo(() => {
    return career.leagueListedPlayers
      .filter((entry) => !isSameManagerClub(entry.club, career.club))
      .map((entry) => {
        const raw = getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career.leagueListedPlayers, positionFilter]);

  const freeAgents = useMemo(() => {
    return (career.freeAgents ?? [])
      .map((entry) => {
        const raw =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career, positionFilter]);

  const unlistedPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUnlistedPlayers
      .filter((r) => {
        if (!q) return true;
        return (
          r.player.name.toLowerCase().includes(q) ||
          r.club.toLowerCase().includes(q)
        );
      })
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => {
        if (leagueSort === "team") {
          return (
            a.club.localeCompare(b.club) ||
            b.player.peakRating - a.player.peakRating
          );
        }
        if (leagueSort === "name") {
          return a.player.name.localeCompare(b.player.name);
        }
        return b.player.peakRating - a.player.peakRating;
      });
  }, [allUnlistedPlayers, search, positionFilter, leagueSort]);

  const submitTransferOffer = (
    playerId: string,
    club: string,
    listed: boolean,
    offerOverride?: {
      transferFee: number;
      wagePerYear: number;
      yearsRequested: number;
    }
  ) => {
    const player = getPlayerById(playerId);
    const demand = getTransferDemand(career, playerId);
    const fee =
      offerOverride?.transferFee ??
      (listed
        ? getBuyerMinimumTransferFee(career, playerId, club, true)
        : offerPlayerId === playerId && offerFee > 0
          ? offerFee
          : getBuyerMinimumTransferFee(career, playerId, club, false));

    const offer = offerOverride
      ? { ...offerOverride, squadRole: demand.squadRole }
      : {
      transferFee: fee,
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
      squadRole: demand.squadRole,
    };

    const result = evaluateBuyOffer(career, playerId, club, offer, listed);
    setTransferResult({
      playerName: player?.name ?? "Player",
      club,
      fee: offer.transferFee,
      wagePerYear: offer.wagePerYear,
      years: offer.yearsRequested,
      accepted: result.accepted,
      reason: result.reason,
    });

    if (result.accepted) {
      onUpdate(completePlayerPurchase(career, playerId, club, offer, listed));
      setOfferPlayerId(null);
      setListedNegotiateId(null);
    }
  };

  const openListedNegotiation = (playerId: string) => {
    const demand = getTransferDemand(career, playerId);
    playUiClick();
    setListedNegotiateId(playerId);
    setListedOfferWage(demand.wagePerYear);
    setListedOfferYears(demand.yearsRequested);
    setOfferPlayerId(null);
  };

  const submitListedAssistantDeal = (playerId: string, club: string) => {
    const demand = getTransferDemand(career, playerId);
    const buyerFee = getBuyerMinimumTransferFee(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(playerId, club, true, {
      transferFee: buyerFee,
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
    });
  };

  const submitListedNegotiatedDeal = (playerId: string, club: string) => {
    const buyerFee = getBuyerMinimumTransferFee(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(playerId, club, true, {
      transferFee: buyerFee,
      wagePerYear: listedOfferWage,
      yearsRequested: listedOfferYears,
    });
  };

  const submitFreeAgentOffer = (
    playerId: string,
    formerClub: string,
    offerOverride?: {
      wagePerYear: number;
      yearsRequested: number;
    }
  ) => {
    const player = getPlayerById(playerId);
    const demand = getTransferDemand(career, playerId);
    const offer = {
      transferFee: 0,
      wagePerYear: offerOverride?.wagePerYear ?? demand.wagePerYear,
      yearsRequested: offerOverride?.yearsRequested ?? demand.yearsRequested,
      squadRole: demand.squadRole,
    };

    const result = evaluateFreeAgentOffer(career, playerId, offer);
    setTransferResult({
      playerName: player?.name ?? "Player",
      club: formerClub,
      fee: 0,
      wagePerYear: offer.wagePerYear,
      years: offer.yearsRequested,
      accepted: result.accepted,
      reason: result.reason,
      freeTransfer: true,
    });

    if (result.accepted) {
      onUpdate(completeFreeAgentSigning(career, playerId, offer));
      setFreeAgentNegotiateId(null);
      setListedNegotiateId(null);
      setOfferPlayerId(null);
    }
  };

  const openFreeAgentNegotiation = (playerId: string) => {
    const demand = getTransferDemand(career, playerId);
    playUiClick();
    setFreeAgentNegotiateId(playerId);
    setFreeAgentOfferWage(demand.wagePerYear);
    setFreeAgentOfferYears(demand.yearsRequested);
    setListedNegotiateId(null);
    setOfferPlayerId(null);
  };

  const submitFreeAgentAssistantDeal = (playerId: string, formerClub: string) => {
    const demand = getTransferDemand(career, playerId);
    playUiClick();
    submitFreeAgentOffer(playerId, formerClub, {
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
    });
  };

  const submitFreeAgentNegotiatedDeal = (
    playerId: string,
    formerClub: string
  ) => {
    playUiClick();
    submitFreeAgentOffer(playerId, formerClub, {
      wagePerYear: freeAgentOfferWage,
      yearsRequested: freeAgentOfferYears,
    });
  };

  const switchTab = (next: TransferTab) => {
    if (tab === next) return;
    setTab(next);
    setListedNegotiateId(null);
    setFreeAgentNegotiateId(null);
    setOfferPlayerId(null);
  };

  const transferSubTabs = (
    [
      ["listed", tabCounts.listed],
      ["freeAgents", tabCounts.freeAgents],
      ["unlisted", null],
    ] as const
  ).map(([id, count]) => ({
    id,
    label: `${TRANSFER_TAB_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
    shortLabel: `${TRANSFER_TAB_SHORT_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
  }));

  const tabSubtitle =
    tab === "listed"
      ? "Players openly on the market — negotiate terms or leave the deal to your assistant"
      : tab === "freeAgents"
        ? "Out-of-contract players — no transfer fee, negotiate wages only"
        : "Bid for any Super League player not on the transfer list — deals cost more";

  return (
    <div className={`w-full ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.viewTitle}>Transfers</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{tabSubtitle}</p>
      </div>

      <ManagerSectionCard title="Funds & wages" variant="elevated" accent="primary">
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ManagerStat
            label="Transfer fund"
            value={formatWage(transferFund)}
            tone="gold"
            large
          />
          <ManagerStat
            label="Wage bill"
            value={formatWage(career.wageBill)}
            tone={wageOverBudget ? "amber" : "default"}
            large
          />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-pitch-500">
            <span>
              Wage budget {formatWage(career.wageBudget)} ·{" "}
              {wagePct}% used
            </span>
            <span className={wageOverBudget ? "text-amber-300" : "text-theme-primary"}>
              {wageOverBudget ? "Over budget" : "Within budget"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-pitch-800">
            <div
              className={`h-full transition-all ${
                wageOverBudget ? "bg-amber-400" : "bg-theme-primary"
              }`}
              style={{ width: `${Math.min(100, wagePct)}%` }}
            />
          </div>
        </div>
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          Realistic targets sit around {comfortableTarget} rating — higher-rated
          players cost premium fees and may refuse lower clubs.
        </p>
      </ManagerSectionCard>

      <ManagerSubTabBar tabs={transferSubTabs} active={tab} onChange={switchTab} />

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-3`}>Filter by position</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`${FILTER.chipTouch} ${
              positionFilter === "all" ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
            }`}
          >
            All
          </button>
          {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`${FILTER.chipTouch} ${
                positionFilter === pos ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      {tab === "listed" && (
      <section className="space-y-3">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {listedPlayers.map(({ player, club }) => {
            const demand = getTransferDemand(career, player.id);
            const listedPrice = getSellerAskingPrice(
              career,
              player.id,
              club,
              true
            );
            const buyerFee = getBuyerMinimumTransferFee(
              career,
              player.id,
              club,
              true
            );
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating
            );
            const isNegotiating = listedNegotiateId === player.id;
            const canAffordFee = getTransferBudget(career) >= buyerFee;
            const canAffordAssistant =
              appeal.allowed &&
              canAffordFee &&
              canAffordAdditionalWage(career, demand.wagePerYear);
            const canAffordNegotiated =
              appeal.allowed &&
              canAffordFee &&
              canAffordAdditionalWage(career, listedOfferWage);
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed
                fee={buyerFee}
                sellerListedFee={
                  listedPrice < buyerFee ? listedPrice : undefined
                }
                wagePerYear={isNegotiating ? listedOfferWage : demand.wagePerYear}
                yearsRequested={
                  isNegotiating ? listedOfferYears : demand.yearsRequested
                }
              >
                {isNegotiating ? (
                  <div className="space-y-3">
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      Player demands: {formatWage(demand.wagePerYear)}/yr ·{" "}
                      {demand.yearsRequested}yr
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Wage (£/yr)</span>
                        <input
                          type="number"
                          step={1000}
                          value={listedOfferWage}
                          onChange={(e) =>
                            setListedOfferWage(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Contract length</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={listedOfferYears}
                          onChange={(e) =>
                            setListedOfferYears(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth
                        disabled={!canAffordNegotiated}
                        onClick={() =>
                          submitListedNegotiatedDeal(player.id, club)
                        }
                      >
                        Submit offer — {formatWage(buyerFee)}
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          setListedNegotiateId(null);
                        }}
                      >
                        Cancel
                      </GameButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!appeal.allowed && appeal.reason && (
                      <p className={`${TYPO.bodySm} text-amber-300/90`}>
                        {appeal.reason}
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!canAffordFee || !appeal.allowed}
                      onClick={() => openListedNegotiation(player.id)}
                    >
                      Negotiate deal
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordAssistant}
                      onClick={() =>
                        submitListedAssistantDeal(player.id, club)
                      }
                    >
                      Leave to assistant
                    </GameButton>
                    </div>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {listedPlayers.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              No transfer-listed players available right now.
            </p>
          )}
        </div>
      </section>
      )}

      {tab === "freeAgents" && (
      <section className="space-y-3">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {freeAgents.map(({ player, formerClub, playerId }) => {
            const demand = getTransferDemand(career, player.id);
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating
            );
            const isNegotiating = freeAgentNegotiateId === player.id;
            const canAffordAssistant =
              appeal.allowed &&
              canAffordAdditionalWage(career, demand.wagePerYear);
            const canAffordNegotiated =
              appeal.allowed &&
              canAffordAdditionalWage(career, freeAgentOfferWage);
            return (
              <ManagerTransferPlayerCard
                key={playerId}
                player={player}
                club={formerClub}
                listed={false}
                freeAgent
                fee={0}
                wagePerYear={isNegotiating ? freeAgentOfferWage : demand.wagePerYear}
                yearsRequested={
                  isNegotiating ? freeAgentOfferYears : demand.yearsRequested
                }
              >
                {isNegotiating ? (
                  <div className="space-y-3">
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      Player demands: {formatWage(demand.wagePerYear)}/yr ·{" "}
                      {demand.yearsRequested}yr
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Wage (£/yr)</span>
                        <input
                          type="number"
                          step={1000}
                          value={freeAgentOfferWage}
                          onChange={(e) =>
                            setFreeAgentOfferWage(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Contract length</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={freeAgentOfferYears}
                          onChange={(e) =>
                            setFreeAgentOfferYears(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth
                        disabled={!canAffordNegotiated}
                        onClick={() =>
                          submitFreeAgentNegotiatedDeal(playerId, formerClub)
                        }
                      >
                        Submit offer — Free
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          setFreeAgentNegotiateId(null);
                        }}
                      >
                        Cancel
                      </GameButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!appeal.allowed && appeal.reason && (
                      <p className={`${TYPO.bodySm} text-amber-300/90`}>
                        {appeal.reason}
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!appeal.allowed}
                      onClick={() => openFreeAgentNegotiation(player.id)}
                    >
                      Negotiate deal
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordAssistant}
                      onClick={() =>
                        submitFreeAgentAssistantDeal(playerId, formerClub)
                      }
                    >
                      Leave to assistant
                    </GameButton>
                    </div>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {freeAgents.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              No free agents available right now. Players appear here when contracts
              expire at season end.
            </p>
          )}
        </div>
      </section>
      )}

      {tab === "unlisted" && (
      <section className="space-y-3">
        <input
          type="search"
          placeholder="Search by name or club…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={FILTER.input}
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["rating", "Highest rating"],
              ["team", "Sort by team"],
              ["name", "Sort by name"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLeagueSort(id)}
              className={`${FILTER.chipTouch} ${
                leagueSort === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {unlistedPlayers.map(({ player, club }) => {
            const listedPrice = getSellerAskingPrice(
              career,
              player.id,
              club,
              false
            );
            const buyerFee = getBuyerMinimumTransferFee(
              career,
              player.id,
              club,
              false
            );
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating
            );
            const demand = getTransferDemand(career, player.id);
            const isOffering = offerPlayerId === player.id;
            const canAffordBid =
              appeal.allowed && getTransferBudget(career) >= buyerFee;
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed={false}
                fee={isOffering && offerFee > 0 ? offerFee : buyerFee}
                sellerListedFee={
                  listedPrice < buyerFee ? listedPrice : undefined
                }
                wagePerYear={demand.wagePerYear}
                yearsRequested={demand.yearsRequested}
              >
                {isOffering ? (
                  <div className="space-y-2">
                    <label className={TYPO.bodySm}>
                      <span className="text-pitch-500">Your bid</span>
                      <input
                        type="number"
                        step={5000}
                        value={offerFee}
                        onChange={(e) => setOfferFee(Number(e.target.value))}
                        className={`${FILTER.input} mt-1`}
                      />
                    </label>
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!appeal.allowed}
                      onClick={() => submitTransferOffer(player.id, club, false)}
                    >
                      Submit {formatWage(offerFee)} offer
                    </GameButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!appeal.allowed && appeal.reason && (
                      <p className={`${TYPO.bodySm} text-amber-300/90`}>
                        {appeal.reason}
                      </p>
                    )}
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordBid}
                      onClick={() => {
                        playUiClick();
                        setOfferPlayerId(player.id);
                        setOfferFee(buyerFee);
                      }}
                    >
                      Make offer — from {formatWage(buyerFee)}
                    </GameButton>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {unlistedPlayers.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              {allUnlistedPlayers.length === 0
                ? "No unlisted players available to bid on right now."
                : "No unlisted players match your filters."}
            </p>
          )}
        </div>
      </section>
      )}

      {transferResult && (
        <ManagerTransferResultModal
          result={transferResult}
          onClose={() => setTransferResult(null)}
        />
      )}
    </div>
  );
}
