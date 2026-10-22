import { getBoostDefinition } from "./boostDefinitions";
import { loadBoostInventory, recordRetiredBoostRefund } from "./boostInventory";
import { awardClubFundsLines } from "../storage/club-funds";

/** Ledger id: the refund pays once per account, even across devices. */
export const BOOST_REFUND_RUN_ID = "boost-refund-v1";

/**
 * Store boosts were retired in v1.93. Anyone still holding unused boosts gets their Club Funds
 * back (the price they cost), once, and the boosts are marked as used so they can't come back.
 */
export function refundRetiredBoosts(): number {
  if (typeof window === "undefined") return 0;
  const inventory = loadBoostInventory();
  const lines: { id: string; label: string; amount: number }[] = [];
  for (const [boostId, qty] of Object.entries(inventory.quantities)) {
    const def = getBoostDefinition(boostId as never);
    if (!def || !(qty > 0)) continue;
    lines.push({
      id: `refund-${boostId}`,
      label: `Refund: ${qty} × ${def.name ?? boostId}`,
      amount: def.price * qty,
    });
  }
  if (!lines.length) return 0;
  const payout = awardClubFundsLines(BOOST_REFUND_RUN_ID, lines);
  // Either just refunded, or refunded earlier on another device: the boosts are spent either way.
  recordRetiredBoostRefund();
  return payout.awarded ? payout.total : 0;
}
