"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
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

export function ManagerTransfers({
  career,
  onUpdate,
}: ManagerTransfersProps) {
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [search, setSearch] = useState("");
  const [transferResult, setTransferResult] =
    useState<TransferResultDetails | null>(null);
  const [offerPlayerId, setOfferPlayerId] = useState<string | null>(null);
  const [offerFee, setOfferFee] = useState(0);

  const listedPlayers = useMemo(() => {
    return career.leagueListedPlayers
      .map((entry) => {
        const player = getPlayerById(entry.playerId);
        if (!player) return null;
        return { ...entry, player };
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
    return getAllLeaguePlayers(career.club)
      .map(({ playerId, club }) => {
        const player = getPlayerById(playerId);
        if (!player) return null;
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
      .slice(0, 24);
  }, [career, search, positionFilter]);

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
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Transfers</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Budget: {formatWage(career.budget)} · Wage bill:{" "}
          {formatWage(career.wageBill)} / {formatWage(career.wageBudget)}
        </p>
      </div>

      {leagueTransfers.length > 0 && (
        <section className={`${CARD.base} ${SPACING.cardPadding}`}>
          <h2 className={`${TYPO.sectionLabel} mb-2`}>League Transfers</h2>
          <ul className={`max-h-48 overflow-y-auto ${SPACING.stackSm}`}>
            {leagueTransfers.slice(0, 12).map((tx) => (
              <li
                key={tx.id}
                className={`${TYPO.bodySm} border-b border-pitch-800/60 pb-2 last:border-0`}
              >
                <span className="font-medium text-white">{tx.playerName}</span>
                <span className="text-pitch-400">
                  {" "}
                  — {tx.fromClub} → {tx.toClub}
                </span>
                <span className="block text-pitch-500">
                  {formatWage(tx.fee)} · Week {tx.week}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filter by position</p>
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

      <section>
        <h2 className={`${TYPO.sectionLabel} mb-2`}>Available Players</h2>
        <p className={`mb-2 ${TYPO.bodySm} text-pitch-500`}>
          Transfer-listed players only
        </p>
        <div className={`grid gap-2 sm:grid-cols-2`}>
          {listedPlayers.map(({ player, club, askingPrice }) => {
            const demand = getTransferDemand(player.id, career.club);
            return (
              <div
                key={player.id}
                className={`${CARD.base} ${SPACING.cardPaddingSm}`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{player.name}</p>
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      {club} · {player.peakRating} rated
                    </p>
                    <p className={`${TYPO.bodySm} text-pitch-500`}>
                      Ask: {formatWage(askingPrice)} · Wage:{" "}
                      {formatWage(demand.wagePerYear)}/yr
                    </p>
                  </div>
                  <span className="text-sm text-accent-gold">
                    {formatValue(player.value)}
                  </span>
                </div>
                <GameButton
                  variant="theme"
                  size="sm"
                  className="mt-2"
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
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              No transfer-listed players available right now.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className={`${TYPO.sectionLabel} mb-2`}>Search League Players</h2>
        <p className={`mb-2 ${TYPO.bodySm} text-pitch-500`}>
          Bid for any Super League player — unlisted players cost more
        </p>
        <input
          type="search"
          placeholder="Search by name or club…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2 text-white"
        />
        <div className={`grid gap-2 sm:grid-cols-2`}>
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
                className={`${CARD.inset} ${SPACING.cardPaddingSm}`}
              >
                <p className="font-medium text-white">{player.name}</p>
                <p className={`${TYPO.bodySm} text-pitch-400`}>
                  {club} · {player.peakRating} · {formatValue(player.value)}
                </p>
                <p className={`${TYPO.bodySm} text-pitch-500`}>
                  Est. fee: {formatWage(fee)}+ (unlisted)
                </p>
                {isOffering ? (
                  <div className="mt-2">
                    <input
                      type="number"
                      step={5000}
                      value={offerFee}
                      onChange={(e) => setOfferFee(Number(e.target.value))}
                      className="w-full rounded border border-pitch-600 bg-pitch-900 px-2 py-1 text-sm text-white"
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
                    className="mt-2"
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
