"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useManager } from "@/lib/manager/context";
import {
  formatPositionLabel,
  formatPositionPair,
  formatSquadTier,
  isPlayerEligibleForLoanIn,
  calculateSalaryCapUsage,
} from "@/lib/manager";
import type { ManagerPlayer, Position } from "@/lib/manager/types";

const POSITIONS: { id: "ALL" | Position; label: string }[] = [
  { id: "ALL", label: "All Positions" },
  { id: "FULLBACK", label: "Fullback (FB)" },
  { id: "WING", label: "Wing (WG)" },
  { id: "CENTRE", label: "Centre (CE)" },
  { id: "STAND_OFF", label: "Stand-Off (SO)" },
  { id: "SCRUM_HALF", label: "Scrum-Half (SH)" },
  { id: "PROP", label: "Prop (PR)" },
  { id: "HOOKER", label: "Hooker (HK)" },
  { id: "SECOND_ROW", label: "Second-Row (SR)" },
  { id: "LOOSE_FORWARD", label: "Loose Forward (LF)" },
];

const LOAN_PAGE_SIZE = 40;

export function ManagerLoansView() {
  const {
    state,
    loanPlayerOut,
    recallPlayerLoan,
    loanPlayerIn,
    terminateIncomingLoan,
  } = useManager();

  const [subTab, setSubTab] = useState<"market" | "incoming" | "outgoing" | "available">("market");

  // Loan Out state (Tab 4)
  const [targetPlayer, setTargetPlayer] = useState<ManagerPlayer | null>(null);
  const [destClubId, setDestClubId] = useState<string>("barrow-raiders");
  const [loanWeeks, setLoanWeeks] = useState<number>(8);
  const [wageShare, setWageShare] = useState<number>(50);
  const [canRecall, setCanRecall] = useState<boolean>(true);
  const [loanMsg, setLoanMsg] = useState<string | null>(null);

  // Loan In state (Tab 1)
  const [loanInTarget, setLoanInTarget] = useState<ManagerPlayer | null>(null);
  const [loanInWeeks, setLoanInWeeks] = useState<number>(8);
  const [loanInWageShare, setLoanInWageShare] = useState<number>(50);
  const [loanInCanRecall, setLoanInCanRecall] = useState<boolean>(true);
  const [loanInMsg, setLoanInMsg] = useState<string | null>(null);
  const [loanInError, setLoanInError] = useState<string | null>(null);

  // Market Filters
  const [marketSearch, setMarketSearch] = useState<string>("");
  const [marketPos, setMarketPos] = useState<"ALL" | Position>("ALL");
  const [marketClub, setMarketClub] = useState<string>("ALL");
  const [marketSort, setMarketSort] = useState<"rating" | "potential" | "age" | "wage">("rating");
  const [marketVisibleCount, setMarketVisibleCount] = useState(LOAN_PAGE_SIZE);
  const [availableVisibleCount, setAvailableVisibleCount] = useState(LOAN_PAGE_SIZE);

  // Notifications
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const userClub = state.clubs[userClubId];
  const isChampionshipClub = userClub?.competitionId === "championship";

  // Active loans
  const outgoingLoans = state.transfers.activeLoans.filter((l) => l.parentClubId === userClubId);
  const incomingLoans = state.transfers.activeLoans.filter((l) => l.destinationClubId === userClubId);

  // Available to loan out: Reserves & Academy players who are not currently loaned
  const availablePlayers = Object.values(state.players).filter(
    (p) =>
      p.clubId === userClubId &&
      (p.squadTier === "reserves" || p.squadTier === "academy") &&
      p.loan === null &&
      !p.injury &&
      !p.suspension
  );

  // Candidates available to LOAN IN
  const loanInCandidates = useMemo(() => {
    if (!userClub) return [];
    return Object.values(state.players).filter((p) => {
      if (!p.clubId || p.clubId === userClubId) return false;
      const parentClub = state.clubs[p.clubId];
      if (!parentClub) return false;
      const eligibility = isPlayerEligibleForLoanIn(p, parentClub, userClub);
      return eligibility.eligible;
    });
  }, [state.players, state.clubs, userClub, userClubId]);

  // Unique parent clubs with available loan targets
  const marketClubOptions = useMemo(() => {
    const clubIds = new Set(loanInCandidates.map((p) => p.clubId!).filter(Boolean));
    return Array.from(clubIds)
      .map((id) => state.clubs[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [loanInCandidates, state.clubs]);

  // Filtered & sorted loan targets
  const filteredLoanCandidates = useMemo(() => {
    let list = loanInCandidates;

    if (marketPos !== "ALL") {
      list = list.filter(
        (p) => p.position === marketPos || p.secondaryPosition === marketPos
      );
    }

    if (marketClub !== "ALL") {
      list = list.filter((p) => p.clubId === marketClub);
    }

    if (marketSearch.trim()) {
      const q = marketSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      if (marketSort === "rating") return b.rating - a.rating;
      if (marketSort === "potential") return b.potential - a.potential;
      if (marketSort === "age") return a.age - b.age;
      if (marketSort === "wage") return (a.contract?.wageWeekly || 0) - (b.contract?.wageWeekly || 0);
      return 0;
    });
  }, [loanInCandidates, marketPos, marketClub, marketSearch, marketSort]);

  // Eligible destination clubs for LOAN OUT
  const eligibleDestinationClubs = useMemo(() => {
    return Object.values(state.clubs)
      .filter((c) => {
        if (c.id === userClubId) return false;
        if (isChampionshipClub && c.competitionId === "super-league") return false;
        return true;
      })
      .sort((a, b) => {
        if (a.competitionId !== b.competitionId) {
          return a.competitionId === "super-league" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [state.clubs, userClubId, isChampionshipClub]);

  // Ensure default destClubId is valid for loan out
  useEffect(() => {
    if (eligibleDestinationClubs.length > 0 && !eligibleDestinationClubs.some((c) => c.id === destClubId)) {
      setDestClubId(eligibleDestinationClubs[0].id);
    }
  }, [eligibleDestinationClubs, destClubId]);

  useEffect(() => {
    setMarketVisibleCount(LOAN_PAGE_SIZE);
  }, [marketSearch, marketPos, marketClub, marketSort, subTab]);

  useEffect(() => {
    setAvailableVisibleCount(LOAN_PAGE_SIZE);
  }, [subTab]);

  // Execute Loan Out
  const handleExecuteLoanOut = () => {
    if (!targetPlayer) return;
    const res = loanPlayerOut(targetPlayer.id, destClubId, loanWeeks, wageShare, canRecall);
    if (res.success) {
      setLoanMsg(`Successfully arranged loan for ${targetPlayer.name}!`);
      setTimeout(() => {
        setTargetPlayer(null);
        setLoanMsg(null);
      }, 1200);
    } else {
      setLoanMsg(res.error || "Loan failed.");
    }
  };

  // Execute Loan In
  const handleExecuteLoanIn = () => {
    if (!loanInTarget) return;
    const res = loanPlayerIn(loanInTarget.id, loanInWeeks, loanInWageShare, loanInCanRecall);
    if (res.success) {
      setLoanInMsg(`Successfully signed ${loanInTarget.name} on loan!`);
      setLoanInError(null);
      setTimeout(() => {
        setLoanInTarget(null);
        setLoanInMsg(null);
      }, 1200);
    } else {
      setLoanInError(res.error || "Loan proposal rejected.");
    }
  };

  // Terminate incoming loan
  const handleTerminateIncomingLoan = (playerId: string, playerName: string, parentClubName: string) => {
    const res = terminateIncomingLoan(playerId);
    if (res.success) {
      setActionNotice(`${playerName} has been returned to ${parentClubName}.`);
      setTimeout(() => setActionNotice(null), 3000);
    } else {
      setActionNotice(res.error || "Failed to return player.");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Recall outgoing loan
  const handleRecallOutgoingLoan = (playerId: string, playerName: string) => {
    const res = recallPlayerLoan(playerId);
    if (res.success) {
      setActionNotice(`Recalled ${playerName} back from loan.`);
      setTimeout(() => setActionNotice(null), 3000);
    } else {
      setActionNotice(res.error || "Failed to recall player.");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Salary cap info for user club
  const capInfo = calculateSalaryCapUsage(state, userClubId);
  const targetWeeklyWage = loanInTarget?.contract?.wageWeekly || 0;
  const loanInWeeklyCost = Math.round((targetWeeklyWage * loanInWageShare) / 100);
  const remainingCapAfterLoan = capInfo.availableCapWeekly - loanInWeeklyCost;
  const isCapBreach = loanInWeeklyCost > 0 && capInfo.availableCapWeekly < loanInWeeklyCost;

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">Loans</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Browse loan market targets from other clubs, manage incoming loanees, or send out prospects for experience.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubTab("market")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              subTab === "market"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Loan Market ({loanInCandidates.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("incoming")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              subTab === "incoming"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Incoming ({incomingLoans.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("outgoing")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              subTab === "outgoing"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Outgoing ({outgoingLoans.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("available")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              subTab === "available"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Loan Out ({availablePlayers.length})
          </button>
        </div>
      </div>

      {/* Global Action Notification */}
      {actionNotice && (
        <div className="rounded-xl border border-pitch-700 bg-pitch-900/90 p-3 text-xs text-white shadow animate-in fade-in">
          {actionNotice}
        </div>
      )}

      {/* TAB 1: Loan Market (Loan In) */}
      {subTab === "market" && (
        <div className="space-y-4">
          {/* Market Filters Toolbar */}
          <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-3.5 shadow">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search */}
              <div>
                <label className="block text-[11px] font-semibold text-pitch-400 mb-1">Search Player</label>
                <input
                  type="text"
                  placeholder="Player name..."
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white placeholder-pitch-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Position Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-pitch-400 mb-1">Position</label>
                <select
                  value={marketPos}
                  onChange={(e) => setMarketPos(e.target.value as "ALL" | Position)}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parent Club Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-pitch-400 mb-1">Parent Club</label>
                <select
                  value={marketClub}
                  onChange={(e) => setMarketClub(e.target.value)}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Parent Clubs</option>
                  {marketClubOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.competitionId === "super-league" ? "Super League" : "Championship"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-[11px] font-semibold text-pitch-400 mb-1">Sort By</label>
                <select
                  value={marketSort}
                  onChange={(e) => setMarketSort(e.target.value as "rating" | "potential" | "age" | "wage")}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="rating">Overall Rating (OVR)</option>
                  <option value="potential">Potential Ceiling</option>
                  <option value="age">Youngest First</option>
                  <option value="wage">Lowest Wage</option>
                </select>
              </div>
            </div>

            {/* Context helper */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-pitch-400 border-t border-pitch-800/60 pt-2.5">
              <span>
                {filteredLoanCandidates.length} eligible player{filteredLoanCandidates.length === 1 ? "" : "s"} found across other clubs.
              </span>
              <span>
                Available Salary Cap: <strong className="text-emerald-400">£{capInfo.availableCapWeekly.toLocaleString()}/wk</strong>
              </span>
            </div>
          </div>

          {/* Market Table */}
          <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-3">Pos</th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-2 text-center">Age</th>
                  <th className="py-3 px-3">Parent Club</th>
                  <th className="py-3 px-2 text-center">OVR</th>
                  <th className="py-3 px-2 text-center">Pot</th>
                  <th className="py-3 px-3 text-right">Wage</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
                {filteredLoanCandidates.length ? (
                  filteredLoanCandidates.slice(0, marketVisibleCount).map((player) => {
                    const parentClub = player.clubId ? state.clubs[player.clubId] : null;
                    const isSL = parentClub?.competitionId === "super-league";

                    return (
                      <tr key={player.id} className="hover:bg-pitch-800/40 transition-colors">
                        {/* Position */}
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300 border border-pitch-700">
                            {formatPositionPair(player.position, player.secondaryPosition)}
                          </span>
                        </td>

                        {/* Player */}
                        <td className="py-2.5 px-3 font-medium text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{player.name}</span>
                            {player.isLoanListed && (
                              <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-400 border border-amber-500/40">
                                LISTED
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-pitch-400 block font-normal">
                            {player.nationality} · Tier: {formatSquadTier(player.squadTier)}
                          </span>
                        </td>

                        {/* Age */}
                        <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>

                        {/* Parent Club */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{parentClub?.name || "Unknown"}</span>
                            <span
                              className={`rounded px-1 text-[9px] font-bold ${
                                isSL
                                  ? "bg-purple-900/60 text-purple-300 border border-purple-700"
                                  : "bg-blue-900/60 text-blue-300 border border-blue-700"
                              }`}
                            >
                              {isSL ? "SL" : "CHAMP"}
                            </span>
                          </div>
                        </td>

                        {/* Rating (OVR) */}
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`font-black text-sm ${
                              player.rating >= 80
                                ? "text-amber-400"
                                : player.rating >= 72
                                ? "text-emerald-400"
                                : "text-white"
                            }`}
                          >
                            {player.rating}
                          </span>
                        </td>

                        {/* Potential */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="font-bold text-pitch-300">{player.potential}</span>
                        </td>

                        {/* Wage */}
                        <td className="py-2.5 px-3 text-right font-medium text-pitch-300">
                          £{player.contract?.wageWeekly.toLocaleString() || "0"}/wk
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setLoanInTarget(player);
                              setLoanInWeeks(8);
                              setLoanInWageShare(50);
                              setLoanInCanRecall(true);
                              setLoanInMsg(null);
                              setLoanInError(null);
                            }}
                            className="rounded bg-emerald-600/20 px-3 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                          >
                            Loan In
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-pitch-500 italic">
                      No loan targets found matching the current search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filteredLoanCandidates.length > marketVisibleCount && (
              <div className="border-t border-pitch-800 px-3 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setMarketVisibleCount((n) => n + LOAN_PAGE_SIZE)}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-600/25 px-5 py-2.5 text-xs font-black text-emerald-200 hover:bg-emerald-600/45 transition-colors"
                >
                  Show more (
                  {Math.min(LOAN_PAGE_SIZE, filteredLoanCandidates.length - marketVisibleCount)} of{" "}
                  {filteredLoanCandidates.length - marketVisibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Incoming Loans */}
      {subTab === "incoming" && (
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
          {incomingLoans.length ? (
            <div className="space-y-3">
              {incomingLoans.map((loan) => {
                const player = state.players[loan.playerId];
                const parentClub = state.clubs[loan.parentClubId];
                const weeklyCost = player
                  ? Math.round(((player.contract?.wageWeekly || 0) * loan.wageContributionPct) / 100)
                  : 0;

                return (
                  <div
                    key={loan.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-pitch-800 bg-pitch-950/60 gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300 border border-pitch-700">
                          {player
                            ? formatPositionPair(player.position, player.secondaryPosition)
                            : "PLAYER"}
                        </span>
                        <h4 className="font-bold text-sm text-white">{loan.playerName}</h4>
                        {player && (
                          <span className="text-xs font-bold text-emerald-400">
                            {player.rating} OVR
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-pitch-400 mt-1">
                        On loan from <strong className="text-white">{parentClub?.name || loan.parentClubId}</strong> ·{" "}
                        <span className="text-sky-400 font-semibold">{loan.weeksRemaining} wks remaining</span> · Wage cost: £{weeklyCost.toLocaleString()}/wk ({loan.wageContributionPct}% share)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleTerminateIncomingLoan(loan.playerId, loan.playerName, parentClub?.name || "parent club")
                        }
                        className="rounded-lg bg-rose-600/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-600/40 border border-rose-500/40 transition-colors"
                      >
                        Return to Parent Club
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-pitch-400">No players currently on loan at your club.</p>
              <p className="text-xs text-pitch-500 mt-1">
                Browse the <strong className="text-pitch-300">Loan Market</strong> to bring in immediate reinforcement for your squad!
              </p>
              <button
                type="button"
                onClick={() => setSubTab("market")}
                className="mt-3 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-colors"
              >
                Go to Loan Market
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Outgoing Loans */}
      {subTab === "outgoing" && (
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
          {outgoingLoans.length ? (
            <div className="space-y-3">
              {outgoingLoans.map((loan) => {
                const destClub = state.clubs[loan.destinationClubId];
                return (
                  <div
                    key={loan.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-pitch-800 bg-pitch-950/60 gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{loan.playerName}</h4>
                      <p className="text-xs text-pitch-400 mt-1">
                        At <strong className="text-white">{destClub?.name || loan.destinationClubId}</strong> ·{" "}
                        <span className="text-amber-400 font-semibold">{loan.weeksRemaining} wks remaining</span> · Destination wage split: {loan.wageContributionPct}%
                      </p>
                    </div>

                    {loan.canRecall ? (
                      <button
                        type="button"
                        onClick={() => handleRecallOutgoingLoan(loan.playerId, loan.playerName)}
                        className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-600/40 border border-amber-500/40 transition-colors"
                      >
                        Recall Loan Early
                      </button>
                    ) : (
                      <span className="text-[11px] text-pitch-500 italic">No recall clause</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-pitch-500 italic py-8 text-center">
              No players currently out on loan from your club.
            </p>
          )}
        </div>
      )}

      {/* TAB 4: Available to Loan Out */}
      {subTab === "available" && (
        <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-2 text-center">Age</th>
                <th className="py-3 px-2 text-center">Tier</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">Pot</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
              {availablePlayers.length ? (
                availablePlayers.slice(0, availableVisibleCount).map((player) => (
                  <tr key={player.id} className="hover:bg-pitch-800/40">
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300 border border-pitch-700">
                        {formatPositionPair(player.position, player.secondaryPosition)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white">{player.name}</td>
                    <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                    <td className="py-2.5 px-2 text-center text-pitch-400">{formatSquadTier(player.squadTier)}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-white">{player.rating}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-pitch-300">{player.potential}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetPlayer(player);
                          setLoanMsg(null);
                          if (
                            !eligibleDestinationClubs.some((c) => c.id === destClubId) &&
                            eligibleDestinationClubs.length > 0
                          ) {
                            setDestClubId(eligibleDestinationClubs[0].id);
                          }
                        }}
                        className="rounded bg-emerald-600/20 px-3 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                      >
                        Arrange Loan
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-pitch-500 italic">
                    No reserves or academy players currently available to loan out.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {availablePlayers.length > availableVisibleCount && (
            <div className="border-t border-pitch-800 px-3 py-3 text-center">
              <button
                type="button"
                onClick={() => setAvailableVisibleCount((n) => n + LOAN_PAGE_SIZE)}
                className="rounded-lg border border-emerald-500/50 bg-emerald-600/25 px-5 py-2.5 text-xs font-black text-emerald-200 hover:bg-emerald-600/45 transition-colors"
              >
                Show more (
                {Math.min(LOAN_PAGE_SIZE, availablePlayers.length - availableVisibleCount)} of{" "}
                {availablePlayers.length - availableVisibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Loan IN Proposal */}
      {loanInTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[min(90dvh,100%)] overflow-y-auto rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <span className="rounded bg-pitch-800 px-2 py-0.5 text-xs font-bold text-pitch-300">
                  {formatPositionLabel(loanInTarget.position)}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Loan In {loanInTarget.name}</h3>
                <p className="text-xs text-pitch-400">
                  {loanInTarget.age} yrs · {loanInTarget.rating} OVR · From {state.clubs[loanInTarget.clubId || ""]?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoanInTarget(null)}
                className="text-pitch-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loanInMsg && (
              <div className="mb-4 rounded-xl bg-pitch-950 p-3 text-xs text-emerald-300 border border-emerald-800">
                {loanInMsg}
              </div>
            )}

            {loanInError && (
              <div className="mb-4 rounded-xl bg-rose-950/80 p-3 text-xs text-rose-300 border border-rose-800">
                {loanInError}
              </div>
            )}

            <div className="space-y-3.5 mb-5 text-xs">
              {/* Duration and Wage Split */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Duration (Weeks)
                  </label>
                  <select
                    value={loanInWeeks}
                    onChange={(e) => setLoanInWeeks(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={4}>4 Weeks (Short Term)</option>
                    <option value={8}>8 Weeks (Standard)</option>
                    <option value={12}>12 Weeks (Quarter Season)</option>
                    <option value={16}>16 Weeks (Half Season)</option>
                    <option value={24}>24 Weeks (Full Season)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Your Wage Contribution
                  </label>
                  <select
                    value={loanInWageShare}
                    onChange={(e) => setLoanInWageShare(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={100}>100% (£{targetWeeklyWage.toLocaleString()}/wk)</option>
                    <option value={50}>50% Split (£{Math.round(targetWeeklyWage * 0.5).toLocaleString()}/wk)</option>
                    <option value={0}>0% (£0/wk - Parent Pays)</option>
                  </select>
                </div>
              </div>

              {/* Recall toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="canRecallLoanIn"
                  checked={loanInCanRecall}
                  onChange={(e) => setLoanInCanRecall(e.target.checked)}
                  className="rounded border-pitch-700 bg-pitch-950 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="canRecallLoanIn" className="text-pitch-300 cursor-pointer">
                  Allow parent club early recall clause
                </label>
              </div>

              {/* Salary Cap & Financial Breakdown */}
              <div className="rounded-xl bg-pitch-950/80 p-3 border border-pitch-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-pitch-400">Player Contract Wage:</span>
                  <span className="text-white font-medium">£{targetWeeklyWage.toLocaleString()}/wk</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pitch-400">Your Weekly Wage Cost:</span>
                  <span className="text-emerald-400 font-bold">£{loanInWeeklyCost.toLocaleString()}/wk</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pitch-400">Available Salary Cap Room:</span>
                  <span className="text-white font-medium">£{capInfo.availableCapWeekly.toLocaleString()}/wk</span>
                </div>
                <div className="flex justify-between border-t border-pitch-800 pt-1">
                  <span className="text-pitch-400">Cap Room After Signing:</span>
                  <span className={`font-bold ${isCapBreach ? "text-rose-400" : "text-pitch-200"}`}>
                    £{remainingCapAfterLoan.toLocaleString()}/wk
                  </span>
                </div>

                {isCapBreach && (
                  <p className="text-rose-400 text-[10px] font-semibold mt-1">
                    ⚠ Warning: Loaning this player will exceed your club&apos;s weekly salary cap headroom.
                  </p>
                )}

                {loanInWageShare < 50 && loanInTarget.age > 22 && !loanInTarget.isLoanListed && (
                  <p className="text-amber-400 text-[10px] font-semibold mt-1">
                    ℹ Notice: Senior players (&gt;22 yrs) generally require at least a 50% wage contribution unless loan listed.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteLoanIn}
              disabled={isCapBreach}
              className={`w-full rounded-xl py-3 text-center text-xs sm:text-sm font-bold shadow-md transition-all ${
                isCapBreach
                  ? "bg-pitch-800 text-pitch-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-98"
              }`}
            >
              Confirm Loan Agreement
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Loan OUT Proposal */}
      {targetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[min(90dvh,100%)] overflow-y-auto rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <h3 className="text-xl font-bold text-white">Loan Out {targetPlayer.name}</h3>
                <p className="text-xs text-pitch-400">
                  {formatPositionLabel(targetPlayer.position)} · {targetPlayer.age} yrs · {targetPlayer.rating} OVR
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetPlayer(null)}
                className="text-pitch-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loanMsg && (
              <div className="mb-4 rounded-xl bg-pitch-950 p-3 text-xs text-emerald-300 border border-emerald-800">
                {loanMsg}
              </div>
            )}

            <div className="space-y-3.5 mb-5 text-xs">
              <div>
                <label className="block font-semibold text-pitch-300 mb-1">
                  Destination Club
                </label>
                <select
                  value={destClubId}
                  onChange={(e) => setDestClubId(e.target.value)}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {eligibleDestinationClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.competitionId === "super-league" ? "Super League" : "Championship"})
                    </option>
                  ))}
                </select>
                {isChampionshipClub ? (
                  <span className="text-[10px] text-pitch-400 mt-1 block">
                    Championship clubs can only loan players to fellow Championship clubs.
                  </span>
                ) : (
                  <span className="text-[10px] text-pitch-400 mt-1 block">
                    Eligible destinations across Super League and Championship.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Duration (Weeks)
                  </label>
                  <select
                    value={loanWeeks}
                    onChange={(e) => setLoanWeeks(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={4}>4 Weeks</option>
                    <option value={8}>8 Weeks</option>
                    <option value={12}>12 Weeks</option>
                    <option value={16}>16 Weeks</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Destination Wage Share
                  </label>
                  <select
                    value={wageShare}
                    onChange={(e) => setWageShare(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={0}>0% (You pay 100%)</option>
                    <option value={50}>50% Split</option>
                    <option value={100}>100% (Destination pays all)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="canRecallLoanOut"
                  checked={canRecall}
                  onChange={(e) => setCanRecall(e.target.checked)}
                  className="rounded border-pitch-700 bg-pitch-950 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="canRecallLoanOut" className="text-pitch-300 cursor-pointer">
                  Allow early recall at any time
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteLoanOut}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
            >
              Confirm Loan Agreement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
