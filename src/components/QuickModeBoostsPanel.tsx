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
import { playUiClick } from "@/lib/sound";

interface QuickModeBoostsPanelProps {
  selectionBoostsUsedThisRun: number;
  maxPerRun?: number;
  disabled?: boolean;
  notice?: string | null;
  /** Current vs Era — Legend boost is Era Mode only. */
  eraMode?: boolean;
  onActivate: (boostId: GameBoostId) => void;
}

export function QuickModeBoostsPanel({
  selectionBoostsUsedThisRun,
  maxPerRun = 2,
  disabled = false,
  notice = null,
  eraMode = false,
  onActivate,
}: QuickModeBoostsPanelProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
  }, []);

  const boosts = getQuickModeBoosts().filter(
    (b) =>
      getBoostQuantity(b.id) > 0 &&
      (!b.eraModeOnly || eraMode)
  );
  if (boosts.length === 0 && !notice) return null;

  const atCap = selectionBoostsUsedThisRun >= maxPerRun;

  return (
    <div className="mb-4 rounded-xl border border-pitch-700/50 bg-pitch-900/60 px-3 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className={`${TYPO.sectionLabel} text-pitch-300`}>Boosts</p>
        <p className="text-[11px] text-pitch-500">
          {selectionBoostsUsedThisRun}/{maxPerRun} used this run
        </p>
      </div>
      {boosts.length > 0 ? (
        <ul className={SPACING.stackSm}>
          {boosts.map((boost) => {
            const qty = getBoostQuantity(boost.id);
            return (
              <li
                key={boost.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {boost.name}
                  </p>
                  <p className="text-[11px] text-pitch-500">
                    Owned ×{qty} · {boost.usageLimitLabel}
                  </p>
                </div>
                <GameButton
                  variant="secondary"
                  size="sm"
                  disabled={disabled || atCap || qty < 1}
                  onClick={() => {
                    playUiClick();
                    onActivate(boost.id);
                  }}
                >
                  Use
                </GameButton>
              </li>
            );
          })}
        </ul>
      ) : null}
      {atCap ? (
        <p className="mt-2 text-[11px] text-pitch-500">
          Maximum selection boosts used for this run.
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-sm text-amber-300/90" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
