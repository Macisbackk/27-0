"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatClubFunds,
  formatClubFundsExact,
} from "@/lib/club-funds";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  getClubFundsBalance,
} from "@/lib/storage/club-funds";
import {
  BOOST_INVENTORY_CHANGED_EVENT,
  getBoostQuantity,
} from "@/lib/boosts/boostInventory";
import {
  getQuickModeBoosts,
  type GameBoost,
  type GameBoostId,
} from "@/lib/boosts/boostDefinitions";
import { purchaseBoost } from "@/lib/boosts/purchaseBoost";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "./ui/GameButton";
import { GameModal } from "./ui/GameModal";
import {
  playThemePurchaseFail,
  playThemePurchaseSuccess,
  playUiClick,
} from "@/lib/sound";

const EXPENSIVE_PURCHASE_THRESHOLD = 2_000_000;

function BoostCard({
  boost,
  balance,
  owned,
  purchasing,
  onPurchase,
}: {
  boost: GameBoost;
  balance: number;
  owned: number;
  purchasing: boolean;
  onPurchase: (boost: GameBoost) => void;
}) {
  const canAfford = balance >= boost.price;

  return (
    <li className={`${CARD.panel} overflow-hidden rounded-xl border-pitch-700/50`}>
      <div className={`${SPACING.cardPaddingSm} sm:space-y-0`}>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-white sm:text-base sm:normal-case sm:tracking-normal">
            {boost.name}
          </p>
          <p className={`mt-1 line-clamp-2 ${TYPO.bodySm} text-gray-400 sm:line-clamp-none`}>
            {boost.description}
          </p>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
            {boost.usageLimitLabel}
          </p>
          <p className="mt-2 text-xs font-medium text-accent-gold">
            Use in-game
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-300">
            Owned ×{owned}
            <span className="text-pitch-600"> · </span>
            {formatClubFundsExact(boost.price)}
          </p>
          <GameButton
            variant="theme"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            disabled={!canAfford || purchasing}
            onClick={() => onPurchase(boost)}
          >
            Buy — {formatClubFunds(boost.price)}
          </GameButton>
        </div>
      </div>
    </li>
  );
}

function BoostSection({
  title,
  description,
  boosts,
  balance,
  quantities,
  purchasingId,
  onPurchase,
}: {
  title: string;
  description: string;
  boosts: GameBoost[];
  balance: number;
  quantities: Record<string, number>;
  purchasingId: string | null;
  onPurchase: (boost: GameBoost) => void;
}) {
  if (boosts.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <p className={`mt-1 ${TYPO.bodySm} text-gray-500`}>{description}</p>
      <ul className={`mt-4 grid gap-3 sm:grid-cols-2 ${SPACING.stackMd}`}>
        {boosts.map((boost) => (
          <BoostCard
            key={boost.id}
            boost={boost}
            balance={balance}
            owned={quantities[boost.id] ?? 0}
            purchasing={purchasingId === boost.id}
            onPurchase={onPurchase}
          />
        ))}
      </ul>
    </section>
  );
}

export function StoreBoostsPanel() {
  const [balance, setBalance] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [confirmBoost, setConfirmBoost] = useState<GameBoost | null>(null);

  const refresh = useCallback(() => {
    setBalance(getClubFundsBalance());
    const next: Record<string, number> = {};
    for (const boost of getQuickModeBoosts()) {
      next[boost.id] = getBoostQuantity(boost.id);
    }
    setQuantities(next);
  }, []);

  useEffect(() => {
    refresh();

    const onFunds = () => setBalance(getClubFundsBalance());
    const onInventory = () => refresh();

    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, onFunds);
    window.addEventListener(BOOST_INVENTORY_CHANGED_EVENT, onInventory);
    return () => {
      window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, onFunds);
      window.removeEventListener(BOOST_INVENTORY_CHANGED_EVENT, onInventory);
    };
  }, [refresh]);

  const executePurchase = (boost: GameBoost) => {
    if (purchasingId) return;
    playUiClick();
    setPurchaseError(null);
    setPurchasingId(boost.id);

    const transactionId = `boost-${boost.id}-${Date.now()}`;
    const result = purchaseBoost({
      boostId: boost.id as GameBoostId,
      transactionId,
    });

    setBalance(getClubFundsBalance());
    refresh();
    setPurchasingId(null);
    setConfirmBoost(null);

    if (result.success) {
      playThemePurchaseSuccess();
      return;
    }

    playThemePurchaseFail();
    if (result.reason === "insufficient") {
      setPurchaseError(
        `Need ${formatClubFundsExact(boost.price)} — balance ${formatClubFundsExact(result.newBalance)}`
      );
    } else if (result.reason === "duplicate") {
      setPurchaseError("Purchase already processing.");
    }
  };

  const handlePurchase = (boost: GameBoost) => {
    if (boost.price >= EXPENSIVE_PURCHASE_THRESHOLD) {
      setConfirmBoost(boost);
      return;
    }
    executePurchase(boost);
  };

  return (
    <div>
      <div
        className={`${CARD.inset} flex flex-wrap items-center justify-between gap-3 ${SPACING.cardPaddingSm}`}
      >
        <div>
          <p className={TYPO.statLabel}>Club Funds</p>
          <p className="mt-1 font-display text-2xl font-black text-white">
            {formatClubFunds(balance)}
          </p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-gray-500`}>
            {formatClubFundsExact(balance)}
          </p>
        </div>
        <p className={`max-w-xs ${TYPO.bodySm} text-gray-400`}>
          Buy here. Activate in-game.
        </p>
      </div>

      {purchaseError && (
        <p className="mt-4 text-sm font-medium text-red-400" role="alert">
          {purchaseError}
        </p>
      )}

      <div className={`mt-6 ${SPACING.stackLg}`}>
        <BoostSection
          title="Classic Boosts"
          description="Use in Classic or Draft picks."
          boosts={getQuickModeBoosts()}
          balance={balance}
          quantities={quantities}
          purchasingId={purchasingId}
          onPurchase={handlePurchase}
        />
      </div>

      {confirmBoost && (
        <GameModal
          open
          onClose={() => setConfirmBoost(null)}
          labelledBy="boost-purchase-confirm"
        >
          <p id="boost-purchase-confirm" className={TYPO.sectionTitle}>
            Buy {confirmBoost.name}?
          </p>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Costs {formatClubFundsExact(confirmBoost.price)}. Use in-game, not
            here.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <GameButton
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={() => setConfirmBoost(null)}
            >
              Cancel
            </GameButton>
            <GameButton
              variant="theme"
              size="sm"
              fullWidth={false}
              onClick={() => executePurchase(confirmBoost)}
            >
              Buy — {formatClubFunds(confirmBoost.price)}
            </GameButton>
          </div>
        </GameModal>
      )}
    </div>
  );
}
