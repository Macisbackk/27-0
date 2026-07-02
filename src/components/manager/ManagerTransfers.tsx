"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Player, Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { applyManagerModeRatingToPlayer } from "@/lib/manager/managerSquadRatings";
import { formatWage } from "@/lib/manager/managerContracts";
import {
  completePlayerPurchase,
  evaluateBuyOffer,
  getAllLeaguePlayers,
  getAskingPrice,
} from "@/lib/manager/managerTransferLeague";
import { getTransferDemand } from "@/lib/manager/managerTransfers";
import { playUiClick } from "@/lib/sound";
import {
  ManagerTransferResultModal,
  type TransferResultDetails,
} from "@/components/manager/ManagerTransferResultModal";

interface ManagerTransfersProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

function withManagerRating(player: Player): Player {
  return applyManagerModeRatingToPlayer(player);
}

function formatPositions(player: Player): string {
  return getPlayerEligiblePositions(player)
    .map((p) => POSITION_SHORT[p])
    .join(" · ");
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
          Budget: {formatWage(career.budget)} · Wage bill{" "}
          {formatWage(career.wageBill)} / {formatWage(career.wageBudget)}
        </p>
      </div>

      {leagueTransfers.length > 0 && (
        <section className={`${CARD.base} ${SPACING.cardPadding}`}>
          <h2 className={`${TYPO.sectionLabel} mb-3`}>League Transfers</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leagueTransfers.slice(0, 12).map((tx) => (
              <li
                key={tx.id}
                className={`${CARD.inset} ${SPACING.cardPaddingSm} ${TYPO.bodySm}`}
              >
                <span className="font-medium text-white">{tx.playerName}</span>
                <span className="mt-0.5 block text-pitch-400">
                  {tx.fromClub} → {tx.toClub}
                </span>
                <span className="mt-1 block text-pitch-500">
                  {formatWage(tx.fee)} · Week {tx.week}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
            Transfer-listed players only
          </p>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {listedPlayers.map(({ player, club, askingPrice }) => {
            const demand = getTransferDemand(player.id, career.club);
            return (
              <div
                key={player.id}
                className={`${CARD.base} ${SPACING.cardPadding} flex flex-col`}
              >
                <div className="flex flex-1 justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{player.name}</p>
                    <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
                      {club}
                    </p>
                    <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                      {formatPositions(player)} · {player.peakRating} rated
                    </p>
                    <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                      Ask: {formatWage(askingPrice)}
                    </p>
                    <p className={`${TYPO.bodySm} text-pitch-500`}>
                      Wage: {formatWage(demand.wagePerYear)}/yr
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-accent-gold">
                    {formatValue(player.value)}
                  </span>
                </div>
                <GameButton
                  variant="theme"
                  size="sm"
                  className="mt-4"
                  disabled={career.budget < askingPrice}
                  onClick={() => {
                    playUiClick();
                    submitTransferOffer(player.id, club, true);
                  }}
                >
                  Sign — {formatWage(askingPrice)}
                </GameButton>
              </div>
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
            Bid for any Super League player — unlisted players cost more
          </p>
        </div>
        <input
          type="search"
          placeholder="Search by name or club…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2 text-white"
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
            const isOffering = offerPlayerId === player.id;
            return (
              <div
                key={player.id}
                className={`${CARD.inset} ${SPACING.cardPadding} flex flex-col`}
              >
                <p className="font-medium text-white">{player.name}</p>
                <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{club}</p>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                  {formatPositions(player)} · {player.peakRating} rated
                </p>
                <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                  Value: {formatValue(player.value)}
                </p>
                <p className={`${TYPO.bodySm} text-pitch-500`}>
                  Est. fee: {formatWage(fee)}+ (unlisted)
                </p>
                {isOffering ? (
                  <div className="mt-4">
                    <input
                      type="number"
                      step={5000}
                      value={offerFee}
                      onChange={(e) => setOfferFee(Number(e.target.value))}
                      className="w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm text-white"
                    />
                    <GameButton
                      variant="theme"
                      size="sm"
                      className="mt-2"
                      onClick={() => submitTransferOffer(player.id, club, false)}
                    >
                      Submit Offer
                    </GameButton>
                  </div>
                ) : (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      playUiClick();
                      setOfferPlayerId(player.id);
                      setOfferFee(fee);
                    }}
                  >
                    Make Offer
                  </GameButton>
                )}
              </div>
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
