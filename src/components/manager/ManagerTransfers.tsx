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
} from "@/lib/manager/managerTransferLeague";
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

  const wageOverBudget = career.wageBill > career.wageBudget;
  const wagePct = Math.round(
    (career.wageBill / Math.max(1, career.wageBudget)) * 100
  );

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
    listed: boolean
  ) => {
    const player = getPlayerById(playerId);
    const demand = getTransferDemand(playerId, career.club);
    const fee =
      offerPlayerId === playerId && offerFee > 0
        ? offerFee
        : getAskingPrice(playerId, listed, career.seed, career.gameWeek);

    const offer = {
      transferFee: fee,
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
      squadRole: demand.squadRole,
    };

    const result = evaluateBuyOffer(career, playerId, club, offer, listed);
    setTransferResult({
      playerName: player?.name ?? "Player",
      club,
      fee,
      wagePerYear: demand.wagePerYear,
      years: demand.yearsRequested,
      accepted: result.accepted,
      reason: result.reason,
    });

    if (result.accepted) {
      onUpdate(completePlayerPurchase(career, playerId, club, offer, listed));
      setOfferPlayerId(null);
    }
  };

  return (
    <div className={`w-full ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Transfers</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Sign listed players or bid for anyone in the league
        </p>
      </div>

      <ManagerSectionCard title="Transfer Budget" variant="elevated" accent="gold">
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ManagerStat
            label="Available funds"
            value={formatWage(career.budget)}
            tone="gold"
            large
          />
          <ManagerStat
            label="Wage bill"
            value={formatWage(career.wageBill)}
            tone={wageOverBudget ? "amber" : "default"}
          />
          <ManagerStat
            label="Wage budget"
            value={formatWage(career.wageBudget)}
            tone="sky"
          />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-pitch-500">
            <span>Wage budget used</span>
            <span className={wageOverBudget ? "text-amber-300" : "text-theme-primary"}>
              {wagePct}%
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
        <ManagerSectionCard title="League Transfers" variant="inset">
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {leagueTransfers.slice(0, 12).map((tx) => (
              <ManagerLeagueTransferCard
                key={tx.id}
                playerName={tx.playerName}
                fromClub={tx.fromClub}
                toClub={tx.toClub}
                fee={tx.fee}
                week={tx.week}
              />
            ))}
          </ul>
        </ManagerSectionCard>
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
            Transfer-listed — ready to sign at the asking price
          </p>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {listedPlayers.map(({ player, club, askingPrice }) => {
            const demand = getTransferDemand(player.id, career.club);
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed
                fee={askingPrice}
                wagePerYear={demand.wagePerYear}
                yearsRequested={demand.yearsRequested}
                squadRole={demand.squadRole}
              >
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth
                  disabled={career.budget < askingPrice}
                  onClick={() => {
                    playUiClick();
                    submitTransferOffer(player.id, club, true);
                  }}
                >
                  Sign for {formatWage(askingPrice)}
                </GameButton>
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
                squadRole={demand.squadRole}
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
