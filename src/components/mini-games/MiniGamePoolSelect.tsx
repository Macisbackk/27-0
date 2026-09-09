"use client";

import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";
import {
  MINI_GAME_POOL_MODE_BLURB,
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";

const MODES: MiniGamePoolMode[] = ["current", "era"];

/**
 * Current vs Era picker — same card style as Quiz Normal / Team Challenge.
 * Title lives on MiniGameShell; this renders subtitle + mode cards.
 */
export function MiniGamePoolSelect({
  subtitle,
  onSelect,
}: {
  subtitle: string;
  onSelect: (mode: MiniGamePoolMode) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className={`mx-auto mt-2 max-w-md ${TYPO.pageSubtitle}`}>{subtitle}</p>

      <div className="mt-8 grid gap-3">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              playUiClick();
              onSelect(mode);
            }}
            className="w-full border border-white/10 bg-[#0c1210] px-4 py-4 text-center"
          >
            <p className={TYPO.keyLabel}>{MINI_GAME_POOL_MODE_LABEL[mode]}</p>
            <p className={`mt-1 ${TYPO.bodySm}`}>
              {MINI_GAME_POOL_MODE_BLURB[mode]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
