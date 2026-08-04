import { getBoostDefinition, type GameBoostId } from "./boostDefinitions";
import {
  addBoostToInventory,
  getBoostQuantity,
  type BoostPurchaseRecord,
} from "./boostInventory";
import { spendClubFunds } from "../storage/club-funds";

export interface PurchaseBoostResult {
  success: boolean;
  reason?: "unknown" | "insufficient" | "duplicate" | "failed";
  newBalance: number;
  ownedQuantity: number;
}

const pendingPurchases = new Set<string>();

/**
 * Atomic purchase: spend Club Funds then credit inventory.
 * Same purchaseId cannot double-charge.
 */
export function purchaseBoost(input: {
  boostId: GameBoostId;
  quantity?: number;
  transactionId: string;
}): PurchaseBoostResult {
  const def = getBoostDefinition(input.boostId);
  if (!def) {
    return {
      success: false,
      reason: "unknown",
      newBalance: 0,
      ownedQuantity: getBoostQuantity(input.boostId),
    };
  }

  const quantity = Math.max(1, input.quantity ?? 1);
  const purchaseId = input.transactionId;
  if (pendingPurchases.has(purchaseId)) {
    return {
      success: false,
      reason: "duplicate",
      newBalance: 0,
      ownedQuantity: getBoostQuantity(input.boostId),
    };
  }

  pendingPurchases.add(purchaseId);
  try {
    const total = def.price * quantity;
    const spend = spendClubFunds(total, purchaseId);
    if (!spend.success) {
      return {
        success: false,
        reason: "insufficient",
        newBalance: spend.newBalance,
        ownedQuantity: getBoostQuantity(input.boostId),
      };
    }

    const purchase: BoostPurchaseRecord = {
      id: purchaseId,
      boostId: input.boostId,
      quantity,
      pricePaid: total,
      purchasedAt: new Date().toISOString(),
    };
    addBoostToInventory(input.boostId, quantity, purchase);

    return {
      success: true,
      newBalance: spend.newBalance,
      ownedQuantity: getBoostQuantity(input.boostId),
    };
  } finally {
    pendingPurchases.delete(purchaseId);
  }
}
