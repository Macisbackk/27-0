"use client";

import type { ClubFundsPayoutResult } from "../club-funds";
import { CHALK_FRAME_ID, cosmeticById } from "../cosmetics";
import { awardClubFundsLines, getPaidRunIds } from "./club-funds";
import { grantCosmetic, ownsCosmetic } from "./cosmetics-store";

/**
 * One-off "Welcome to the club" bonus the first time an account signs in: £100k Club Funds and the
 * Chalk frame. The run id lives in the Club Funds paid ledger, which syncs with the account, so it
 * pays once per account even across devices (trimPaidRunIds keeps "login-welcome*" ids forever).
 */
export const LOGIN_WELCOME_RUN_ID = "login-welcome-v1";
export const LOGIN_WELCOME_AMOUNT = 100_000;
export const LOGIN_WELCOME_FRAME_ID = CHALK_FRAME_ID;
export const LOGIN_WELCOME_TITLE = "Welcome to the club";

/** Fired on window with the popup payout when the bonus has just been paid. */
export const LOGIN_WELCOME_EVENT = "27-0-login-welcome";
/** Pending popup, in case the page changes between the grant and the popup mounting. */
const PENDING_KEY = "27-0-login-welcome-pending";

/** Popup lines: the cash plus the frame (amount 0 renders as "Unlocked"). */
export function loginWelcomePopup(result: ClubFundsPayoutResult): ClubFundsPayoutResult {
  const frameName = cosmeticById(LOGIN_WELCOME_FRAME_ID)?.name ?? "Chalk frame";
  return { ...result, lines: [...result.lines, { id: "login-welcome-frame", label: `${frameName} unlocked`, amount: 0 }] };
}

/**
 * Pay the welcome bonus if this account has never had it. Call only after the account's cloud
 * Club Funds have merged into local storage, so a returning coach's marker is already present.
 * Returns the popup payout when the bonus was paid just now, otherwise null.
 */
export function grantLoginWelcome(): ClubFundsPayoutResult | null {
  if (typeof window === "undefined") return null;
  const alreadyPaid = getPaidRunIds().includes(LOGIN_WELCOME_RUN_ID);
  if (alreadyPaid) {
    // Marker synced but the cosmetics row didn't (or was saved before the frame existed): the
    // frame is part of the bonus, so make sure it is owned without paying again.
    if (!ownsCosmetic(LOGIN_WELCOME_FRAME_ID)) grantCosmetic(LOGIN_WELCOME_FRAME_ID);
    return null;
  }
  const result = awardClubFundsLines(LOGIN_WELCOME_RUN_ID, [
    { id: "login-welcome", label: LOGIN_WELCOME_TITLE, amount: LOGIN_WELCOME_AMOUNT },
  ]);
  if (!result.awarded) return null;
  grantCosmetic(LOGIN_WELCOME_FRAME_ID);
  const popup = loginWelcomePopup(result);
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(popup));
  } catch {
    /* storage blocked: the event still shows it this page */
  }
  window.dispatchEvent(new CustomEvent<ClubFundsPayoutResult>(LOGIN_WELCOME_EVENT, { detail: popup }));
  return popup;
}

/** Popup saved by grantLoginWelcome that hasn't been shown yet (cleared on read). */
export function takePendingLoginWelcome(): ClubFundsPayoutResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as Partial<ClubFundsPayoutResult>;
    if (!Array.isArray(parsed.lines) || typeof parsed.total !== "number") return null;
    return parsed as ClubFundsPayoutResult;
  } catch {
    return null;
  }
}

export function clearPendingLoginWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
