"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type {
  ClubLineup,
  ManagerState,
  SquadRole,
  SquadTier,
} from "./types";
import { initializeManagerDatabase } from "./database";
import { advanceWeek } from "./advancement";
import { rolloverSeason, type SeasonAwards } from "./rollover";
import { movePlayerTier, setClubLineup, autoPickClubLineup } from "./squad";
import { renewPlayerContract, releasePlayerContract, signFreeAgent } from "./contracts";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  evaluatePlayerTransferTerms,
  completeTransfer,
} from "./transfers";
import { createLoanAgreement, recallLoan } from "./loans";
import {
  loadManagerState,
  saveManagerState,
  exportSaveToJson,
  importSaveFromJson,
} from "./storage";

export type ManagerTab =
  | "dashboard"
  | "inbox"
  | "squad"
  | "tactics"
  | "transfers"
  | "loans"
  | "contracts"
  | "training"
  | "fixtures"
  | "league"
  | "club"
  | "settings";

interface ManagerContextValue {
  state: ManagerState | null;
  isLoading: boolean;
  isAdvancing: boolean;
  activeTab: ManagerTab;
  setActiveTab: (tab: ManagerTab) => void;
  lastPlayedMatchReview: any | null;
  setLastPlayedMatchReview: (fixture: any | null) => void;
  seasonAwardsModal: SeasonAwards | null;
  setSeasonAwardsModal: (awards: SeasonAwards | null) => void;
  // Core Actions
  startNewGame: (clubId: string, managerName: string) => void;
  advanceCurrentWeek: () => Promise<boolean>;
  rolloverCurrentSeason: () => boolean;
  movePlayer: (playerId: string, targetTier: SquadTier) => { success: boolean; error?: string };
  saveLineup: (lineup: ClubLineup) => { success: boolean; error?: string };
  autoPickSquad: () => { success: boolean; error?: string };
  renewContract: (
    playerId: string,
    wage: number,
    years: number,
    role: SquadRole
  ) => { success: boolean; error?: string };
  releasePlayer: (playerId: string) => { success: boolean; error?: string };
  signFreeAgentPlayer: (
    playerId: string,
    wage: number,
    years: number,
    role: SquadRole
  ) => { success: boolean; error?: string };
  bidOnPlayer: (
    playerId: string,
    offeredFee: number,
    offeredWage: number,
    offeredRole: SquadRole,
    years: number
  ) => { success: boolean; error?: string };
  decideOnIncomingBid: (
    bidId: string,
    decision: "accept" | "reject"
  ) => { success: boolean; error?: string };
  loanPlayerOut: (
    playerId: string,
    destClubId: string,
    weeks: number,
    wageContributionPct: number,
    canRecall: boolean
  ) => { success: boolean; error?: string };
  recallPlayerLoan: (playerId: string) => { success: boolean; error?: string };
  markMessageRead: (messageId: string) => void;
  saveToSlot: (slot: number | "auto") => { success: boolean; error?: string };
  loadFromSlot: (slot: number | "auto") => boolean;
  exportSave: () => string;
  importSave: (jsonStr: string) => boolean;
  resetCareer: () => void;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ManagerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [activeTab, setActiveTab] = useState<ManagerTab>("dashboard");
  const [lastPlayedMatchReview, setLastPlayedMatchReview] = useState<any | null>(null);
  const [seasonAwardsModal, setSeasonAwardsModal] = useState<SeasonAwards | null>(null);

  // Load existing active save slot on launch or prompt new game
  useEffect(() => {
    try {
      const activeSlotStr = window.localStorage.getItem("27-0-manager-active-slot-v3");
      const slot = activeSlotStr ? parseInt(activeSlotStr, 10) : 0;
      const loaded = loadManagerState(isNaN(slot) ? 0 : slot) || loadManagerState("auto");
      if (loaded) {
        setState(loaded);
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save on state change
  useEffect(() => {
    if (!state || isLoading) return;
    saveManagerState(state, "auto");
  }, [state, isLoading]);

  const startNewGame = useCallback((clubId: string, managerName: string) => {
    const newState = initializeManagerDatabase(clubId, managerName);
    setState(newState);
    saveManagerState(newState, 0);
    setActiveTab("dashboard");
  }, []);

  const advanceCurrentWeek = useCallback(async (): Promise<boolean> => {
    if (!state || isAdvancing) return false;
    setIsAdvancing(true);

    try {
      // Execute pure engine advancement
      const nextState = advanceWeek(state);

      // Check if user's club played a match this week to highlight in review modal
      const userClubId = state.manager.clubId;
      const userClub = state.clubs[userClubId];
      const compId = userClub?.competitionId || "super-league";
      const userMatch = nextState.competitions[compId]?.fixtures.find(
        (f) =>
          f.week === state.calendar.currentWeek &&
          f.isPlayed &&
          (f.homeClubId === userClubId || f.awayClubId === userClubId)
      ) || nextState.competitions["friendlies"]?.fixtures.find(
        (f) =>
          f.week === state.calendar.currentWeek &&
          f.isPlayed &&
          (f.homeClubId === userClubId || f.awayClubId === userClubId)
      ) || nextState.competitions["challenge-cup"]?.fixtures.find(
        (f) =>
          f.week === state.calendar.currentWeek &&
          f.isPlayed &&
          (f.homeClubId === userClubId || f.awayClubId === userClubId)
      );

      if (userMatch) {
        setLastPlayedMatchReview(userMatch);
      }

      setState(nextState);
      saveManagerState(nextState, 0);
      return true;
    } finally {
      setIsAdvancing(false);
    }
  }, [state, isAdvancing]);

  const rolloverCurrentSeason = useCallback((): boolean => {
    if (!state) return false;
    const { state: nextState, awards } = rolloverSeason(state);
    setState(nextState);
    setSeasonAwardsModal(awards);
    saveManagerState(nextState, 0);
    return true;
  }, [state]);

  const movePlayer = useCallback(
    (playerId: string, targetTier: SquadTier) => {
      if (!state) return { success: false, error: "No active game" };
      const res = movePlayerTier(state, playerId, targetTier);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const saveLineup = useCallback(
    (lineup: ClubLineup) => {
      if (!state) return { success: false, error: "No active game" };
      const res = setClubLineup(state, state.manager.clubId, lineup);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const autoPickSquad = useCallback(() => {
    if (!state) return { success: false, error: "No active game" };
    const res = autoPickClubLineup(state, state.manager.clubId);
    if (res.success) {
      setState(res.state);
    }
    return { success: res.success, error: res.error };
  }, [state]);

  const renewContract = useCallback(
    (playerId: string, wage: number, years: number, role: SquadRole) => {
      if (!state) return { success: false, error: "No active game" };
      const res = renewPlayerContract(state, playerId, wage, years, role);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const releasePlayer = useCallback(
    (playerId: string) => {
      if (!state) return { success: false, error: "No active game" };
      const res = releasePlayerContract(state, playerId);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const signFreeAgentPlayer = useCallback(
    (playerId: string, wage: number, years: number, role: SquadRole) => {
      if (!state) return { success: false, error: "No active game" };
      const res = signFreeAgent(state, state.manager.clubId, playerId, wage, years, role);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const bidOnPlayer = useCallback(
    (
      playerId: string,
      offeredFee: number,
      offeredWage: number,
      offeredRole: SquadRole,
      years: number
    ) => {
      if (!state) return { success: false, error: "No active game" };
      const res = submitTransferBid(
        state,
        state.manager.clubId,
        playerId,
        offeredFee,
        offeredWage,
        offeredRole,
        years
      );
      if (res.success) {
        // Automatically trigger selling club and player evaluations
        let updatedState = res.state;
        const bidId = res.bid!.id;

        const evalClub = evaluateSellingClubBid(updatedState, bidId);
        updatedState = evalClub.state;

        if (evalClub.bid?.status === "club_accepted") {
          const evalPlayer = evaluatePlayerTransferTerms(updatedState, bidId);
          updatedState = evalPlayer.state;

          if (evalPlayer.bid?.status === "player_accepted") {
            const compRes = completeTransfer(updatedState, bidId);
            if (compRes.success) {
              updatedState = compRes.state;
            }
          }
        }

        setState(updatedState);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const decideOnIncomingBid = useCallback(
    (bidId: string, decision: "accept" | "reject") => {
      if (!state) return { success: false, error: "No active game" };
      const evalRes = evaluateSellingClubBid(state, bidId, decision);
      if (!evalRes.success) return { success: false, error: evalRes.error };

      let updatedState = evalRes.state;
      if (decision === "accept") {
        const evalPlayer = evaluatePlayerTransferTerms(updatedState, bidId);
        updatedState = evalPlayer.state;
        if (evalPlayer.bid?.status === "player_accepted") {
          const compRes = completeTransfer(updatedState, bidId);
          if (compRes.success) {
            updatedState = compRes.state;
          }
        }
      }

      setState(updatedState);
      return { success: true };
    },
    [state]
  );

  const loanPlayerOut = useCallback(
    (
      playerId: string,
      destClubId: string,
      weeks: number,
      wageContributionPct: number,
      canRecall: boolean
    ) => {
      if (!state) return { success: false, error: "No active game" };
      const res = createLoanAgreement(
        state,
        state.manager.clubId,
        destClubId,
        playerId,
        weeks,
        wageContributionPct,
        canRecall
      );
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const recallPlayerLoan = useCallback(
    (playerId: string) => {
      if (!state) return { success: false, error: "No active game" };
      const res = recallLoan(state, playerId);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const markMessageRead = useCallback(
    (messageId: string) => {
      if (!state) return;
      const msgs = state.inbox.messages.map((m) =>
        m.id === messageId ? { ...m, isRead: true } : m
      );
      const unreadCount = msgs.filter((m) => !m.isRead).length;
      setState({
        ...state,
        inbox: { messages: msgs, unreadCount },
      });
    },
    [state]
  );

  const saveToSlot = useCallback(
    (slot: number | "auto") => {
      if (!state) return { success: false, error: "No game to save" };
      return saveManagerState(state, slot);
    },
    [state]
  );

  const loadFromSlot = useCallback((slot: number | "auto") => {
    const loaded = loadManagerState(slot);
    if (loaded) {
      setState(loaded);
      setActiveTab("dashboard");
      return true;
    }
    return false;
  }, []);

  const exportSave = useCallback(() => {
    if (!state) return "";
    return exportSaveToJson(state);
  }, [state]);

  const importSave = useCallback((jsonStr: string) => {
    const imported = importSaveFromJson(jsonStr);
    if (imported) {
      setState(imported);
      setActiveTab("dashboard");
      return true;
    }
    return false;
  }, []);

  const resetCareer = useCallback(() => {
    setState(null);
    setActiveTab("dashboard");
  }, []);

  return (
    <ManagerContext.Provider
      value={{
        state,
        isLoading,
        isAdvancing,
        activeTab,
        setActiveTab,
        lastPlayedMatchReview,
        setLastPlayedMatchReview,
        seasonAwardsModal,
        setSeasonAwardsModal,
        startNewGame,
        advanceCurrentWeek,
        rolloverCurrentSeason,
        movePlayer,
        saveLineup,
        autoPickSquad,
        renewContract,
        releasePlayer,
        signFreeAgentPlayer,
        bidOnPlayer,
        decideOnIncomingBid,
        loanPlayerOut,
        recallPlayerLoan,
        markMessageRead,
        saveToSlot,
        loadFromSlot,
        exportSave,
        importSave,
        resetCareer,
      }}
    >
      {children}
    </ManagerContext.Provider>
  );
}

export function useManager() {
  const context = useContext(ManagerContext);
  if (!context) {
    throw new Error("useManager must be used within a ManagerProvider");
  }
  return context;
}
