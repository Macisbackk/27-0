"use client";

import { useLayoutEffect, useState } from "react";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  getClubFundsBalance,
  getClubFundsTotalEarned,
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

    sync();
    syncClubFundsLeaderboardOnLoad();
    setReady(true);

    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
  }, []);

  return { balance, totalEarned, ready };
}
