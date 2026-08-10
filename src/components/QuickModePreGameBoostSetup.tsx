"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { CARD, SPACING } from "@/lib/ui/design-system";
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
 * Visual language matches home Quick Mode sections (keyLabel + MobileSection).
 */
export function QuickModePreGameBoostSetup({
  runId: _runId,
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
    <div className="mx-auto w-full max-w-xl px-3 py-4 text-center">
      <MobileSection className="flex w-full flex-col items-center text-center">
        <p className={`w-full text-center ${TYPO.keyLabel}`}>Pre-game</p>
        <h2 className={`mt-1 w-full text-center ${TYPO.homeModeTitle}`}>
          Use a boost
        </h2>
        <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.bodySm}`}>
          One boost for this run, locked after the first spin.
          {!eraMode ? " Legend boosts are Era only." : null}
        </p>

        <div className={`mt-5 w-full ${SPACING.stackSm}`}>
          {boosts.length === 0 ? (
            <div
              className={`${CARD.inset} ${SPACING.cardPaddingSm} text-center`}
            >
              <p className={`${TYPO.bodySm} text-pitch-400`}>
                No compatible Quick Mode boosts in inventory.
              </p>
              <p className={`mt-1 ${TYPO.meta}`}>
                Buy boosts in the Store, or start without one.
              </p>
            </div>
          ) : (
            <ul className={SPACING.stackSm} role="list">
              {boosts.map((boost) => {
                const qty = getBoostQuantity(boost.id);
                const selected = picked === boost.id;
                return (
                  <li key={boost.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      className={`${CARD.elevated} ${CARD.interactive} flex w-full flex-col items-center gap-1 ${SPACING.cardPaddingSm} text-center ${
                        selected ? CARD.selected : ""
                      }`}
                      onClick={() => {
                        playUiClick();
                        setPicked(boost.id as QmSelectionBoostId);
                      }}
                    >
                      <span className={`w-full truncate ${TYPO.cardTitle}`}>
                        {boost.name}
                      </span>
                      <span className={`w-full ${TYPO.bodySm}`}>
                        {boost.description}
                      </span>
                      <span className={`mt-0.5 ${TYPO.meta}`}>
                        Owned ×{qty}
                        {selected ? " · Selected" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {notice ? (
            <p
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100"
              role="alert"
            >
              {notice}
            </p>
          ) : null}

          <div className={`mt-2 flex w-full flex-col gap-2`}>
            <GameButton
              variant="theme"
              fullWidth
              disabled={!picked}
              onClick={() => picked && confirm(picked)}
            >
              {picked ? "Confirm boost" : "Select a boost"}
            </GameButton>
            <GameButton
              variant="secondary"
              fullWidth
              onClick={() => confirm(null)}
            >
              Start without boost
            </GameButton>
          </div>
        </div>
      </MobileSection>
    </div>
  );
}
