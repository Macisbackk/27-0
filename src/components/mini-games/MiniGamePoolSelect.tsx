"use client";

import { playUiClick } from "@/lib/sound";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  MINI_GAME_POOL_MODE_BLURB,
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";

const MODES: MiniGamePoolMode[] = ["current", "era"];

const MODE_CARD_CLASS: Record<MiniGamePoolMode, string> = {
  current: "border-theme-primary/40",
  era: "border-accent-gold/40",
};

const MODE_TITLE_CLASS: Record<MiniGamePoolMode, string> = {
  current: "text-theme-primary",
  era: "text-accent-gold",
};

/**
 * Current vs Era picker — same card style as Quiz Normal / Team Challenge.
 * Title lives on MiniGameShell; this renders the mode cards only.
 */
export function MiniGamePoolSelect({
  onSelect,
}: {
  onSelect: (mode: MiniGamePoolMode) => void;
}) {
  return (
    <div className={`mx-auto w-full max-w-xl text-center ${SPACING.sectionGap}`}>
      <div className="grid gap-3">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              playUiClick();
              onSelect(mode);
            }}
            className={`w-full border bg-[#0c1210] text-center ${SPACING.cardPaddingSm} ${MODE_CARD_CLASS[mode]}`}
          >
            <p
              className={`${TYPO.modeCardTitle} ${MODE_TITLE_CLASS[mode]}`}
            >
              {MINI_GAME_POOL_MODE_LABEL[mode]}
            </p>
            <p className={`mt-1 ${TYPO.bodySm}`}>
              {MINI_GAME_POOL_MODE_BLURB[mode]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
