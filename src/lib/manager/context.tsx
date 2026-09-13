"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type {
  ClubLineup,
  ClubTactics,
  ManagerFixture,
  ManagerPlayer,
  ManagerSettings,
  ManagerState,
  SquadRole,
  SquadTier,
  FacilityType,
  PlayerInvestmentType,
  TrainingFocus,
  TrainingIntensity,
} from "./types";
import {
  initializeManagerDatabase,
  ensureClubSquadDepth,
} from "./database";
import { advanceWeek, canAdvanceWeek } from "./advancement";
import { rolloverSeason, type SeasonAwards } from "./rollover";
import { movePlayerTier, setClubLineup, autoPickClubLineup, getMatchdayLineupReadiness } from "./squad";
import type { MatchdayLineupReadiness } from "./squad";
import {
  renewPlayerContract,
  releasePlayerContract,
  signFreeAgent,
  renewAllSquadTierContracts,
  getUnacknowledgedContractExpiryWarnings,
  acknowledgeContractExpiryWarnings,
} from "./contracts";
import {
  hasCompletedManagerTutorial,
  markManagerTutorialCompleted,
} from "./onboarding";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  evaluatePlayerTransferTerms,
  completeTransfer,
  setPlayerTransferListed,
} from "./transfers";
import {
  createLoanAgreement,
  recallLoan,
  loanPlayerIn,
  terminateIncomingLoan,
  setPlayerLoanListed,
} from "./loans";
import { setPlayerTrainingFocus } from "./player";
import {
  upgradeClubFacility,
  upgradeCoachingStaff,
  expandStadium,
  investInPlayer,
} from "./facilities";
import {
  loadManagerState,
  saveManagerState,
  persistManagerProgress,
  deleteSaveSlot,
  exportSaveToJson,
  importSaveFromJson,
  getActiveSlotIndex,
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
  | "history"
  | "settings";

interface ManagerContextValue {
  state: ManagerState | null;
  isLoading: boolean;
  isAdvancing: boolean;
  activeTab: ManagerTab;
  setActiveTab: (tab: ManagerTab) => void;
  lastPlayedMatchReview: any | null;
  setLastPlayedMatchReview: (fixture: any | null) => void;
  activeKeyMomentsFixture: ManagerFixture | null;
  openKeyMoments: (fixture: ManagerFixture) => void;
  closeKeyMoments: () => void;
  seasonAwardsModal: SeasonAwards | null;
  setSeasonAwardsModal: (awards: SeasonAwards | null) => void;
  contractExpiryModalPlayers: ManagerPlayer[] | null;
  dismissContractExpiryModal: () => void;
  tutorialOpen: boolean;
  openTutorial: () => void;
  dismissTutorial: () => void;
  // Core Actions
  startNewGame: (clubId: string, managerName: string, targetSlot?: number) => void;
  advanceCurrentWeek: () => Promise<boolean>;
  lastAdvanceError: string | null;
  clearAdvanceError: () => void;
  getUserMatchdayReadiness: () => MatchdayLineupReadiness | null;
  rolloverCurrentSeason: () => boolean;
  movePlayer: (playerId: string, targetTier: SquadTier) => { success: boolean; error?: string };
  saveLineup: (lineup: ClubLineup) => { success: boolean; error?: string };
  autoPickSquad: () => { success: boolean; error?: string };
  updateClubTactics: (
    patch: Partial<ClubTactics>
  ) => { success: boolean; error?: string };
  setTrainingFocus: (
    playerId: string,
    focus: TrainingFocus
  ) => { success: boolean; error?: string };
  setTrainingIntensity: (
    intensity: TrainingIntensity
  ) => { success: boolean; error?: string };
  setTransferListed: (
    playerId: string,
    isListed: boolean
  ) => { success: boolean; error?: string };
  setLoanListed: (
    playerId: string,
    isListed: boolean
  ) => { success: boolean; error?: string };
  updateSettings: (
    patch: Partial<ManagerSettings>
  ) => { success: boolean; error?: string };
  renewContract: (
    playerId: string,
    wage: number,
    years: number,
    role: SquadRole
  ) => { success: boolean; error?: string };
  renewAllTierContracts: (
    tiers: Array<"academy" | "reserves">,
    years?: number
  ) => { success: boolean; error?: string; renewedCount?: number; failedCount?: number };
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
  loanPlayerIn: (
    playerId: string,
    weeks: number,
    wageContributionPct?: number,
    canRecall?: boolean
  ) => { success: boolean; error?: string };
  recallPlayerLoan: (playerId: string) => { success: boolean; error?: string };
  terminateIncomingLoan: (playerId: string) => { success: boolean; error?: string };
  upgradeFacility: (facilityType: FacilityType) => { success: boolean; error?: string };
  upgradeCoaching: () => { success: boolean; error?: string };
  expandStadiumCapacity: (seats: number) => { success: boolean; error?: string };
  investInPlayerCareer: (
    playerId: string,
    programType: PlayerInvestmentType
  ) => { success: boolean; error?: string };
  markMessageRead: (messageId: string) => void;
  markAllMessagesRead: () => void;
  saveToSlot: (slot: number | "auto") => { success: boolean; error?: string };
  loadFromSlot: (slot: number | "auto") => boolean;
  deleteSave: (slot: number | "auto") => boolean;
  exportSave: () => string;
  importSave: (jsonStr: string, targetSlot?: number) => boolean;
  resetCareer: () => void;
  exitToMenu: () => void;
  replenishSquadTiers: (tier: "reserves" | "academy") => void;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ManagerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [activeTab, setActiveTab] = useState<ManagerTab>("dashboard");
  const [lastPlayedMatchReview, setLastPlayedMatchReview] = useState<any | null>(null);
  const [activeKeyMomentsFixture, setActiveKeyMomentsFixture] = useState<ManagerFixture | null>(null);
  const [seasonAwardsModal, setSeasonAwardsModal] = useState<SeasonAwards | null>(null);
  const [contractExpiryModalPlayers, setContractExpiryModalPlayers] = useState<ManagerPlayer[] | null>(
    null
  );
  const [lastAdvanceError, setLastAdvanceError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const clearAdvanceError = useCallback(() => setLastAdvanceError(null), []);

  const openTutorial = useCallback(() => setTutorialOpen(true), []);

  const dismissTutorial = useCallback(() => {
    markManagerTutorialCompleted();
    setTutorialOpen(false);
  }, []);

  const getUserMatchdayReadiness = useCallback((): MatchdayLineupReadiness | null => {
    if (!state) return null;
    return getMatchdayLineupReadiness(state, state.manager.clubId);
  }, [state]);

  const openKeyMoments = useCallback((fixture: ManagerFixture) => {
    setActiveKeyMomentsFixture(fixture);
  }, []);

  const closeKeyMoments = useCallback(() => {
    setActiveKeyMomentsFixture(null);
  }, []);

  const dismissContractExpiryModal = useCallback(() => {
    if (contractExpiryModalPlayers && contractExpiryModalPlayers.length > 0 && state) {
      const next = acknowledgeContractExpiryWarnings(
        state,
        contractExpiryModalPlayers.map((p) => p.id)
      );
      setState(next);
      persistManagerProgress(next);
    }
    setContractExpiryModalPlayers(null);
  }, [state, contractExpiryModalPlayers]);

  // First-run Manager tutorial (blocks contract-expiry until dismissed)
  useEffect(() => {
    if (!state || isLoading) return;
    if (tutorialOpen) return;
    if (seasonAwardsModal || activeKeyMomentsFixture || lastPlayedMatchReview) return;
    if (hasCompletedManagerTutorial()) return;
    setTutorialOpen(true);
  }, [
    state,
    isLoading,
    tutorialOpen,
    seasonAwardsModal,
    activeKeyMomentsFixture,
    lastPlayedMatchReview,
  ]);

  // Surface contract expiry popups once higher-priority modals are clear
  useEffect(() => {
    if (!state) return;
    if (tutorialOpen) return;
    if (seasonAwardsModal || activeKeyMomentsFixture || lastPlayedMatchReview) return;
    if (contractExpiryModalPlayers && contractExpiryModalPlayers.length > 0) return;

    const warnings = getUnacknowledgedContractExpiryWarnings(state, state.manager.clubId);
    if (warnings.length > 0) {
      setContractExpiryModalPlayers(warnings);
    }
  }, [
    state,
    tutorialOpen,
    seasonAwardsModal,
    activeKeyMomentsFixture,
    lastPlayedMatchReview,
    contractExpiryModalPlayers,
  ]);

  // Restore in-tab session from autosave (numbered slots are manual checkpoints)
  useEffect(() => {
    try {
      const inSession =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem("27-0-manager-in-session") === "true";
      if (inSession) {
        const activeSlot = getActiveSlotIndex();
        const loaded =
          loadManagerState("auto") ||
          (activeSlot != null ? loadManagerState(activeSlot) : null) ||
          loadManagerState(0);
        if (loaded) {
          setState(ensureClubSquadDepth(loaded));
        }
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Autosave career progress on every state change (never overwrites numbered slots)
  useEffect(() => {
    if (!state || isLoading) return;
    if (state.settings?.autoSaveEnabled === false) return;
    persistManagerProgress(state);
  }, [state, isLoading]);

  const clearCareerOverlays = useCallback(() => {
    setLastPlayedMatchReview(null);
    setActiveKeyMomentsFixture(null);
    setSeasonAwardsModal(null);
    setContractExpiryModalPlayers(null);
    setLastAdvanceError(null);
  }, []);

  const startNewGame = useCallback((clubId: string, managerName: string, targetSlot: number = 0) => {
    const newState = initializeManagerDatabase(clubId, managerName);
    clearCareerOverlays();
    setState(newState);
    saveManagerState(newState, targetSlot);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("27-0-manager-in-session", "true");
      window.localStorage.setItem("27-0-manager-active-slot-v3", String(targetSlot));
    }
    setActiveTab("dashboard");
  }, [clearCareerOverlays]);

  const advanceCurrentWeek = useCallback(async (): Promise<boolean> => {
    if (!state || isAdvancing) return false;

    const gate = canAdvanceWeek(state);
    if (!gate.allowed) {
      setLastAdvanceError(gate.error || "Cannot advance this week.");
      return false;
    }
    setLastAdvanceError(null);
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
        if (state.settings?.matchSimulationSpeed === "instant") {
          setLastPlayedMatchReview(userMatch);
        } else {
          setActiveKeyMomentsFixture(userMatch);
        }
      }

      setState(nextState);
      persistManagerProgress(nextState);
      return true;
    } finally {
      setIsAdvancing(false);
    }
  }, [state, isAdvancing]);

  const rolloverCurrentSeason = useCallback((): boolean => {
    if (!state) return false;
    if (state.calendar.phase !== "season_end") {
      console.warn("rolloverCurrentSeason blocked: current phase is not season_end", state.calendar.phase);
      return false;
    }
    const { state: nextState, awards } = rolloverSeason(state);
    setState(nextState);
    setSeasonAwardsModal(awards);
    persistManagerProgress(nextState);
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
        const ready = getMatchdayLineupReadiness(res.state, state.manager.clubId).ready;
        if (ready) setLastAdvanceError(null);
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
      const ready = getMatchdayLineupReadiness(res.state, state.manager.clubId).ready;
      if (ready) setLastAdvanceError(null);
    }
    return { success: res.success, error: res.error };
  }, [state]);

  const updateClubTactics = useCallback(
    (patch: Partial<ClubTactics>) => {
      if (!state) return { success: false, error: "No active game" };
      const clubId = state.manager.clubId;
      const club = state.clubs[clubId];
      if (!club) return { success: false, error: "Club not found" };
      setState({
        ...state,
        clubs: {
          ...state.clubs,
          [clubId]: {
            ...club,
            tactics: { ...club.tactics, ...patch },
          },
        },
      });
      return { success: true };
    },
    [state]
  );

  const setTrainingFocus = useCallback(
    (playerId: string, focus: TrainingFocus) => {
      if (!state) return { success: false, error: "No active game" };
      const player = state.players[playerId];
      if (!player || player.clubId !== state.manager.clubId) {
        return { success: false, error: "Player not found at your club" };
      }
      setState({
        ...state,
        players: {
          ...state.players,
          [playerId]: setPlayerTrainingFocus(player, focus),
        },
      });
      return { success: true };
    },
    [state]
  );

  const setTrainingIntensity = useCallback(
    (intensity: TrainingIntensity) => {
      return updateClubTactics({ trainingIntensity: intensity });
    },
    [updateClubTactics]
  );

  const setTransferListed = useCallback(
    (playerId: string, isListed: boolean) => {
      if (!state) return { success: false, error: "No active game" };
      const player = state.players[playerId];
      if (!player || player.clubId !== state.manager.clubId) {
        return { success: false, error: "Can only list your own players" };
      }
      const res = setPlayerTransferListed(state, playerId, isListed);
      if (res.success) setState(res.state);
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const setLoanListed = useCallback(
    (playerId: string, isListed: boolean) => {
      if (!state) return { success: false, error: "No active game" };
      const player = state.players[playerId];
      if (!player || player.clubId !== state.manager.clubId) {
        return { success: false, error: "Can only list your own players" };
      }
      const res = setPlayerLoanListed(state, playerId, isListed);
      if (res.success) setState(res.state);
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const updateSettings = useCallback(
    (patch: Partial<ManagerSettings>) => {
      if (!state) return { success: false, error: "No active game" };
      setState({
        ...state,
        settings: { ...state.settings, ...patch },
      });
      return { success: true };
    },
    [state]
  );

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

  const renewAllTierContracts = useCallback(
    (tiers: Array<"academy" | "reserves">, years = 2) => {
      if (!state) return { success: false, error: "No active game" };
      const res = renewAllSquadTierContracts(state, state.manager.clubId, tiers, years);
      if (res.success) {
        setState(res.state);
      }
      return {
        success: res.success,
        error: res.error,
        renewedCount: res.renewedCount,
        failedCount: res.failedCount,
      };
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

  const loanPlayerInAction = useCallback(
    (
      playerId: string,
      weeks: number,
      wageContributionPct = 50,
      canRecall = true
    ) => {
      if (!state) return { success: false, error: "No active game" };
      const res = loanPlayerIn(
        state,
        state.manager.clubId,
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

  const terminateIncomingLoanAction = useCallback(
    (playerId: string) => {
      if (!state) return { success: false, error: "No active game" };
      const res = terminateIncomingLoan(state, playerId, state.manager.clubId);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const upgradeFacilityAction = useCallback(
    (facilityType: FacilityType) => {
      if (!state) return { success: false, error: "No active game" };
      const res = upgradeClubFacility(state, state.manager.clubId, facilityType);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const upgradeCoachingAction = useCallback(() => {
    if (!state) return { success: false, error: "No active game" };
    const res = upgradeCoachingStaff(state, state.manager.clubId);
    if (res.success) {
      setState(res.state);
    }
    return { success: res.success, error: res.error };
  }, [state]);

  const expandStadiumCapacityAction = useCallback(
    (seats: number) => {
      if (!state) return { success: false, error: "No active game" };
      const res = expandStadium(state, state.manager.clubId, seats);
      if (res.success) {
        setState(res.state);
      }
      return { success: res.success, error: res.error };
    },
    [state]
  );

  const investInPlayerCareerAction = useCallback(
    (playerId: string, programType: PlayerInvestmentType) => {
      if (!state) return { success: false, error: "No active game" };
      const res = investInPlayer(state, state.manager.clubId, playerId, programType);
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

  const markAllMessagesRead = useCallback(() => {
    if (!state) return;
    if (state.inbox.unreadCount === 0 && state.inbox.messages.every((m) => m.isRead)) return;
    const msgs = state.inbox.messages.map((m) =>
      m.isRead ? m : { ...m, isRead: true }
    );
    setState({
      ...state,
      inbox: { messages: msgs, unreadCount: 0 },
    });
  }, [state]);

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
      clearCareerOverlays();
      setState(ensureClubSquadDepth(loaded));
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("27-0-manager-in-session", "true");
        if (slot !== "auto") {
          window.localStorage.setItem("27-0-manager-active-slot-v3", String(slot));
        }
      }
      setActiveTab("dashboard");
      return true;
    }
    return false;
  }, [clearCareerOverlays]);

  const exportSave = useCallback(() => {
    if (!state) return "";
    return exportSaveToJson(state);
  }, [state]);

  const importSave = useCallback((jsonStr: string, targetSlot: number = 0) => {
    const imported = importSaveFromJson(jsonStr);
    if (imported) {
      clearCareerOverlays();
      setState(ensureClubSquadDepth(imported));
      saveManagerState(imported, targetSlot);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("27-0-manager-in-session", "true");
        window.localStorage.setItem("27-0-manager-active-slot-v3", String(targetSlot));
      }
      setActiveTab("dashboard");
      return true;
    }
    return false;
  }, [clearCareerOverlays]);

  const deleteSave = useCallback((slot: number | "auto") => {
    return deleteSaveSlot(slot);
  }, []);

  const exitToMenu = useCallback(() => {
    if (state) {
      persistManagerProgress(state);
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("27-0-manager-in-session");
    }
    clearCareerOverlays();
    setState(null);
    setActiveTab("dashboard");
  }, [state, clearCareerOverlays]);

  const resetCareer = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("27-0-manager-in-session");
    }
    clearCareerOverlays();
    setState(null);
    setActiveTab("dashboard");
  }, [clearCareerOverlays]);

  const replenishSquadTiers = useCallback(
    (tier: "reserves" | "academy") => {
      if (!state) return;
      const userClubId = state.manager.clubId;
      const club = state.clubs[userClubId];
      if (!club) return;

      const currentCount = Object.values(state.players).filter(
        (p) => p.clubId === userClubId && p.squadTier === tier && !p.isRetired
      ).length;
      const needed = Math.max(0, 17 - currentCount);
      if (needed === 0) {
        const filled = ensureClubSquadDepth(state, userClubId);
        setState(filled);
        return;
      }

      const topped = ensureClubSquadDepth(state, userClubId);
      const added =
        Object.values(topped.players).filter(
          (p) => p.clubId === userClubId && p.squadTier === tier && !p.isRetired
        ).length - currentCount;

      const title = tier === "reserves" ? "Reserve Squad Replenished" : "Youth Trials Completed";
      const body =
        tier === "reserves"
          ? `${added > 0 ? added : needed} reserve grade players have been brought in to restore a full matchday 17.`
          : `${added > 0 ? added : needed} academy prospects have been recruited to restore a full matchday 17.`;

      const nextState: ManagerState = {
        ...topped,
        inbox: {
          ...topped.inbox,
          messages: [
            {
              id: `inbox_replenish_${tier}_${Date.now()}`,
              season: topped.calendar.currentSeason,
              week: topped.calendar.currentWeek,
              dateStr: `Week ${topped.calendar.currentWeek}`,
              sender: tier === "reserves" ? "Reserve Grade Coach" : "Head of Youth",
              subject: title,
              body,
              category: "general",
              isRead: false,
            },
            ...topped.inbox.messages,
          ],
          unreadCount: topped.inbox.unreadCount + 1,
        },
      };

      setState(nextState);
    },
    [state]
  );

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
        activeKeyMomentsFixture,
        openKeyMoments,
        closeKeyMoments,
        seasonAwardsModal,
        setSeasonAwardsModal,
        contractExpiryModalPlayers,
        dismissContractExpiryModal,
        tutorialOpen,
        openTutorial,
        dismissTutorial,
        startNewGame,
        advanceCurrentWeek,
        lastAdvanceError,
        clearAdvanceError,
        getUserMatchdayReadiness,
        rolloverCurrentSeason,
        movePlayer,
        saveLineup,
        autoPickSquad,
        updateClubTactics,
        setTrainingFocus,
        setTrainingIntensity,
        setTransferListed,
        setLoanListed,
        updateSettings,
        renewContract,
        renewAllTierContracts,
        releasePlayer,
        signFreeAgentPlayer,
        bidOnPlayer,
        decideOnIncomingBid,
        loanPlayerOut,
        loanPlayerIn: loanPlayerInAction,
        recallPlayerLoan,
        terminateIncomingLoan: terminateIncomingLoanAction,
        upgradeFacility: upgradeFacilityAction,
        upgradeCoaching: upgradeCoachingAction,
        expandStadiumCapacity: expandStadiumCapacityAction,
        investInPlayerCareer: investInPlayerCareerAction,
        markMessageRead,
        markAllMessagesRead,
        saveToSlot,
        loadFromSlot,
        deleteSave,
        exportSave,
        importSave,
        resetCareer,
        exitToMenu,
        replenishSquadTiers,
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
