"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import {
  formatPositionLabel,
  formatPositionShort,
  formatSquadTier,
  PLAYER_INVESTMENT_DEFINITIONS,
  getPlayerInvestmentCost,
  canPlayerReceiveInvestment,
  getDevelopmentResultsForTier,
  type PlayerInvestmentType,
} from "@/lib/manager";
import type { ManagerPlayer, Position, SquadTier } from "@/lib/manager/types";

export function ManagerSquadView() {
  const { state, movePlayer, replenishSquadTiers, investInPlayerCareer, renewAllTierContracts, setTransferListed, setLoanListed } =
    useManager();
  const [activeTier, setActiveTier] = useState<SquadTier | "unavailable">("first");
  const [devPanel, setDevPanel] = useState<"roster" | "results">("roster");
  const [selectedPlayer, setSelectedPlayer] = useState<ManagerPlayer | null>(null);
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [showInvestments, setShowInvestments] = useState<boolean>(false);
  const [investMessage, setInvestMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [renewMsg, setRenewMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  // Include both permanent squad players and players currently loaned in to this club
  const allClubPlayers = Object.values(state.players).filter((p) => {
    if (p.clubId === userClubId) return true;
    if (p.loan && p.loan.destinationClubId === userClubId) return true;
    return false;
  });

  // Filter by active tier
  let tierPlayers = allClubPlayers.filter((p) => {
    const isLoanedIn = p.loan && p.loan.destinationClubId === userClubId;
    if (activeTier === "unavailable") {
      return p.injury !== null || p.suspension !== null;
    }
    if (activeTier === "first") {
      return p.squadTier === "first" || isLoanedIn;
    }
    // Loaned in players belong in the senior first team, not youth tiers of destination club
    if (isLoanedIn) return false;
    return p.squadTier === activeTier;
  });

  if (posFilter !== "ALL") {
    tierPlayers = tierPlayers.filter((p) => p.position === posFilter);
  }

  // Sort by rating descending
  tierPlayers.sort((a, b) => b.rating - a.rating);

  const firstCount = allClubPlayers.filter((p) => p.squadTier === "first" || (p.loan && p.loan.destinationClubId === userClubId)).length;
  const reservesCount = allClubPlayers.filter((p) => p.squadTier === "reserves" && (!p.loan || p.loan.destinationClubId !== userClubId)).length;
  const academyCount = allClubPlayers.filter((p) => p.squadTier === "academy" && (!p.loan || p.loan.destinationClubId !== userClubId)).length;
  const unavailableCount = allClubPlayers.filter((p) => p.injury || p.suspension).length;

  const handleRenewAllCurrentTier = () => {
    if (activeTier !== "academy" && activeTier !== "reserves") return;
    const label = activeTier === "academy" ? "Academy" : "Reserves";
    const count = activeTier === "academy" ? academyCount : reservesCount;
    if (count === 0) {
      setRenewMsg({ text: `No ${label} players to renew.`, isError: true });
      return;
    }
    if (
      !confirm(
        `Renew all ${count} ${label} player contract${count === 1 ? "" : "s"} for 2 years?\n\nWages stay the same unless a player requires a small bump to accept.`
      )
    ) {
      return;
    }
    const res = renewAllTierContracts([activeTier], 2);
    if (res.success) {
      const failNote =
        res.failedCount && res.failedCount > 0
          ? ` (${res.failedCount} could not be renewed — check salary cap.)`
          : "";
      setRenewMsg({
        text: `Renewed ${res.renewedCount} ${label} contract${res.renewedCount === 1 ? "" : "s"}.${failNote}`,
        isError: false,
      });
    } else {
      setRenewMsg({ text: res.error || `Failed to renew ${label} contracts.`, isError: true });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      {/* Header and Tier Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">Squad</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Organise First Team, Reserves, and Academy tiers. Move developing prospects up the ranks.
          </p>
        </div>

        {/* Tier Buttons */}
        <div className="flex items-center justify-center sm:justify-end gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setActiveTier("first");
              setDevPanel("roster");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "first"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            First Team ({firstCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTier("reserves");
              setDevPanel("roster");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "reserves"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Reserves ({reservesCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTier("academy");
              setDevPanel("roster");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "academy"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Academy ({academyCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTier("unavailable");
              setDevPanel("roster");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "unavailable"
                ? "bg-rose-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Out ({unavailableCount})
          </button>
        </div>
      </div>

      {(activeTier === "academy" || activeTier === "reserves") && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDevPanel("roster")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              devPanel === "roster"
                ? "bg-pitch-700 text-white border border-pitch-600"
                : "bg-pitch-900 text-pitch-400 border border-pitch-800"
            }`}
          >
            Squad
          </button>
          <button
            type="button"
            onClick={() => setDevPanel("results")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              devPanel === "results"
                ? "bg-pitch-700 text-white border border-pitch-600"
                : "bg-pitch-900 text-pitch-400 border border-pitch-800"
            }`}
          >
            Results
          </button>
        </div>
      )}

      {(activeTier === "academy" || activeTier === "reserves") && devPanel === "results" && (
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow overflow-hidden">
          <div className="border-b border-pitch-800 px-3 py-2.5 sm:px-4">
            <h3 className="text-sm font-bold text-white">
              {activeTier === "academy" ? "Academy" : "Reserves"} Results
            </h3>
            <p className="text-[11px] text-pitch-400">
              Grade fixtures are simulated each week when you Continue.
            </p>
          </div>
          <ul className="divide-y divide-pitch-800/60">
            {getDevelopmentResultsForTier(state, userClubId, activeTier).length ? (
              getDevelopmentResultsForTier(state, userClubId, activeTier).map((result) => {
                const won = result.ourScore > result.theirScore;
                const drew = result.ourScore === result.theirScore;
                return (
                  <li
                    key={result.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-pitch-500">
                        Wk {result.week} · S{result.season}
                      </p>
                      <p className="truncate text-sm font-semibold text-white">
                        {result.isHome ? "vs" : "@"} {result.opponentName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-base font-black ${
                          won ? "text-emerald-400" : drew ? "text-amber-300" : "text-rose-400"
                        }`}
                      >
                        {result.ourScore}–{result.theirScore}
                      </p>
                      <p className="text-[10px] font-bold text-pitch-500">
                        {won ? "W" : drew ? "D" : "L"}
                      </p>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-8 text-center text-xs text-pitch-500 italic sm:px-4">
                No grade results yet. Press Continue to simulate this week&apos;s Academy and Reserves
                fixtures.
              </li>
            )}
          </ul>
        </div>
      )}

      {(activeTier === "academy" || activeTier === "reserves") &&
        devPanel === "roster" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-pitch-800 bg-pitch-900/60 px-3 py-2.5">
          <p className="text-[11px] text-pitch-400">
            Bulk-extend every {activeTier === "academy" ? "Academy" : "Reserves"} contract by 2 years at
            current wages (or the minimum they will accept).
          </p>
          <button
            type="button"
            onClick={handleRenewAllCurrentTier}
            disabled={(activeTier === "academy" ? academyCount : reservesCount) === 0}
            className="shrink-0 rounded-lg bg-emerald-600/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Renew All {activeTier === "academy" ? "Academy" : "Reserves"} (
            {activeTier === "academy" ? academyCount : reservesCount})
          </button>
        </div>
      )}

      {renewMsg && devPanel === "roster" && (
        <div
          className={`rounded-xl p-3 text-xs border ${
            renewMsg.isError
              ? "bg-rose-950/60 text-rose-300 border-rose-800"
              : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
          }`}
        >
          {renewMsg.text}
        </div>
      )}

      {/* Hide roster lists while viewing grade Results */}
      {(activeTier === "first" ||
        activeTier === "unavailable" ||
        devPanel === "roster") && (
        <>
      {/* Mobile player cards */}
      <div className="sm:hidden space-y-2">
        {tierPlayers.length ? (
          tierPlayers.map((player) => {
            const isInjured = player.injury !== null;
            const isSuspended = player.suspension !== null;
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  setSelectedPlayer(player);
                  setShowInvestments(false);
                  setInvestMessage(null);
                }}
                className="manager-player-card manager-player-card--interactive w-full text-left rounded-xl border border-pitch-800 bg-pitch-900/80 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                      {formatPositionShort(player.position)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{player.name}</p>
                      <p className="text-[11px] text-pitch-400">
                        Age {player.age}
                        {isInjured ? ` · Inj ${player.injury?.weeksRemaining}w` : ""}
                        {isSuspended ? ` · Susp ${player.suspension?.weeksRemaining}w` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-black text-emerald-400">{player.rating}</p>
                    <p className="text-[10px] text-pitch-500">POT {player.potential}</p>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-pitch-700 px-3 py-6 text-center text-xs text-pitch-500">
            No players in this group.
          </p>
        )}
      </div>

      {/* Desktop players table */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow hidden sm:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
            <tr>
              <th className="py-3 px-3">Pos</th>
              <th className="py-3 px-3">Player</th>
              <th className="py-3 px-2 text-center">Age</th>
              <th className="py-3 px-2 text-center">OVR</th>
              <th className="py-3 px-2 text-center">Pot</th>
              <th className="py-3 px-2 text-center">Form</th>
              <th className="py-3 px-2 text-center">Morale</th>
              <th className="py-3 px-3 text-right">Wage</th>
              <th className="py-3 px-2 text-center">Expires</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
            {tierPlayers.length ? (
              tierPlayers.map((player) => {
                const isInjured = player.injury !== null;
                const isSuspended = player.suspension !== null;
                const isLoanedIn = player.loan !== null && player.loan.destinationClubId === userClubId;
                const isLoanedOut = player.clubId === userClubId && player.loan !== null && player.loan.destinationClubId !== userClubId;
                const parentClub = isLoanedIn && player.loan ? state.clubs[player.loan.parentClubId] : null;
                const destClub = isLoanedOut && player.loan ? state.clubs[player.loan.destinationClubId] : null;

                return (
                  <tr
                    key={player.id}
                    className="hover:bg-pitch-800/40 transition-colors"
                  >
                    {/* Position */}
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300 border border-pitch-700">
                        {formatPositionShort(player.position)}
                      </span>
                    </td>

                    {/* Name & Flags */}
                    <td className="py-2.5 px-3 font-medium text-white">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlayer(player);
                            setShowInvestments(false);
                            setInvestMessage(null);
                          }}
                          className="hover:text-emerald-400 transition-colors text-left"
                        >
                          {player.name}
                        </button>
                        {player.careerBuffs && player.careerBuffs.length > 0 && (
                          <span
                            className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40"
                            title={player.careerBuffs.map((b) => b.title).join(", ")}
                          >
                            ⚡ {player.careerBuffs.length} Buff{player.careerBuffs.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {isLoanedIn && (
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/40">
                            LOAN ({parentClub?.name || "On Loan"})
                          </span>
                        )}
                        {isLoanedOut && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/40">
                            AWAY ({destClub?.name || "Out on Loan"})
                          </span>
                        )}
                        {isInjured && (
                          <span className="rounded bg-rose-500/20 px-1 text-[10px] font-bold text-rose-400 border border-rose-500/40">
                            INJ ({player.injury?.weeksRemaining}w)
                          </span>
                        )}
                        {isSuspended && (
                          <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-400 border border-amber-500/40">
                            SUSP ({player.suspension?.weeksRemaining}w)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Age */}
                    <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>

                    {/* Rating (OVR) */}
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`font-black text-sm ${
                          player.rating >= 85
                            ? "text-amber-400"
                            : player.rating >= 78
                            ? "text-emerald-400"
                            : "text-white"
                        }`}
                      >
                        {player.rating}
                      </span>
                    </td>

                    {/* Potential */}
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-pitch-300 font-bold">{player.potential}</span>
                    </td>

                    {/* Form */}
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`font-semibold ${
                          player.form >= 8.0
                            ? "text-emerald-400"
                            : player.form < 6.5
                            ? "text-rose-400"
                            : "text-pitch-300"
                        }`}
                      >
                        {player.form.toFixed(1)}
                      </span>
                    </td>

                    {/* Morale */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="mx-auto h-1.5 w-10 rounded-full bg-pitch-950 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            player.morale >= 80
                              ? "bg-emerald-400"
                              : player.morale >= 60
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                          style={{ width: `${player.morale}%` }}
                        />
                      </div>
                    </td>

                    {/* Wage */}
                    <td className="py-2.5 px-3 text-right font-medium text-pitch-300">
                      {isLoanedIn && player.loan ? (
                        <div>
                          <span>£{Math.round(((player.contract?.wageWeekly || 0) * player.loan.wageContributionPct) / 100).toLocaleString()}/wk</span>
                          <span className="block text-[10px] text-pitch-400 font-normal">({player.loan.wageContributionPct}% share)</span>
                        </div>
                      ) : isLoanedOut && player.loan ? (
                        <div>
                          <span>£{Math.round(((player.contract?.wageWeekly || 0) * (100 - player.loan.wageContributionPct)) / 100).toLocaleString()}/wk</span>
                          <span className="block text-[10px] text-pitch-400 font-normal">({100 - player.loan.wageContributionPct}% share)</span>
                        </div>
                      ) : (
                        `£${player.contract?.wageWeekly.toLocaleString() || "0"}/wk`
                      )}
                    </td>

                    {/* Expiry */}
                    <td className="py-2.5 px-2 text-center text-pitch-400">
                      {isLoanedIn && player.loan ? (
                        <span className="text-sky-400 font-semibold">{player.loan.weeksRemaining}w loan</span>
                      ) : isLoanedOut && player.loan ? (
                        <span className="text-amber-400 font-semibold">{player.loan.weeksRemaining}w away</span>
                      ) : (
                        player.contract?.expiresSeason || "-"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      {isLoanedIn ? (
                        <span className="rounded bg-sky-950/60 px-2 py-1 text-[11px] font-semibold text-sky-400 border border-sky-500/30">
                          On Loan
                        </span>
                      ) : isLoanedOut ? (
                        <span className="rounded bg-amber-950/60 px-2 py-1 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                          Out on Loan
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {player.squadTier === "academy" && (
                            <button
                              type="button"
                              onClick={() => movePlayer(player.id, "reserves")}
                              className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-950/60 border border-emerald-500/30 transition-all"
                            >
                              To Reserves
                            </button>
                          )}

                          {player.squadTier === "reserves" && (
                            <>
                              <button
                                type="button"
                                onClick={() => movePlayer(player.id, "first")}
                                className="rounded bg-emerald-600/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                              >
                                To First Team
                              </button>
                              {player.age <= 21 && (
                                <button
                                  type="button"
                                  onClick={() => movePlayer(player.id, "academy")}
                                  className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-pitch-400 hover:text-white transition-all"
                                >
                                  To Academy
                                </button>
                              )}
                            </>
                          )}

                          {player.squadTier === "first" && (
                            <button
                              type="button"
                              onClick={() => movePlayer(player.id, "reserves")}
                              className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-950/60 border border-amber-500/30 transition-all"
                            >
                              To Reserves
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : activeTier === "reserves" ? (
              <tr>
                <td colSpan={10} className="py-10 text-center">
                  <p className="text-pitch-300 font-semibold mb-1">No players currently in Reserves.</p>
                  <p className="text-xs text-pitch-500 mb-3">
                    Bring in players to restore a full Reserves matchday 17.
                  </p>
                  <button
                    type="button"
                    onClick={() => replenishSquadTiers("reserves")}
                    className="rounded-xl bg-emerald-600/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all shadow"
                  >
                    + Fill Reserves to 17
                  </button>
                </td>
              </tr>
            ) : activeTier === "academy" ? (
              <tr>
                <td colSpan={10} className="py-10 text-center">
                  <p className="text-pitch-300 font-semibold mb-1">No players currently in Academy.</p>
                  <p className="text-xs text-pitch-500 mb-3">
                    Host youth trials to restore a full Academy matchday 17.
                  </p>
                  <button
                    type="button"
                    onClick={() => replenishSquadTiers("academy")}
                    className="rounded-xl bg-emerald-600/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all shadow"
                  >
                    + Fill Academy to 17
                  </button>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={10} className="py-8 text-center text-pitch-500 italic">
                  No players in this squad tier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (() => {
        const activePlayer = state.players[selectedPlayer.id] || selectedPlayer;
        const userClub = state.clubs[userClubId];
        const compId = userClub?.competitionId || "championship";
        const isOwned = activePlayer.clubId === userClubId;
        const balance = userClub?.finances.balance || 0;

        const investmentTypes: PlayerInvestmentType[] = [
          "elite_masterclass",
          "accelerated_rehab",
          "physical_transformation",
          "sports_psychology",
        ];

        const handleInvest = (type: PlayerInvestmentType) => {
          const res = investInPlayerCareer(activePlayer.id, type);
          if (res.success) {
            setInvestMessage({
              text: `Program successfully completed for ${activePlayer.name}!`,
              isError: false,
            });
          } else {
            setInvestMessage({
              text: res.error || "Failed to sponsor program.",
              isError: true,
            });
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start pb-3 border-b border-pitch-800">
                <div>
                  <span className="rounded bg-pitch-800 px-2 py-0.5 text-xs font-bold text-pitch-300">
                    {formatPositionLabel(activePlayer.position)}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{activePlayer.name}</h3>
                  <p className="text-xs text-pitch-400">
                    {activePlayer.age} yrs · {activePlayer.nationality} · Tier: {formatSquadTier(activePlayer.squadTier)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayer(null);
                    setShowInvestments(false);
                    setInvestMessage(null);
                  }}
                  className="text-pitch-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {/* Feedback alert */}
              {investMessage && (
                <div
                  className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${
                    investMessage.isError
                      ? "border border-rose-800 bg-rose-950 text-rose-200"
                      : "border border-emerald-800 bg-emerald-950 text-emerald-200"
                  }`}
                >
                  <span>{investMessage.text}</span>
                  <button
                    type="button"
                    onClick={() => setInvestMessage(null)}
                    className="text-xs opacity-75 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Core Stats Grid */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60 text-center">
                  <span className="block text-pitch-400 text-[10px] uppercase">OVR</span>
                  <span className="text-xl font-black text-emerald-400">{activePlayer.rating}</span>
                </div>
                <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60 text-center">
                  <span className="block text-pitch-400 text-[10px] uppercase">Potential</span>
                  <span className="text-xl font-black text-amber-400">{activePlayer.potential}</span>
                </div>
                <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60 text-center">
                  <span className="block text-pitch-400 text-[10px] uppercase">Form</span>
                  <span className="text-base font-bold text-sky-400">{activePlayer.form.toFixed(1)}</span>
                </div>
                <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60 text-center">
                  <span className="block text-pitch-400 text-[10px] uppercase">Morale</span>
                  <span className="text-base font-bold text-white">{activePlayer.morale}%</span>
                </div>
              </div>

              {/* Condition & Contract Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-pitch-950/60 p-2.5 border border-pitch-800/60 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-pitch-400">Match Fitness:</span>
                    <span className="font-semibold text-white">{activePlayer.fitness}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pitch-400">Fatigue Level:</span>
                    <span className="font-semibold text-white">{activePlayer.fatigue}%</span>
                  </div>
                  {activePlayer.injury && (
                    <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-pitch-800">
                      <span>Injured:</span>
                      <span>{activePlayer.injury.type} ({activePlayer.injury.weeksRemaining}w)</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-pitch-950/60 p-2.5 border border-pitch-800/60 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-pitch-400">Weekly Wage:</span>
                    <span className="font-semibold text-white">
                      £{activePlayer.contract?.wageWeekly.toLocaleString() || "0"}/wk
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pitch-400">Expires:</span>
                    <span className="font-semibold text-white">
                      {activePlayer.contract?.expiresSeason || "Free Agent"}
                    </span>
                  </div>
                  {activePlayer.suspension && (
                    <div className="flex justify-between text-amber-400 font-bold pt-1 border-t border-pitch-800">
                      <span>Suspended:</span>
                      <span>{activePlayer.suspension.weeksRemaining}w</span>
                    </div>
                  )}
                </div>
              </div>

              {isOwned && !activePlayer.loan && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTransferListed(activePlayer.id, !activePlayer.isTransferListed)
                    }
                    className={`rounded-xl px-3 py-2 text-[11px] font-bold border ${
                      activePlayer.isTransferListed
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                        : "border-pitch-700 bg-pitch-900 text-pitch-300"
                    }`}
                  >
                    {activePlayer.isTransferListed ? "Listed for Transfer ✓" : "List for Transfer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanListed(activePlayer.id, !activePlayer.isLoanListed)}
                    className={`rounded-xl px-3 py-2 text-[11px] font-bold border ${
                      activePlayer.isLoanListed
                        ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                        : "border-pitch-700 bg-pitch-900 text-pitch-300"
                    }`}
                  >
                    {activePlayer.isLoanListed ? "Listed for Loan ✓" : "List for Loan"}
                  </button>
                </div>
              )}

              {/* Loan Details */}
              {activePlayer.loan && (
                <div className="rounded-xl border border-sky-800/60 bg-sky-950/40 p-3 text-xs">
                  <span className="font-bold text-sky-400 block mb-1">
                    {activePlayer.loan.destinationClubId === userClubId
                      ? `On Loan from ${state.clubs[activePlayer.loan.parentClubId]?.name || "Parent Club"}`
                      : `On Loan to ${state.clubs[activePlayer.loan.destinationClubId]?.name || "Destination Club"}`}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-pitch-300">
                    <div>
                      <span className="text-pitch-400">Duration:</span> {activePlayer.loan.weeksRemaining} wks remaining
                    </div>
                    <div>
                      <span className="text-pitch-400">Wage Share:</span> {activePlayer.loan.wageContributionPct}% dest
                    </div>
                  </div>
                </div>
              )}

              {/* Active Career Buffs Badges */}
              {activePlayer.careerBuffs && activePlayer.careerBuffs.length > 0 && (
                <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    Permanent Career Buffs & Masteries
                  </span>
                  <div className="space-y-1.5">
                    {activePlayer.careerBuffs.map((buff) => (
                      <div key={buff.id} className="flex items-start gap-2 text-xs">
                        <span className="text-amber-400 font-bold">⚡</span>
                        <div>
                          <span className="font-bold text-white">{buff.title}:</span>{" "}
                          <span className="text-pitch-300 text-[11px]">{buff.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Career Investment Sponsor Drawer (Only for Owned Players) */}
              {isOwned && (
                <div className="rounded-xl border border-pitch-800 bg-pitch-950/70 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-xs block">Player Career Development Programs</span>
                      <span className="text-[11px] text-pitch-400">
                        Sponsor specialist coaching, accelerated rehab, or biomechanics.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInvestments(!showInvestments)}
                      className="rounded-lg bg-pitch-800 hover:bg-pitch-700 px-3 py-1 text-xs font-bold text-white transition-colors"
                    >
                      {showInvestments ? "Hide Programs" : "Sponsor Programs"}
                    </button>
                  </div>

                  {showInvestments && (
                    <div className="space-y-2.5 pt-2 border-t border-pitch-800">
                      {investmentTypes.map((type) => {
                        const def = PLAYER_INVESTMENT_DEFINITIONS[type];
                        const cost = getPlayerInvestmentCost(type, compId);
                        const canReceive = canPlayerReceiveInvestment(activePlayer, type);
                        const canAfford = balance >= cost;

                        return (
                          <div
                            key={type}
                            className="rounded-lg border border-pitch-800 bg-pitch-900/90 p-2.5 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-white">
                                  <span>{def.icon}</span>
                                  <span>{def.name}</span>
                                </div>
                                <p className="text-[11px] text-pitch-400 mt-0.5">{def.description}</p>
                              </div>
                              <span className="text-xs font-bold text-emerald-400 shrink-0">
                                £{cost.toLocaleString()}
                              </span>
                            </div>

                            <ul className="space-y-0.5">
                              {def.effects.map((effect, idx) => (
                                <li key={idx} className="text-[10px] text-pitch-300 flex items-center gap-1">
                                  <span className="text-emerald-400 font-bold">✓</span>
                                  <span>{effect}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="pt-1 flex items-center justify-between">
                              {!canReceive.eligible ? (
                                <span className="text-[11px] text-amber-400/90 italic font-medium">
                                  {canReceive.reason}
                                </span>
                              ) : !canAfford ? (
                                <span className="text-[11px] text-rose-400 font-medium">
                                  Insufficient Treasury (£{balance.toLocaleString()} available)
                                </span>
                              ) : (
                                <span className="text-[10px] text-pitch-400">Ready to sponsor</span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleInvest(type)}
                                disabled={!canReceive.eligible || !canAfford}
                                className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-[11px] text-white hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 transition-colors shadow"
                              >
                                Sponsor
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Season Stats Summary */}
              <div className="space-y-1.5 text-xs border-t border-pitch-800 pt-3">
                <div className="flex justify-between">
                  <span className="text-pitch-400">Season Appearances:</span>
                  <span className="font-semibold text-white">{activePlayer.stats.apps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pitch-400">Season Tries:</span>
                  <span className="font-semibold text-white">{activePlayer.stats.tries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pitch-400">Season Points:</span>
                  <span className="font-semibold text-white">{activePlayer.stats.points}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pitch-400">Career Tries:</span>
                  <span className="font-semibold text-white">{activePlayer.careerStats.tries}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedPlayer(null);
                  setShowInvestments(false);
                  setInvestMessage(null);
                }}
                className="w-full rounded-xl bg-pitch-800 py-2.5 text-center text-xs font-bold text-white hover:bg-pitch-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
