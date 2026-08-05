"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
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
import {
  isQmSelectionBoostId,
  type QmSelectionBoostId,
} from "@/lib/game/quick-mode-pregame-boost";
import { playUiClick, playBoostSelected } from "@/lib/sound";

interface QuickModePreGameBoostSetupProps {
  runId: string;
  onConfirm: (boostId: GameBoostId | null) => void;
}

/**
 * Compact pre-game boost chooser — must complete before any spin.
 */
export function QuickModePreGameBoostSetup({
  runId,
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
    (b) => isQmSelectionBoostId(b.id) && getBoostQuantity(b.id) > 0
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
      <GamePanel variant="elevated" padded className={SPACING.cardPadding}>
        <p className={TYPO.sectionLabel}>Pre-game setup</p>
        <h2 className={`mt-1 ${TYPO.cardTitle}`}>Quick Mode boost</h2>
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
          Choose one boost for this run, or start without. Boosts cannot be
          changed once the first spin begins.
        </p>
        <p className={`mt-1 ${TYPO.meta}`}>Run {runId.slice(0, 12)}…</p>

        {boosts.length === 0 ? (
          <p className={`mt-4 ${TYPO.bodySm} text-pitch-400`}>
            No compatible Quick Mode boosts in inventory.
          </p>
        ) : (
          <ul className={`mt-4 ${SPACING.stackSm}`}>
            {boosts.map((boost) => {
              const qty = getBoostQuantity(boost.id);
              const selected = picked === boost.id;
              return (
                <li key={boost.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-theme-primary/50 bg-theme-primary/10"
                        : "border-pitch-700/50 bg-pitch-950/50 hover:border-pitch-500/40"
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

        <div className={`mt-5 flex flex-col gap-2`}>
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
      </GamePanel>
    </div>
  );
}
