"use client";

import { useLayoutEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth-session";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  flushClubFundsToCloud,
  getClubFundsBalance,
  getClubFundsTotalEarned,
  refreshClubFundsFromCloud,
  syncClubFundsLeaderboardOnLoad,
} from "@/lib/storage/club-funds";

export function useClubFunds() {
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const sync = () => {
      setBalance(getClubFundsBalance());
      setTotalEarned(getClubFundsTotalEarned());
    };

    const pullFromCloud = () => {
      if (!isLoggedIn()) return;
      void refreshClubFundsFromCloud().then(sync);
    };

    sync();
    syncClubFundsLeaderboardOnLoad();
    pullFromCloud();
    setReady(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        pullFromCloud();
      }
    };

    const onHide = () => {
      if (document.visibilityState === "hidden" && isLoggedIn()) {
        flushClubFundsToCloud();
      }
    };

    // Auth hydrate already merges funds — only re-read local storage here to
    // avoid a second cloud round-trip that flashes the header balance.
    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
    window.addEventListener("auth-state-changed", sync);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushClubFundsToCloud);

    return () => {
      window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
      window.removeEventListener("auth-state-changed", sync);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushClubFundsToCloud);
    };
  }, []);

  return { balance, totalEarned, ready };
}
