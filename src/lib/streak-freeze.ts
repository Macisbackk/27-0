import {
  addDailyStreakFreeze,
  DAILY_FREEZE_PRICE,
  DAILY_MAX_FREEZES,
  getDailyChallengeDateKey,
  getDailyStreakFreezes,
} from "./daily-challenge";
import { getClubFundsBalance, spendClubFunds } from "./storage/club-funds";

export type BuyStreakFreezeResult =
  | { ok: true; freezes: number; newBalance: number }
  | { ok: false; reason: "max-held" | "insufficient-funds"; freezes: number };

/** Whether a freeze can be bought right now, and why not. */
export function getStreakFreezeOffer(): {
  price: number;
  held: number;
  max: number;
  canBuy: boolean;
  reason: "max-held" | "insufficient-funds" | null;
} {
  const held = getDailyStreakFreezes();
  const reason =
    held >= DAILY_MAX_FREEZES
      ? "max-held"
      : getClubFundsBalance() < DAILY_FREEZE_PRICE
        ? "insufficient-funds"
        : null;
  return { price: DAILY_FREEZE_PRICE, held, max: DAILY_MAX_FREEZES, canBuy: reason === null, reason };
}

/**
 * Buy one Daily streak freeze for DAILY_FREEZE_PRICE Club Funds (max DAILY_MAX_FREEZES held).
 * A missed day uses a held freeze automatically. Safe to call from the Store or the Daily UI.
 */
export function buyStreakFreeze(date = new Date()): BuyStreakFreezeResult {
  const held = getDailyStreakFreezes();
  if (held >= DAILY_MAX_FREEZES) return { ok: false, reason: "max-held", freezes: held };
  const purchaseId = `streak-freeze:${getDailyChallengeDateKey(date)}:${date.getTime().toString(36)}`;
  const spent = spendClubFunds(DAILY_FREEZE_PRICE, purchaseId);
  if (!spent.success) return { ok: false, reason: "insufficient-funds", freezes: held };
  const freezes = addDailyStreakFreeze(date) ?? held;
  return { ok: true, freezes, newBalance: spent.newBalance };
}
