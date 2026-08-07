"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  getQuickModeBoosts,
  type GameBoostId,
} from "@/lib/boosts/boostDefinitions";
import {
  BOOST_INVENTORY_CHANGED_EVENT,
  getBoostQuantity,
} from "@/lib/boosts/boostInventory";
import { isQmSelectionBoostAllowedInMode } from "@/lib/boosts/applyQuickModeBoost";
import {
  isQmSelectionBoostId,
  type QmSelectionBoostId,
} from "@/lib/game/quick-mode-pregame-boost";
import { playUiClick, playBoostSelected } from "@/lib/sound";

interface QuickModePreGameBoostSetupProps {
  runId: string;
  /** Current vs Era — Legend boost is Era Mode only. */
  eraMode?: boolean;
  /** Shown when start is blocked (e.g. no valid boosted route). */
  notice?: string | null;
  onConfirm: (boostId: GameBoostId | null) => void;
}

/**
 * Compact pre-game boost chooser — must complete before any spin.
 */
export function QuickModePreGameBoostSetup({
  runId,
  eraMode = false,
  notice = null,
  onConfirm,
}: QuickModePreGameBoostSetupProps) {
  const [, setTick] = useState(0);
  const [picked, setPicked] = useState<QmSelectionBoostId | null>(null);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
  }, []);

  const boosts = getQuickModeBoosts().filter(
    (b) =>
      isQmSelectionBoostId(b.id) &&
      getBoostQuantity(b.id) > 0 &&
      isQmSelectionBoostAllowedInMode(b.id, eraMode)
  );

  const confirm = (boostId: GameBoostId | null) => {
    playUiClick();
    if (boostId) {
      playBoostSelected();
    }
    onConfirm(boostId);
  };

  return (
    <div className="mx-auto w-full max-w-md px-3 py-4">
      <div className="border-b border-[var(--mobile-divider)] pb-4">
        <p className={TYPO.keyLabel}>Pre-game</p>
        <h2 className={`mt-1 ${TYPO.cardTitle}`}>Boost</h2>
        <p className={`mt-2 ${TYPO.meta}`}>
          One boost for this run, or start without. Locked after the first spin.
          {!eraMode ? " Legend boosts are Era only." : null}
        </p>
      </div>

      <div className="mt-4">
        {boosts.length === 0 ? (
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No compatible Quick Mode boosts in inventory.
          </p>
        ) : (
          <ul className={SPACING.stackSm}>
            {boosts.map((boost) => {
              const qty = getBoostQuantity(boost.id);
              const selected = picked === boost.id;
              return (
                <li key={boost.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-[var(--mobile-radius-medium)] border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-white/25 bg-white/5"
                        : "border-[var(--mobile-divider)] bg-transparent hover:border-white/15"
                    }`}
                    onClick={() => {
                      playUiClick();
                      setPicked(boost.id as QmSelectionBoostId);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {boost.name}
                      </span>
                      <span className="block text-[11px] text-pitch-500">
                        Owned ×{qty}
                      </span>
                    </span>
                    {selected && (
                      <span className="shrink-0 text-xs font-bold text-theme-primary">
                        Selected
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {notice ? (
          <p
            className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            role="alert"
          >
            {notice}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <GameButton
            variant="theme"
            fullWidth
            disabled={!picked}
            onClick={() => picked && confirm(picked)}
          >
            Confirm boost
          </GameButton>
          <GameButton
            variant="secondary"
            fullWidth
            onClick={() => confirm(null)}
          >
            Start Without Boost
          </GameButton>
        </div>
      </div>
    </div>
  );
}
