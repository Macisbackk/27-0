"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerLeagueTransferCard,
  ManagerTransferPlayerCard,
} from "@/components/manager/ManagerTransferPlayerCard";
import {
  ManagerTransferResultModal,
  type TransferResultDetails,
} from "@/components/manager/ManagerTransferResultModal";
import { ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import { getTransferBudget } from "@/lib/manager/managerFinance";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatWage } from "@/lib/manager/managerContracts";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { applyManagerModeRatingToPlayer } from "@/lib/manager/managerSquadRatings";
import {
  completePlayerPurchase,
  evaluateBuyOffer,
  getAllLeaguePlayers,
  getAskingPrice,
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

function withManagerRating(player: Player): Player {
  return applyManagerModeRatingToPlayer(player);
}

export function ManagerTransfers({
  career,
  onUpdate,
}: ManagerTransfersProps) {
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

  const wageOverBudget = career.wageBill > career.wageBudget;
  const wagePct = Math.round(
    (career.wageBill / Math.max(1, career.wageBudget)) * 100
  );
  const transferFund = getTransferBudget(career);

  const listedPlayers = useMemo(() => {
    return career.leagueListedPlayers
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

  const leagueSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return getAllLeaguePlayers(career)
      .map(({ playerId, club }) => {
        const raw = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!raw) return null;
        const player = withManagerRating(raw);
        const listed = career.leagueListedPlayers.some(
          (l) => l.playerId === playerId
        );
        return { player, club, listed };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => !r.listed)
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
          return a.club.localeCompare(b.club) || b.player.peakRating - a.player.peakRating;
        }
        if (leagueSort === "name") {
          return a.player.name.localeCompare(b.player.name);
        }
        return b.player.peakRating - a.player.peakRating;
      })
      .slice(0, 24);
  }, [career, search, positionFilter, leagueSort]);

  const leagueTransfers = career.leagueTransfers ?? [];

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
    const demand = getTransferDemand(playerId, career.club);
    const fee =
      offerOverride?.transferFee ??
      (listed
        ? getSellerAskingPrice(career, playerId, club, true)
        : offerPlayerId === playerId && offerFee > 0
          ? offerFee
          : getAskingPrice(playerId, false, career.seed, career.gameWeek));

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
    const demand = getTransferDemand(playerId, career.club);
    playUiClick();
    setListedNegotiateId(playerId);
    setListedOfferWage(demand.wagePerYear);
    setListedOfferYears(demand.yearsRequested);
    setOfferPlayerId(null);
  };

  const submitListedAssistantDeal = (playerId: string, club: string) => {
    const demand = getTransferDemand(playerId, career.club);
    const asking = getSellerAskingPrice(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(playerId, club, true, {
      transferFee: asking,
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
    });
  };

  const submitListedNegotiatedDeal = (playerId: string, club: string) => {
    const asking = getSellerAskingPrice(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(playerId, club, true, {
      transferFee: asking,
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
    const demand = getTransferDemand(playerId, career.club);
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
    const demand = getTransferDemand(playerId, career.club);
    playUiClick();
    setFreeAgentNegotiateId(playerId);
    setFreeAgentOfferWage(demand.wagePerYear);
    setFreeAgentOfferYears(demand.yearsRequested);
    setListedNegotiateId(null);
    setOfferPlayerId(null);
  };

  const submitFreeAgentAssistantDeal = (playerId: string, formerClub: string) => {
    const demand = getTransferDemand(playerId, career.club);
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

  return (
    <div className={`w-full ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.viewTitle}>Transfers</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Sign listed players, pick up free agents, or bid for anyone in the league
        </p>
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
      </ManagerSectionCard>

      {leagueTransfers.length > 0 && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.sectionLabel}>Recent League Transfers</p>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {leagueTransfers.slice(0, 8).map((tx) => (
              <ManagerLeagueTransferCard
                key={tx.id}
                compact
                playerName={tx.playerName}
                fromClub={tx.fromClub}
                toClub={tx.toClub}
                fee={tx.fee}
                week={tx.week}
              />
            ))}
          </ul>
          {leagueTransfers.length > 8 && (
            <p className={`mt-1.5 ${TYPO.bodySm} text-pitch-500`}>
              +{leagueTransfers.length - 8} more this season
            </p>
          )}
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-3`}>Filter by position</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`rounded-lg border px-2 py-1 text-xs ${
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
              className={`rounded-lg border px-2 py-1 text-xs ${
                positionFilter === pos ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className={TYPO.sectionLabel}>Available Players</h2>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
            Transfer-listed — negotiate contract terms or leave the deal to your
            assistant
          </p>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {listedPlayers.map(({ player, club, askingPrice }) => {
            const demand = getTransferDemand(player.id, career.club);
            const isNegotiating = listedNegotiateId === player.id;
            const canAffordFee = getTransferBudget(career) >= askingPrice;
            const canAffordAssistant =
              canAffordFee &&
              career.wageBill + demand.wagePerYear <= career.wageBudget * 1.05;
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed
                fee={askingPrice}
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
                        disabled={!canAffordFee}
                        onClick={() =>
                          submitListedNegotiatedDeal(player.id, club)
                        }
                      >
                        Submit offer — {formatWage(askingPrice)}
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!canAffordFee}
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

      <section className="space-y-3">
        <div>
          <h2 className={TYPO.sectionLabel}>Free Agents</h2>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
            Out-of-contract players — no transfer fee, negotiate wages only
          </p>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {freeAgents.map(({ player, formerClub, playerId }) => {
            const demand = getTransferDemand(player.id, career.club);
            const isNegotiating = freeAgentNegotiateId === player.id;
            const canAffordAssistant =
              career.wageBill + demand.wagePerYear <= career.wageBudget * 1.05;
            const canAffordNegotiated =
              career.wageBill + freeAgentOfferWage <= career.wageBudget * 1.05;
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
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

      <section className="space-y-3">
        <div>
          <h2 className={TYPO.sectionLabel}>Search League Players</h2>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
            Bid for any Super League player — unlisted deals cost more
          </p>
        </div>
        <input
          type="search"
          placeholder="Search by name or club…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${FILTER.input} mb-3`}
        />
        <div className="mb-3 flex flex-wrap gap-2">
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
              className={`rounded-lg border px-2 py-1 text-xs ${
                leagueSort === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {leagueSearch.map(({ player, club }) => {
            const fee = getAskingPrice(
              player.id,
              false,
              career.seed,
              career.gameWeek
            );
            const demand = getTransferDemand(player.id, career.club);
            const isOffering = offerPlayerId === player.id;
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed={false}
                fee={isOffering && offerFee > 0 ? offerFee : fee}
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
                      onClick={() => submitTransferOffer(player.id, club, false)}
                    >
                      Submit {formatWage(offerFee)} offer
                    </GameButton>
                  </div>
                ) : (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      playUiClick();
                      setOfferPlayerId(player.id);
                      setOfferFee(fee);
                    }}
                  >
                    Make offer — from {formatWage(fee)}
                  </GameButton>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
        </div>
      </section>

      {transferResult && (
        <ManagerTransferResultModal
          result={transferResult}
          onClose={() => setTransferResult(null)}
        />
      )}
    </div>
  );
}
