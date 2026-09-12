"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import {
  calculatePlayerValue,
  calculateMarketWage,
} from "@/lib/manager/rules";
import { calculateSalaryCapUsage } from "@/lib/manager/contracts";
import type { ManagerPlayer, Position, SquadRole, TransferBid } from "@/lib/manager/types";

export function ManagerTransfersView() {
  const { state, bidOnPlayer, signFreeAgentPlayer, decideOnIncomingBid } = useManager();
  const [subTab, setSubTab] = useState<"market" | "free_agents" | "bids" | "history">("market");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bid modal state
  const [targetPlayer, setTargetPlayer] = useState<ManagerPlayer | null>(null);
  const [offeredFee, setOfferedFee] = useState<number>(50000);
  const [offeredWage, setOfferedWage] = useState<number>(2000);
  const [offeredRole, setOfferedRole] = useState<SquadRole>("first_team");
  const [offeredYears, setOfferedYears] = useState<number>(2);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const userClub = state.clubs[userClubId];
  const cap = calculateSalaryCapUsage(state, userClubId);

  // Market players (players belonging to other clubs)
  let marketPlayers = Object.values(state.players).filter(
    (p) => p.clubId !== null && p.clubId !== userClubId && !p.isRetired
  );

  // Free agents
  let freeAgents = Object.values(state.players).filter(
    (p) => p.clubId === null && !p.isRetired
  );

  // Apply filters
  if (posFilter !== "ALL") {
    marketPlayers = marketPlayers.filter((p) => p.position === posFilter);
    freeAgents = freeAgents.filter((p) => p.position === posFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    marketPlayers = marketPlayers.filter((p) => p.name.toLowerCase().includes(q));
    freeAgents = freeAgents.filter((p) => p.name.toLowerCase().includes(q));
  }

  marketPlayers.sort((a, b) => b.rating - a.rating);
  freeAgents.sort((a, b) => b.rating - a.rating);

  const openBidModal = (player: ManagerPlayer) => {
    const fairVal = calculatePlayerValue(player.rating, player.potential, player.age);
    const fairW = calculateMarketWage(player.rating, player.age, userClub?.competitionId || "super-league");
    setTargetPlayer(player);
    setOfferedFee(fairVal);
    setOfferedWage(fairW);
    setOfferedRole("first_team");
    setOfferedYears(2);
    setBidError(null);
    setBidSuccess(null);
  };

  const handleExecuteBid = () => {
    if (!targetPlayer) return;
    setBidError(null);

    if (targetPlayer.clubId === null) {
      // Free agent signing
      const res = signFreeAgentPlayer(targetPlayer.id, offeredWage, offeredYears, offeredRole);
      if (res.success) {
        setBidSuccess(`Successfully signed ${targetPlayer.name}!`);
        setTimeout(() => setTargetPlayer(null), 1200);
      } else {
        setBidError(res.error || "Signing failed.");
      }
    } else {
      // Transfer bid
      const res = bidOnPlayer(targetPlayer.id, offeredFee, offeredWage, offeredRole, offeredYears);
      if (res.success) {
        setBidSuccess(`Transfer bid submitted for ${targetPlayer.name}!`);
        setTimeout(() => setTargetPlayer(null), 1200);
      } else {
        setBidError(res.error || "Bid failed.");
      }
    }
  };

  // Incoming bids to user club
  const incomingBids = state.transfers.activeBids.filter(
    (b) => b.toClubId === userClubId && b.status === "pending_club"
  );
  // Outgoing bids by user club
  const outgoingBids = state.transfers.activeBids.filter(
    (b) => b.fromClubId === userClubId
  );

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Transfer Market</h2>
          <p className="text-xs text-pitch-400">
            Scout targets, sign unattached Free Agents, negotiate bids, and review incoming offers.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubTab("market")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "market"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Market ({marketPlayers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("free_agents")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "free_agents"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Free Agents ({freeAgents.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("bids")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "bids"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Bids ({incomingBids.length + outgoingBids.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("history")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "history"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            History ({state.transfers.completedTransfers.length})
          </button>
        </div>
      </div>

      {/* Filter Bar (for market & free agents) */}
      {(subTab === "market" || subTab === "free_agents") && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-pitch-900/60 p-2.5 border border-pitch-800">
          <input
            type="text"
            placeholder="Search player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-pitch-700 bg-pitch-950 px-3 py-1.5 text-xs text-white placeholder-pitch-500 focus:outline-none focus:border-emerald-500"
          />

          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
            className="rounded-lg border border-pitch-700 bg-pitch-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Positions</option>
            <option value="FULLBACK">Fullback</option>
            <option value="WING">Wing</option>
            <option value="CENTRE">Centre</option>
            <option value="STAND_OFF">Stand-Off</option>
            <option value="SCRUM_HALF">Scrum-Half</option>
            <option value="PROP">Prop</option>
            <option value="HOOKER">Hooker</option>
            <option value="SECOND_ROW">Second-Row</option>
            <option value="LOOSE_FORWARD">Loose Forward</option>
          </select>
        </div>
      )}

      {/* Tab 1: Transfer Market List */}
      {subTab === "market" && (
        <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-3">Current Club</th>
                <th className="py-3 px-2 text-center">Age</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">Pot</th>
                <th className="py-3 px-3 text-right">Estimated Value</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
              {marketPlayers.slice(0, 50).map((player) => {
                const club = player.clubId ? state.clubs[player.clubId] : null;
                const estValue = calculatePlayerValue(player.rating, player.potential, player.age);

                return (
                  <tr key={player.id} className="hover:bg-pitch-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300">
                        {player.position.slice(0, 2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white">{player.name}</td>
                    <td className="py-2.5 px-3 text-pitch-400">{club?.name || "Unknown"}</td>
                    <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-bold text-emerald-400 text-sm">{player.rating}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-pitch-300 font-bold">{player.potential}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-amber-300">
                      £{estValue.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openBidModal(player)}
                        className="rounded bg-emerald-600/20 px-3 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                      >
                        Make Bid
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Free Agents */}
      {subTab === "free_agents" && (
        <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-2 text-center">Age</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">Pot</th>
                <th className="py-3 px-3 text-right">Wage Demand</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
              {freeAgents.length ? (
                freeAgents.map((player) => {
                  const estWage = calculateMarketWage(player.rating, player.age, userClub?.competitionId || "super-league");
                  return (
                    <tr key={player.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300">
                          {player.position.slice(0, 2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white">{player.name}</td>
                      <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-bold text-emerald-400 text-sm">{player.rating}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-pitch-300 font-bold">{player.potential}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-pitch-300">
                        ~£{estWage.toLocaleString()}/wk
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openBidModal(player)}
                          className="rounded bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 shadow transition-all"
                        >
                          Sign Free Agent
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-pitch-500 italic">
                    No free agents currently available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Active Bids */}
      {subTab === "bids" && (
        <div className="space-y-4">
          {/* Incoming Bids */}
          <div>
            <h3 className="font-bold text-sm text-white mb-2">Incoming Transfer Offers (Your Players)</h3>
            {incomingBids.length ? (
              <div className="space-y-2">
                {incomingBids.map((bid) => {
                  const player = state.players[bid.playerId];
                  const buyer = state.clubs[bid.fromClubId];

                  return (
                    <div
                      key={bid.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-pitch-700 bg-pitch-900/90 gap-3"
                    >
                      <div>
                        <span className="text-xs font-bold text-emerald-400">{buyer?.name}</span>
                        <h4 className="text-sm font-black text-white">
                          £{bid.offeredFee.toLocaleString()} offer for {player?.name}
                        </h4>
                        <p className="text-xs text-pitch-400">
                          Role: {bid.offeredRole} · Wage: £{bid.offeredWage.toLocaleString()}/wk
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decideOnIncomingBid(bid.id, "accept")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow"
                        >
                          Accept £{bid.offeredFee.toLocaleString()}
                        </button>
                        <button
                          type="button"
                          onClick={() => decideOnIncomingBid(bid.id, "reject")}
                          className="rounded-lg bg-rose-600/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-600/40 border border-rose-500/40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-pitch-500 italic">No incoming transfer offers at present.</p>
            )}
          </div>

          {/* Outgoing Bids */}
          <div>
            <h3 className="font-bold text-sm text-white mb-2">Outgoing Bids (Submitted by You)</h3>
            {outgoingBids.length ? (
              <div className="space-y-2">
                {outgoingBids.map((bid) => {
                  const player = state.players[bid.playerId];
                  const seller = state.clubs[bid.toClubId];

                  return (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-pitch-800 bg-pitch-950/60"
                    >
                      <div>
                        <span className="text-xs font-bold text-white">{player?.name}</span>
                        <span className="text-xs text-pitch-400 block">
                          To {seller?.name} · £{bid.offeredFee.toLocaleString()}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                          bid.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : bid.status === "pending_club"
                            ? "bg-sky-500/20 text-sky-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {bid.status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-pitch-500 italic">No outgoing bids submitted.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Completed Deals History */}
      {subTab === "history" && (
        <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Week</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-3">From</th>
                <th className="py-3 px-3">To</th>
                <th className="py-3 px-3 text-right">Fee</th>
                <th className="py-3 px-3 text-right">Wage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
              {state.transfers.completedTransfers.length ? (
                state.transfers.completedTransfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-pitch-800/40">
                    <td className="py-2.5 px-3 text-pitch-400">Wk {tx.week}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{tx.playerName}</td>
                    <td className="py-2.5 px-3 text-pitch-400">
                      {tx.fromClubId ? state.clubs[tx.fromClubId]?.name || tx.fromClubId : "Free Agent"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">
                      {state.clubs[tx.toClubId]?.name || tx.toClubId}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-amber-300">
                      {tx.fee > 0 ? `£${tx.fee.toLocaleString()}` : "Free"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-pitch-300">
                      £{tx.wageWeekly.toLocaleString()}/wk
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-pitch-500 italic">
                    No completed transfers yet this season.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bid / Contract Negotiation Modal */}
      {targetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <span className="rounded bg-pitch-800 px-2 py-0.5 text-xs font-bold text-pitch-300">
                  {targetPlayer.position}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {targetPlayer.clubId ? `Bid for ${targetPlayer.name}` : `Sign ${targetPlayer.name}`}
                </h3>
                <p className="text-xs text-pitch-400">
                  Rating: {targetPlayer.rating} OVR · Potential: {targetPlayer.potential} · Age: {targetPlayer.age}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetPlayer(null)}
                className="text-pitch-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {bidError && (
              <div className="mb-4 rounded-xl bg-rose-950/60 p-3 text-xs text-rose-300 border border-rose-800">
                {bidError}
              </div>
            )}
            {bidSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-950/60 p-3 text-xs text-emerald-300 border border-emerald-800">
                {bidSuccess}
              </div>
            )}

            <div className="space-y-3.5 mb-5 text-xs">
              {targetPlayer.clubId && (
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Transfer Fee Offered (£)
                  </label>
                  <input
                    type="number"
                    step={5000}
                    value={offeredFee}
                    onChange={(e) => setOfferedFee(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-[11px] text-pitch-500 mt-0.5 block">
                    Available cash balance: £{userClub?.finances.balance.toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-pitch-300 mb-1">
                  Weekly Wage Offered (£/wk)
                </label>
                <input
                  type="number"
                  step={100}
                  value={offeredWage}
                  onChange={(e) => setOfferedWage(Math.max(200, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
                <span className="text-[11px] text-pitch-500 mt-0.5 block">
                  Weekly Salary Cap headroom: £{Math.max(0, cap.availableCapWeekly).toLocaleString()}/wk
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Squad Role
                  </label>
                  <select
                    value={offeredRole}
                    onChange={(e) => setOfferedRole(e.target.value as SquadRole)}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="star">Star Player</option>
                    <option value="first_team">First Team</option>
                    <option value="rotation">Rotation</option>
                    <option value="backup">Backup</option>
                    <option value="youth">Youth</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Contract Length
                  </label>
                  <select
                    value={offeredYears}
                    onChange={(e) => setOfferedYears(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={1}>1 Year</option>
                    <option value={2}>2 Years</option>
                    <option value={3}>3 Years</option>
                    <option value={4}>4 Years</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteBid}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
            >
              {targetPlayer.clubId ? "Submit Transfer Bid" : "Confirm Contract & Sign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
