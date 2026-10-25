"use client";

import { useEffect, useState } from "react";
import { ClubFundsEarned } from "@/components/ClubFundsEarned";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import {
  LOGIN_WELCOME_EVENT,
  LOGIN_WELCOME_TITLE,
  clearPendingLoginWelcome,
  takePendingLoginWelcome,
} from "@/lib/storage/login-welcome";

/**
 * One-time "Welcome to the club" popup after an account's first sign-in: the £100k bonus and the
 * Chalk frame, in the same breakdown popup a season uses. Mounted once in the root layout; the
 * grant itself happens in the auth hydrate (see lib/storage/login-welcome.ts).
 */
export function LoginWelcomePopup() {
  const [payout, setPayout] = useState<ClubFundsPayoutResult | null>(null);

  useEffect(() => {
    // Granted on a previous page before this mounted (e.g. a full reload mid-login).
    const pending = takePendingLoginWelcome();
    if (pending) setPayout(pending);
    const onWelcome = (e: Event) => {
      const detail = (e as CustomEvent<ClubFundsPayoutResult>).detail;
      if (!detail) return;
      clearPendingLoginWelcome();
      setPayout(detail);
    };
    window.addEventListener(LOGIN_WELCOME_EVENT, onWelcome);
    return () => window.removeEventListener(LOGIN_WELCOME_EVENT, onWelcome);
  }, []);

  if (!payout) return null;
  return <ClubFundsEarned payout={payout} title={LOGIN_WELCOME_TITLE} />;
}
