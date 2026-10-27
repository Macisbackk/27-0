"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isLoggedIn } from "../auth-session";
import { submitCareerLeaderboards } from "../storage/career-leaderboard";
import {
  triggerCareerSeasonAchievements,
  triggerCareerStartedAchievements,
} from "../achievements/achievementTriggers";
import { bankSeason, emptyLegacy, unlockLegend as unlockLegendPure, type RecordBreaks } from "./legacy";
import { autoPickLineup } from "./players";
import {
  beginOffseason,
  buildMarket,
  buyPlayer as buyPure,
  finishDepartures as finishDeparturesPure,
  finishTransfers as finishTransfersPure,
  sellPlayer as sellPure,
  type MarketListing,
  type TransferError,
} from "./offseason";
import { playMatchday, repairLineup, simRestOfSeason, simToNextBigGame, squadOf, type PlayedResult } from "./season";
import {
  acceptBid as acceptBidPure,
  acceptOffer as acceptOfferPure,
  closeDeadlineDay,
  deadlineMarketBatch,
  isDeadlineDay,
  isWindowOpen,
  pauseDeadline as pauseDeadlinePure,
  recordUserDeal,
  rejectBid as rejectBidPure,
  rejectOffer as rejectOfferPure,
  tickDeadline as tickDeadlinePure,
  type OfferError,
} from "./midseason";
import { playFriendlies as playFriendliesPure, type FriendlyOption } from "./preseason";
import { releaseExpiring, renewContract, type ContractError } from "./contracts";
import { markStageSeen, simToNextStop, skipIdleWeeks, type StageKey } from "./stages";
import { reportMissionEvent } from "../daily-missions";
import {
  LEGACY_KEY,
  SAVE_KEY,
  loadLocalCareer,
  loadLocalLegacy,
  pushCareerToCloud,
  saveLocalCareer,
  saveLocalLegacy,
  syncCareerFromCloud,
} from "./storage";
import type { CareerLegacy, CareerState, SeasonOutcome, Tactic } from "./types";
import { createCareer } from "./world";

interface CareerContextValue {
  ready: boolean;
  state: CareerState | null;
  legacy: CareerLegacy;
  /** Records broken by the season just banked (for the review screen). */
  recordBreaks: RecordBreaks | null;
  market: MarketListing[];
  newCareer: (clubId: string, managerName: string, seed?: string) => void;
  abandonCareer: () => void;
  play: () => void;
  simToBigGame: () => void;
  simSeason: () => void;
  /** Sim every week up to the next decision (Deadline Day, a cup or play-off tie, a season stage). */
  simToStop: () => void;
  /** Finish the matchday with the result of a match the user played live. */
  playLive: (played: PlayedResult) => void;
  setTactic: (t: Tactic) => void;
  setLineupSlot: (slot: number, playerId: string) => void;
  autoPick: () => void;
  goToOffseason: () => void;
  buy: (listing: MarketListing) => TransferError | undefined;
  /** Sell a player: says where he went (a club that needs his position) and why. */
  sell: (playerId: string) => { error?: TransferError; soldTo?: string | null; reason?: string; fee?: number };
  finishTransfers: () => void;
  /** Answer a rival's bid for one of your players (mid-season window). */
  acceptBid: () => void;
  rejectBid: () => void;
  unlockLegend: (legendId: string) => "points" | "unknown" | "owned" | undefined;
  /** Shut the mid-season window on Deadline Day so the season can carry on. */
  closeDeadline: () => void;
  /** Deadline Day: run the clock forward, pause it, answer offers. */
  tickDeadline: (minutes: number) => void;
  pauseDeadline: (paused: boolean) => void;
  acceptOffer: (offerId: string) => OfferError | undefined;
  rejectOffer: (offerId: string) => void;
  /** Play the chosen pre-season friendlies (empty = skip pre-season). */
  playFriendlies: (picks: FriendlyOption[]) => void;
  /** Mark the first-save walkthrough as seen. */
  finishTutorial: () => void;
  /** Move past a stage with nothing to play (pre-season results, league over, promotion). */
  passStage: (key: StageKey) => void;
  /** Summer: renew an out-of-contract player, or let him go. */
  renew: (playerId: string) => ContractError | undefined;
  release: (playerId: string) => void;
  /** Summer: done with departures, open the transfer window. */
  finishDepartures: () => void;
}

const CareerContext = createContext<CareerContextValue | null>(null);

/** Daily Missions: one event per game of yours that `next` has played since `prev`. */
function reportManagerGames(prev: CareerState, next: CareerState) {
  if (prev.seed !== next.seed || prev.year !== next.year) return;
  for (let i = prev.matchdayIndex; i < next.matchdayIndex; i++) {
    const f = next.calendar[i]?.fixtures.find((x) => x.home === next.userClubId || x.away === next.userClubId);
    if (!f?.result) continue;
    const us = f.home === next.userClubId ? f.result.homeScore : f.result.awayScore;
    const them = f.home === next.userClubId ? f.result.awayScore : f.result.homeScore;
    reportMissionEvent({ kind: "manager", won: us > them });
  }
}

export function CareerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CareerState | null>(null);
  const [legacy, setLegacy] = useState<CareerLegacy>(() => emptyLegacy());
  const [recordBreaks, setRecordBreaks] = useState<RecordBreaks | null>(null);
  const stateRef = useRef(state);
  const legacyRef = useRef(legacy);
  stateRef.current = state;
  legacyRef.current = legacy;
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cloud backup is a full ~300 KB document, so batch it: at most every 20s of play,
  // plus immediately at season end and when the app is hidden (see onHide).
  const schedulePush = useCallback((immediate = false) => {
    if (!isLoggedIn()) return;
    if (immediate) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = null;
      void pushCareerToCloud(stateRef.current, legacyRef.current);
      return;
    }
    if (pushTimer.current) return;
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      void pushCareerToCloud(stateRef.current, legacyRef.current);
    }, 20_000);
  }, []);

  const commit = useCallback(
    (next: CareerState | null, nextLegacy?: CareerLegacy, pushNow = false) => {
      setState(next);
      saveLocalCareer(next);
      if (nextLegacy) {
        setLegacy(nextLegacy);
        saveLocalLegacy(nextLegacy);
      }
      stateRef.current = next;
      if (nextLegacy) legacyRef.current = nextLegacy;
      schedulePush(pushNow);
    },
    [schedulePush]
  );

  /** Bank a just-finished season into the legacy exactly once. */
  const settle = useCallback(
    (next: CareerState) => {
      const prev = stateRef.current;
      if (prev && next !== prev) reportManagerGames(prev, next);
      if (next.phase === "review" && next.lastOutcome && !next.lastOutcome.banked) {
        const { legacy: banked, breaks } = bankSeason(legacyRef.current, next, next.lastOutcome);
        const outcome: SeasonOutcome = { ...next.lastOutcome, banked: true };
        const marked: CareerState = { ...next, lastOutcome: outcome };
        marked.history = marked.history.map((h, i) => (i === marked.history.length - 1 ? { ...h, banked: true } : h));
        setRecordBreaks(breaks);
        commit(marked, banked, true);
        void submitCareerLeaderboards(banked);
        // Manager Mode achievements (Gaffer, Silverware, Deadline Dealer, ...) — once per banked season.
        triggerCareerSeasonAchievements(outcome, banked, marked);
        return;
      }
      commit(next);
    },
    [commit]
  );

  // Load + cloud sync.
  useEffect(() => {
    const local = loadLocalCareer();
    const localLegacy = loadLocalLegacy();
    setState(local);
    setLegacy(localLegacy);
    stateRef.current = local;
    legacyRef.current = localLegacy;
    setReady(true);

    const sync = async () => {
      if (!isLoggedIn()) return;
      const result = await syncCareerFromCloud(stateRef.current, legacyRef.current);
      if (result.changed) {
        setState(result.state);
        setLegacy(result.legacy);
        saveLocalCareer(result.state);
        saveLocalLegacy(result.legacy);
        stateRef.current = result.state;
        legacyRef.current = result.legacy;
        // Records banked as a guest (or on another device) reach the board after login.
        void submitCareerLeaderboards(result.legacy);
      } else if (stateRef.current || legacyRef.current.lifetimeLegacyPoints > 0) {
        void pushCareerToCloud(stateRef.current, legacyRef.current);
      }
    };
    void sync();
    const onAuth = () => void sync();
    const onHide = () => {
      if (document.visibilityState === "hidden" && isLoggedIn() && pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
        void pushCareerToCloud(stateRef.current, legacyRef.current);
      }
    };
    // Another tab saved: adopt it so two open tabs never overwrite each other's progress.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAVE_KEY) {
        const next = loadLocalCareer();
        setState(next);
        stateRef.current = next;
      } else if (e.key === LEGACY_KEY) {
        const next = loadLocalLegacy();
        setLegacy(next);
        legacyRef.current = next;
      }
    };
    window.addEventListener("auth-state-changed", onAuth);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-state-changed", onAuth);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Summer window, or the mid-season window (a fresh list every round it's open).
  const market = useMemo(() => {
    if (!state) return [];
    if (state.phase === "transfers") return buildMarket(state, legacy.unlockedLegends);
    if (isWindowOpen(state)) {
      // Deadline Day: fresh names every three hours of the clock.
      const salt = isDeadlineDay(state) ? `mid-${state.matchdayIndex}-dd${deadlineMarketBatch(state)}` : `mid-${state.matchdayIndex}`;
      return buildMarket(state, legacy.unlockedLegends, salt);
    }
    return [];
  }, [state, legacy.unlockedLegends]);

  const value: CareerContextValue = {
    ready,
    state,
    legacy,
    recordBreaks,
    market,
    newCareer: (clubId, managerName, seed) => {
      const next = createCareer({ clubId, managerName, seed });
      const nextLegacy = { ...legacyRef.current, careersStarted: legacyRef.current.careersStarted + 1, updatedAt: Date.now() };
      setRecordBreaks(null);
      commit(next, nextLegacy);
      triggerCareerStartedAchievements(nextLegacy);
    },
    abandonCareer: () => {
      setRecordBreaks(null);
      commit(null);
    },
    // Weeks with nothing for you (no game, no stage) play straight through after each action.
    play: () => {
      if (stateRef.current) settle(skipIdleWeeks(playMatchday(stateRef.current)));
    },
    playLive: (played) => {
      if (stateRef.current) settle(skipIdleWeeks(playMatchday(stateRef.current, played)));
    },
    simToStop: () => {
      if (stateRef.current) settle(skipIdleWeeks(simToNextStop(stateRef.current)));
    },
    closeDeadline: () => {
      if (stateRef.current) settle(skipIdleWeeks(closeDeadlineDay(stateRef.current)));
    },
    tickDeadline: (minutes) => {
      const s = stateRef.current;
      if (!s) return;
      const next = tickDeadlinePure(s, minutes);
      if (next !== s) commit(next);
    },
    pauseDeadline: (paused) => {
      const s = stateRef.current;
      if (!s) return;
      const next = pauseDeadlinePure(s, paused);
      if (next !== s) commit(next);
    },
    acceptOffer: (offerId) => {
      const s = stateRef.current;
      if (!s) return "gone";
      const r = acceptOfferPure(s, offerId);
      if (!r.error) commit({ ...r.state, lineup: repairLineup(r.state, r.state.lineup) });
      return r.error;
    },
    rejectOffer: (offerId) => {
      const s = stateRef.current;
      if (s) commit(rejectOfferPure(s, offerId));
    },
    // The friendly results show on the Round 1 screen, so they don't need a stage of their own.
    playFriendlies: (picks) => {
      if (stateRef.current) commit(markStageSeen(playFriendliesPure(stateRef.current, picks), "preseason"));
    },
    passStage: (key) => {
      const s = stateRef.current;
      if (s) settle(skipIdleWeeks(markStageSeen(s, key)));
    },
    renew: (playerId) => {
      const s = stateRef.current;
      if (!s) return "not-expiring";
      const r = renewContract(s, playerId);
      if (!r.error) commit(r.state);
      return r.error;
    },
    release: (playerId) => {
      const s = stateRef.current;
      if (s) commit(releaseExpiring(s, playerId));
    },
    finishDepartures: () => {
      const s = stateRef.current;
      if (s) commit(finishDeparturesPure(s));
    },
    finishTutorial: () => {
      const s = stateRef.current;
      if (s && !s.tutorialDone) commit({ ...s, tutorialDone: true, updatedAt: Date.now() });
    },
    simToBigGame: () => {
      if (stateRef.current) settle(skipIdleWeeks(simToNextBigGame(stateRef.current)));
    },
    simSeason: () => {
      if (stateRef.current) settle(simRestOfSeason(stateRef.current));
    },
    setTactic: (t) => {
      if (stateRef.current) commit({ ...stateRef.current, tactic: t, updatedAt: Date.now() });
    },
    setLineupSlot: (slot, playerId) => {
      const s = stateRef.current;
      if (!s) return;
      const lineup = [...s.lineup];
      const existing = lineup.indexOf(playerId);
      if (existing >= 0) lineup[existing] = lineup[slot]!; // swap
      lineup[slot] = playerId;
      commit({ ...s, lineup: repairLineup(s, lineup), updatedAt: Date.now() });
    },
    autoPick: () => {
      const s = stateRef.current;
      if (s) commit({ ...s, lineup: autoPickLineup(squadOf(s, s.userClubId)), updatedAt: Date.now() });
    },
    goToOffseason: () => {
      const s = stateRef.current;
      if (!s) return;
      setRecordBreaks(null);
      commit(beginOffseason(s));
    },
    buy: (listing) => {
      const s = stateRef.current;
      if (!s) return "not-available";
      const r = buyPure(s, listing);
      if (!r.error) {
        if (isWindowOpen(r.state)) {
          const p = r.state.players[listing.playerId];
          if (p) recordUserDeal(r.state, { playerId: p.id, playerName: p.name, pos: p.pos, rating: p.rating, from: listing.fromClubId, to: r.state.userClubId, fee: listing.price });
        }
        commit(r.state);
      }
      return r.error;
    },
    sell: (playerId) => {
      const s = stateRef.current;
      if (!s) return { error: "not-available" };
      const before = s.players[playerId];
      const r = sellPure(s, playerId);
      if (!r.error) {
        if (isWindowOpen(r.state) && before) {
          recordUserDeal(r.state, {
            playerId,
            playerName: before.name,
            pos: before.pos,
            rating: before.rating,
            from: r.state.userClubId,
            to: r.soldTo ?? null,
            fee: r.fee ?? Math.max(0, r.state.budget - s.budget),
          });
        }
        commit(r.state);
      }
      return { error: r.error, soldTo: r.soldTo, reason: r.reason, fee: r.fee };
    },
    acceptBid: () => {
      const s = stateRef.current;
      if (!s) return;
      const next = acceptBidPure(s);
      commit({ ...next, lineup: repairLineup(next, next.lineup) });
    },
    rejectBid: () => {
      const s = stateRef.current;
      if (s) commit(rejectBidPure(s));
    },
    finishTransfers: () => {
      if (stateRef.current) commit(finishTransfersPure(stateRef.current));
    },
    unlockLegend: (legendId) => {
      const r = unlockLegendPure(legacyRef.current, legendId);
      if (!r.error) commit(stateRef.current, r.legacy);
      return r.error;
    },
  };

  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>;
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) throw new Error("useCareer must be used inside <CareerProvider>");
  return ctx;
}
