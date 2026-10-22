"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isLoggedIn } from "../auth-session";
import { submitCareerLeaderboards } from "../storage/career-leaderboard";
import { bankSeason, emptyLegacy, unlockLegend as unlockLegendPure, type RecordBreaks } from "./legacy";
import { autoPickLineup } from "./players";
import {
  beginOffseason,
  buildMarket,
  buyPlayer as buyPure,
  finishTransfers as finishTransfersPure,
  sellPlayer as sellPure,
  type MarketListing,
  type TransferError,
} from "./offseason";
import { playMatchday, repairLineup, simRestOfSeason, simToNextBigGame, squadOf, type PlayedResult } from "./season";
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
import type { CareerLegacy, CareerState, Tactic } from "./types";
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
  /** Finish the matchday with the result of a match the user played live. */
  playLive: (played: PlayedResult) => void;
  setTactic: (t: Tactic) => void;
  setLineupSlot: (slot: number, playerId: string) => void;
  autoPick: () => void;
  goToOffseason: () => void;
  buy: (listing: MarketListing) => TransferError | undefined;
  sell: (playerId: string) => TransferError | undefined;
  finishTransfers: () => void;
  unlockLegend: (legendId: string) => "points" | "unknown" | "owned" | undefined;
}

const CareerContext = createContext<CareerContextValue | null>(null);

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
      if (next.phase === "review" && next.lastOutcome && !next.lastOutcome.banked) {
        const { legacy: banked, breaks } = bankSeason(legacyRef.current, next, next.lastOutcome);
        const marked: CareerState = { ...next, lastOutcome: { ...next.lastOutcome, banked: true } };
        marked.history = marked.history.map((h, i) => (i === marked.history.length - 1 ? { ...h, banked: true } : h));
        setRecordBreaks(breaks);
        commit(marked, banked, true);
        void submitCareerLeaderboards(banked);
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

  const market = useMemo(
    () => (state?.phase === "transfers" ? buildMarket(state, legacy.unlockedLegends) : []),
    [state, legacy.unlockedLegends]
  );

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
    },
    abandonCareer: () => {
      setRecordBreaks(null);
      commit(null);
    },
    play: () => {
      if (stateRef.current) settle(playMatchday(stateRef.current));
    },
    playLive: (played) => {
      if (stateRef.current) settle(playMatchday(stateRef.current, played));
    },
    simToBigGame: () => {
      if (stateRef.current) settle(simToNextBigGame(stateRef.current));
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
      if (!r.error) commit(r.state);
      return r.error;
    },
    sell: (playerId) => {
      const s = stateRef.current;
      if (!s) return "not-available";
      const r = sellPure(s, playerId);
      if (!r.error) commit(r.state);
      return r.error;
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
